import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Platform, useWindowDimensions } from 'react-native';
import { supabase } from '../services/supabaseClient';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function AdminPanel({ isDarkMode }) {
  const { width } = useWindowDimensions();
  const numColumns = width > 850 ? 3 : 1; 

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtro e Busca
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos'); // 'todos', 'ativo', 'inativo', 'pendente'

  // Estados do Modal de Alerta Customizado (Substitui os alerts nativos)
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Estados do Modal de Reset
  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);
  const [newEmailInput, setNewEmailInput] = useState('');

  // Estados do Modal de Novo Usuário
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState('vendedor'); 
  const [isCreating, setIsCreating] = useState(false);

  // Estados do Modal de Exclusão Permanente
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const showAlert = (title, message) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setIsAlertModalVisible(true);
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
    if (!error && data) setUsers(data);
    setLoading(false);
  };

  const updateUserStatus = async (id, newStatus) => {
    const { error } = await supabase.from('user_profiles').update({ status: newStatus }).eq('id', id);
    if (!error) {
      showAlert("Sucesso", `Status atualizado para: ${newStatus}`);
      fetchUsers();
    } else {
      showAlert("Erro", error.message);
    }
  };

  const handleOpenResetModal = (user) => {
    setSelectedUserForReset(user);
    setNewEmailInput(user.email);
    setIsResetModalVisible(true);
  };

  const handleConfirmReset = async () => {
    if (!selectedUserForReset || !newEmailInput) return;
    try {
      setLoading(true);
      const { error } = await supabase.rpc('admin_reset_user_credentials', {
        target_user_id: selectedUserForReset.id,
        new_email: newEmailInput,
        new_password: 'Senha123!'
      });

      if (error) throw error;
      setIsResetModalVisible(false);
      showAlert("Sucesso", `Credenciais alteradas!\nNova senha padrão: Senha123!`);
      fetchUsers();
    } catch (err) {
      showAlert("Erro", "Erro ao redefinir: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!createName || !createEmail) {
      showAlert("Atenção", "Preencha o nome e o e-mail.");
      return;
    }

    try {
      setIsCreating(true);
      const { error } = await supabase.rpc('admin_create_user', {
        new_email: createEmail.toLowerCase().trim(),
        new_name: createName,
        new_role: createRole
      });

      if (error) throw error;
      setIsCreateModalVisible(false);
      setCreateName('');
      setCreateEmail('');
      setCreateRole('vendedor');
      showAlert("Sucesso", "Usuário criado com sucesso!\nSenha padrão: Senha123!");
      fetchUsers();
    } catch (err) {
      showAlert("Erro", "Erro ao criar conta: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setLoading(true);
      const { error } = await supabase.rpc('admin_delete_user', {
        target_user_id: userToDelete.id
      });
      if (error) throw error;
      
      setIsDeleteModalVisible(false);
      setUserToDelete(null);
      showAlert("Sucesso", "Usuário excluído permanentemente do sistema.");
      fetchUsers();
    } catch (err) {
      showAlert("Erro", "Erro ao excluir: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Aplicação dos Filtros e Busca
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.name?.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (user.email?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'todos' || user.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const themeStyles = isDarkMode ? darkStyles : lightStyles;

  const renderUserCard = ({ item }) => (
    <View style={[styles.card, themeStyles.card, { flex: 1, margin: 8, maxWidth: numColumns === 3 ? '31%' : '100%' }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.userName, themeStyles.userName]} numberOfLines={1}>{item.name || 'Sem Nome'}</Text>
        <Text style={[styles.badge, item.status === 'ativo' ? styles.badgeActive : item.status === 'pendente' ? styles.badgePending : styles.badgeInactive]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      
      <Text style={[styles.email, themeStyles.email]} numberOfLines={1}>{item.email}</Text>
      <Text style={[styles.role, themeStyles.role]}>Nível: {item.role}</Text>

      <View style={styles.actions}>
        {item.status === 'pendente' && (
          <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={() => updateUserStatus(item.id, 'ativo')}>
            <Text style={styles.btnText}>✅ Aprovar</Text>
          </TouchableOpacity>
        )}
        {item.status === 'ativo' && (
          <TouchableOpacity style={[styles.btn, styles.btnDeactivate]} onPress={() => updateUserStatus(item.id, 'inativo')}>
            <Text style={styles.btnText}>❌ Desativar</Text>
          </TouchableOpacity>
        )}
        {item.status === 'inativo' && (
          <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={() => updateUserStatus(item.id, 'ativo')}>
            <Text style={styles.btnText}>♻️ Reativar</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={[styles.btn, themeStyles.btnReset]} onPress={() => handleOpenResetModal(item)}>
          <Text style={[styles.btnTextReset, themeStyles.btnTextReset]}>⚙️ Senha</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btn, themeStyles.btnDelete]} 
          onPress={() => { setUserToDelete(item); setIsDeleteModalVisible(true); }}
        >
          <Text style={[styles.btnTextDelete, themeStyles.btnTextDelete]}>🗑️ Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, themeStyles.container]}>
      <View style={styles.topBar}>
        <View style={styles.headerInfo}>
          <Text style={[styles.title, themeStyles.title]}>🛡️ Gerenciamento de Usuários</Text>
          <Text style={[styles.subtitle, themeStyles.subtitle]}>Administre acessos e contas do sistema.</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={() => setIsCreateModalVisible(true)}>
          <Text style={styles.createBtnText}>+ Novo Usuário</Text>
        </TouchableOpacity>
      </View>
      
      {/* BARRA DE FILTROS E PESQUISA */}
      <View style={[styles.filterSection, themeStyles.filterSection]}>
        <TextInput 
          style={[styles.searchInput, themeStyles.searchInput]} 
          placeholder="Buscar por nome ou e-mail..." 
          placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={styles.statusFilters}>
          <TouchableOpacity style={[styles.filterTag, themeStyles.filterTag, statusFilter === 'todos' && themeStyles.filterTagActive]} onPress={() => setStatusFilter('todos')}>
            <Text style={[styles.filterTagText, themeStyles.filterTagText, statusFilter === 'todos' && themeStyles.filterTagTextActive]}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterTag, themeStyles.filterTag, statusFilter === 'ativo' && themeStyles.filterTagActive]} onPress={() => setStatusFilter('ativo')}>
            <Text style={[styles.filterTagText, themeStyles.filterTagText, statusFilter === 'ativo' && themeStyles.filterTagTextActive]}>Ativos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterTag, themeStyles.filterTag, statusFilter === 'inativo' && themeStyles.filterTagActive]} onPress={() => setStatusFilter('inativo')}>
            <Text style={[styles.filterTagText, themeStyles.filterTagText, statusFilter === 'inativo' && themeStyles.filterTagTextActive]}>Inativos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterTag, themeStyles.filterTag, statusFilter === 'pendente' && themeStyles.filterTagActive]} onPress={() => setStatusFilter('pendente')}>
            <Text style={[styles.filterTagText, themeStyles.filterTagText, statusFilter === 'pendente' && themeStyles.filterTagTextActive]}>Pendentes</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={isDarkMode ? '#38bdf8' : '#2563eb'} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredUsers}
          key={numColumns} 
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          renderItem={renderUserCard}
          contentContainerStyle={{ paddingBottom: 100 }}
          columnWrapperStyle={numColumns > 1 ? { justifyContent: 'flex-start' } : undefined}
          ListEmptyComponent={<Text style={[styles.emptyText, themeStyles.emptyText]}>Nenhum usuário encontrado.</Text>}
        />
      )}

      {/* MODAL DE ALERTA CUSTOMIZADO */}
      <Modal animationType="fade" transparent={true} visible={isAlertModalVisible} onRequestClose={() => setIsAlertModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, themeStyles.modalContent]}>
            <Text style={[styles.modalTitle, themeStyles.modalTitle]}>{alertTitle}</Text>
            <Text style={[styles.modalSubtitle, themeStyles.modalSubtitle]}>{alertMessage}</Text>
            <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn, { width: '100%', marginTop: 8 }]} onPress={() => setIsAlertModalVisible(false)}>
              <Text style={styles.confirmBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: RESET DE CREDENCIAIS */}
      <Modal animationType="fade" transparent={true} visible={isResetModalVisible} onRequestClose={() => setIsResetModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, themeStyles.modalContent]}>
            <Text style={[styles.modalTitle, themeStyles.modalTitle]}>Redefinir Credenciais</Text>
            <Text style={[styles.modalSubtitle, themeStyles.modalSubtitle]}>A senha será redefinida automaticamente para <Text style={{fontWeight: 'bold'}}>Senha123!</Text>.</Text>
            <Text style={[styles.inputLabel, themeStyles.inputLabel]}>E-mail do Usuário</Text>
            <TextInput style={[styles.textInput, themeStyles.textInput]} value={newEmailInput} onChangeText={setNewEmailInput} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, themeStyles.cancelBtn]} onPress={() => setIsResetModalVisible(false)}>
                <Text style={[styles.cancelBtnText, themeStyles.cancelBtnText]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={handleConfirmReset}>
                <Text style={styles.confirmBtnText}>Resetar Conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: NOVO USUÁRIO */}
      <Modal animationType="fade" transparent={true} visible={isCreateModalVisible} onRequestClose={() => setIsCreateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, themeStyles.modalContent]}>
            <Text style={[styles.modalTitle, themeStyles.modalTitle]}>Criar Novo Usuário</Text>
            <Text style={[styles.modalSubtitle, themeStyles.modalSubtitle]}>Preencha os dados. A senha padrão inicial será <Text style={{fontWeight: 'bold'}}>Senha123!</Text>.</Text>

            <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Nome Completo</Text>
            <TextInput style={[styles.textInput, themeStyles.textInput]} placeholder="Ex: João Silva" placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} value={createName} onChangeText={setCreateName} />

            <Text style={[styles.inputLabel, themeStyles.inputLabel]}>E-mail</Text>
            <TextInput style={[styles.textInput, themeStyles.textInput]} placeholder="joao@email.com" placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} value={createEmail} onChangeText={setCreateEmail} autoCapitalize="none" keyboardType="email-address" />

            <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Nível de Acesso</Text>
            <View style={styles.roleSelector}>
              <TouchableOpacity 
                style={[styles.roleBtn, themeStyles.roleBtn, createRole === 'vendedor' && themeStyles.roleBtnActive]} 
                onPress={() => setCreateRole('vendedor')}
              >
                <Text style={[styles.roleBtnText, themeStyles.roleBtnText, createRole === 'vendedor' && themeStyles.roleBtnTextActive]}>Vendedor</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.roleBtn, themeStyles.roleBtn, createRole === 'admin' && themeStyles.roleBtnActive]} 
                onPress={() => setCreateRole('admin')}
              >
                <Text style={[styles.roleBtnText, themeStyles.roleBtnText, createRole === 'admin' && themeStyles.roleBtnTextActive]}>Administrador</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, themeStyles.cancelBtn]} onPress={() => setIsCreateModalVisible(false)}>
                <Text style={[styles.cancelBtnText, themeStyles.cancelBtnText]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn, { backgroundColor: '#10b981' }]} onPress={handleCreateUser} disabled={isCreating}>
                {isCreating ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Criar Conta</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: EXCLUSÃO PERMANENTE */}
      <Modal animationType="fade" transparent={true} visible={isDeleteModalVisible} onRequestClose={() => setIsDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, themeStyles.modalContent]}>
            <Text style={[styles.modalTitle, themeStyles.modalTitle]}>Aviso Crítico ⚠️</Text>
            <Text style={[styles.modalSubtitle, themeStyles.modalSubtitle]}>
              Tem certeza que deseja apagar permanentemente a conta de <Text style={{fontWeight: 'bold', color: '#ef4444'}}>{userToDelete?.name}</Text>? Esta ação <Text style={{fontWeight: 'bold'}}>NÃO PODE</Text> ser desfeita e todos os dados vinculados serão perdidos.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, themeStyles.cancelBtn]} onPress={() => setIsDeleteModalVisible(false)}>
                <Text style={[styles.cancelBtnText, themeStyles.cancelBtnText]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn, { backgroundColor: '#ef4444' }]} onPress={confirmDeleteUser}>
                <Text style={styles.confirmBtnText}>Sim, Excluir Conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 16 },
  headerInfo: { flexShrink: 1, marginRight: 16 },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginTop: 4 },
  createBtn: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginTop: Platform.OS === 'web' ? 0 : 12 },
  createBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14, fontFamily: MODERN_FONT },
  
  filterSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1 },
  searchInput: { flex: 1, minWidth: 200, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, fontFamily: MODERN_FONT, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  statusFilters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterTag: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1 },
  filterTagText: { fontSize: 12, fontWeight: '600', fontFamily: MODERN_FONT },
  emptyText: { textAlign: 'center', marginTop: 32, fontSize: 16, fontFamily: MODERN_FONT },

  card: { padding: 16, borderRadius: 12, borderWidth: 1, minWidth: 280 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  userName: { fontSize: 16, fontWeight: '900', flex: 1, marginRight: 8, fontFamily: MODERN_FONT },
  email: { fontSize: 13, marginBottom: 4, fontFamily: MODERN_FONT },
  role: { fontSize: 12, fontWeight: '600', marginBottom: 16, fontFamily: MODERN_FONT },
  
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 10, fontWeight: 'bold', color: '#fff', overflow: 'hidden', fontFamily: MODERN_FONT },
  badgeActive: { backgroundColor: '#10b981' },
  badgePending: { backgroundColor: '#f59e0b' },
  badgeInactive: { backgroundColor: '#ef4444' },
  
  actions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  btn: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 6, alignItems: 'center', minWidth: '45%' },
  btnApprove: { backgroundColor: '#10b981' },
  btnDeactivate: { backgroundColor: '#f59e0b' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 11, fontFamily: MODERN_FONT },
  btnTextReset: { fontWeight: 'bold', fontSize: 11, fontFamily: MODERN_FONT },
  btnTextDelete: { fontWeight: 'bold', fontSize: 11, fontFamily: MODERN_FONT },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 20px rgba(0,0,0,0.15)' } }) },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, fontFamily: MODERN_FONT },
  modalSubtitle: { fontSize: 13, marginBottom: 20, lineHeight: 18, fontFamily: MODERN_FONT },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, fontFamily: MODERN_FONT },
  textInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 16, fontFamily: MODERN_FONT, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  
  roleSelector: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  roleBtn: { flex: 1, paddingVertical: 12, borderWidth: 1, borderRadius: 8, alignItems: 'center' },
  roleBtnText: { fontSize: 13, fontWeight: '600', fontFamily: MODERN_FONT },

  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  confirmBtn: { backgroundColor: '#2563eb' },
  confirmBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13, fontFamily: MODERN_FONT },
  cancelBtnText: { fontWeight: 'bold', fontSize: 13, fontFamily: MODERN_FONT }
});

/* Estilos de Tema Claro */
const lightStyles = StyleSheet.create({
  container: { backgroundColor: '#f8fafc' },
  title: { color: '#0f172a' },
  subtitle: { color: '#64748b' },
  filterSection: { backgroundColor: '#fff', borderColor: '#e2e8f0' },
  searchInput: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', color: '#0f172a' },
  filterTag: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  filterTagActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  filterTagText: { color: '#64748b' },
  filterTagTextActive: { color: '#2563eb' },
  emptyText: { color: '#94a3b8' },
  card: { backgroundColor: '#fff', borderColor: '#e2e8f0' },
  userName: { color: '#0f172a' },
  email: { color: '#475569' },
  role: { color: '#94a3b8' },
  btnReset: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  btnTextReset: { color: '#475569' },
  btnDelete: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  btnTextDelete: { color: '#ef4444' },
  modalContent: { backgroundColor: '#ffffff' },
  modalTitle: { color: '#1e293b' },
  modalSubtitle: { color: '#64748b' },
  inputLabel: { color: '#475569' },
  textInput: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', color: '#0f172a' },
  roleBtn: { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
  roleBtnActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  roleBtnText: { color: '#64748b' },
  roleBtnTextActive: { color: '#2563eb' },
  cancelBtn: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  cancelBtnText: { color: '#475569' }
});

/* Estilos de Tema Escuro */
const darkStyles = StyleSheet.create({
  container: { backgroundColor: '#0f172a' },
  title: { color: '#f8fafc' },
  subtitle: { color: '#94a3b8' },
  filterSection: { backgroundColor: '#1e293b', borderColor: '#334155' },
  searchInput: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' },
  filterTag: { backgroundColor: '#0f172a', borderColor: '#334155' },
  filterTagActive: { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' },
  filterTagText: { color: '#94a3b8' },
  filterTagTextActive: { color: '#93c5fd' },
  emptyText: { color: '#64748b' },
  card: { backgroundColor: '#1e293b', borderColor: '#334155' },
  userName: { color: '#f8fafc' },
  email: { color: '#94a3b8' },
  role: { color: '#64748b' },
  btnReset: { backgroundColor: '#0f172a', borderColor: '#334155' },
  btnTextReset: { color: '#cbd5e1' },
  btnDelete: { backgroundColor: '#450a0a', borderColor: '#7f1d1d' },
  btnTextDelete: { color: '#fca5a5' },
  modalContent: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 },
  modalTitle: { color: '#f8fafc' },
  modalSubtitle: { color: '#94a3b8' },
  inputLabel: { color: '#cbd5e1' },
  textInput: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' },
  roleBtn: { borderColor: '#334155', backgroundColor: '#0f172a' },
  roleBtnActive: { borderColor: '#3b82f6', backgroundColor: '#1e3a8a' },
  roleBtnText: { color: '#94a3b8' },
  roleBtnTextActive: { color: '#93c5fd' },
  cancelBtn: { backgroundColor: '#0f172a', borderColor: '#334155' },
  cancelBtnText: { color: '#cbd5e1' }
});