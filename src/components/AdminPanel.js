// AdminPanel
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Platform, useWindowDimensions, ScrollView, Pressable } from 'react-native';
import { supabase } from '../services/supabaseClient';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function AdminPanel({ isDarkMode }) {
  const { width } = useWindowDimensions();
  const numColumns = width > 850 ? 3 : 1; 

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtro e Busca
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Estados do Modal de Alerta
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Estados do Modal de Configuração (Substitui o antigo Modal de Reset)
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [newEmailInput, setNewEmailInput] = useState('');
  const [editRole, setEditRole] = useState('vendedor'); 
  const [goalInput, setGoalInput] = useState('');
  const [callsInput, setCallsInput] = useState('');
  const [simsInput, setSimsInput] = useState('');
  const [negsInput, setNegsInput] = useState('');
  const [ticketInput, setTicketInput] = useState('');
  const [convInput, setConvInput] = useState('');

  // Estados de Importação de Dados
  const [selectedImportPhaseUser, setSelectedImportPhaseUser] = useState('');
  const [selectedImportLeadUser, setSelectedImportLeadUser] = useState('');
  const [isPhaseDropdownOpen, setIsPhaseDropdownOpen] = useState(false);
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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
    const { data: usersData, error: usersError } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
    const { data: configsData } = await supabase.from('crm_boards').select('id, data_payload').ilike('id', 'config_%');

    if (!usersError && usersData) {
      const configsMap = {};
      if (configsData) {
        configsData.forEach(c => {
          const uid = c.id.replace('config_', '');
          configsMap[uid] = c.data_payload || {};
        });
      }
      
      const mergedUsers = usersData.map(u => ({
        ...u,
        config: configsMap[u.id] || {},
        hasPendingRequest: !!(configsMap[u.id] && configsMap[u.id].pendingRequest)
      }));
      setUsers(mergedUsers);
    }
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

  const handleOpenConfigModal = (user) => {
    setSelectedUser(user);
    setNewEmailInput(user.email);
    setEditRole(user.role || 'vendedor');
    setGoalInput(user.config.monthlyGoal || '0');
    setCallsInput(user.config.dailyCalls || '0');
    setSimsInput(user.config.dailySims || '0');
    setNegsInput(user.config.dailyNeg || '0');
    setTicketInput(user.config.ticketMedio || '0');
    setConvInput(user.config.conversionRateGoal || '0');
    setSelectedImportPhaseUser('');
    setSelectedImportLeadUser('');
    setIsPhaseDropdownOpen(false);
    setIsLeadDropdownOpen(false);
    setIsConfigModalVisible(true);
  };

  const handleResetCredentials = async () => {
    if (!selectedUser || !newEmailInput) return;
    try {
      setLoading(true);
      const { error } = await supabase.rpc('admin_reset_user_credentials', {
        target_user_id: selectedUser.id,
        new_email: newEmailInput,
        new_password: 'Senha123!'
      });

      if (error) throw error;
      showAlert("Sucesso", `Credenciais alteradas!\nNova senha padrão: Senha123!`);
      fetchUsers();
    } catch (err) {
      showAlert("Erro", "Erro ao redefinir: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (importType, sourceUserId) => {
    if (!sourceUserId) {
      showAlert("Erro", "Selecione um usuário para importar.");
      return;
    }
    try {
      setIsImporting(true);

      // Fetch Source Board
      const { data: sourceBoards } = await supabase.from('crm_boards').select('data_payload').eq('user_id', sourceUserId).ilike('id', 'board_%').limit(1);
      if (!sourceBoards || sourceBoards.length === 0) throw new Error("Quadro do usuário origem não encontrado.");
      const sourcePayload = sourceBoards[0].data_payload || { phases: [] };

      // Fetch Target Board
      const { data: targetBoards } = await supabase.from('crm_boards').select('id, data_payload').eq('user_id', selectedUser.id).ilike('id', 'board_%').limit(1);
      if (!targetBoards || targetBoards.length === 0) throw new Error("Quadro do usuário destino não encontrado.");
      const targetBoardId = targetBoards[0].id;
      let targetPayload = targetBoards[0].data_payload || { phases: [] };

      let targetPhases = [...targetPayload.phases];

      sourcePayload.phases.forEach((sPhase) => {
        let incomingPhase = {
          ...sPhase,
          id: `phase_imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          clients: importType === 'leads' ? JSON.parse(JSON.stringify(sPhase.clients || [])) : []
        };

        if (importType === 'leads') {
          incomingPhase.clients = incomingPhase.clients.map(c => ({
            ...c,
            id: `lead_imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            comments: (c.comments || []).map(comm => ({ ...comm, text: `[Importado] ${comm.text}` }))
          }));
        }

        const existingTargetIndex = targetPhases.findIndex(t => t.title.trim().toLowerCase() === sPhase.title.trim().toLowerCase());

        if (existingTargetIndex !== -1) {
          const oldTargetLeads = targetPhases[existingTargetIndex].clients || [];
          incomingPhase.clients = [...oldTargetLeads, ...incomingPhase.clients];
          targetPhases[existingTargetIndex] = incomingPhase;
        } else {
          targetPhases.push(incomingPhase);
        }
      });

      targetPayload.phases = targetPhases;

      const { error: updateError } = await supabase.from('crm_boards').update({ data_payload: targetPayload }).eq('id', targetBoardId);
      if (updateError) throw updateError;

      showAlert("Sucesso", `Importação de ${importType === 'leads' ? 'Leads e Fases' : 'Fases'} concluída!`);
      setIsPhaseDropdownOpen(false);
      setIsLeadDropdownOpen(false);
      if (importType === 'phases') setSelectedImportPhaseUser('');
      if (importType === 'leads') setSelectedImportLeadUser('');

    } catch (err) {
      showAlert("Erro", "Falha na importação: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveParameters = async () => {
    if (!selectedUser) return;
    try {
      setLoading(true);
      
      if (editRole && editRole !== selectedUser.role) {
        const { error: roleError } = await supabase
          .from('user_profiles')
          .update({ role: editRole })
          .eq('id', selectedUser.id);
          
        if (roleError) throw roleError;
      }

      const updatedConfig = { ...selectedUser.config };
      updatedConfig.monthlyGoal = goalInput;
      updatedConfig.dailyCalls = callsInput;
      updatedConfig.dailySims = simsInput;
      updatedConfig.dailyNeg = negsInput;
      updatedConfig.ticketMedio = ticketInput;
      updatedConfig.conversionRateGoal = convInput;

      delete updatedConfig.pendingRequest;

      const { error: configError } = await supabase
        .from('crm_boards')
        .update({ data_payload: updatedConfig })
        .eq('id', `config_${selectedUser.id}`);

      if (configError) throw configError;

      const { data: boardData } = await supabase.from('crm_boards').select('data_payload, id').eq('user_id', selectedUser.id).ilike('id', 'board_%').limit(1);
      if (boardData && boardData.length > 0) {
        let payload = boardData[0].data_payload;
        payload.unreadNotifications = [{
          id: `param_update_${Date.now()}`,
          type: 'Sistema',
          text: `⚙️ As suas metas, parâmetros ou nível de acesso foram atualizados pelo administrador.`,
          date: new Date().toISOString()
        }, ...(payload.unreadNotifications || [])];
        await supabase.from('crm_boards').update({ data_payload: payload }).eq('id', boardData[0].id);
      }

      setIsConfigModalVisible(false);
      showAlert("Sucesso", "Configurações do usuário atualizadas com sucesso!");
      fetchUsers();
    } catch (err) {
      showAlert("Erro", "Falha ao salvar configurações: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearPending = async (user) => {
    try {
      setLoading(true);
      const updatedConfig = { ...user.config };
      delete updatedConfig.pendingRequest;

      await supabase.from('crm_boards').update({ data_payload: updatedConfig }).eq('id', `config_${user.id}`);
      fetchUsers();
    } catch (error) {
      showAlert("Erro", "Não foi possível limpar a pendência.");
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

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.name?.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (user.email?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'todos' || 
                          user.status === statusFilter || 
                          (statusFilter === 'pendente' && user.hasPendingRequest);
    
    return matchesSearch && matchesStatus;
  });

  const themeStyles = isDarkMode ? darkStyles : lightStyles;

  const handleCurrencyChange = (text, setter) => {
    const rawNumber = text.replace(/\D/g, '');
    if (!rawNumber) return setter('');
    setter(new Intl.NumberFormat('pt-BR').format(parseInt(rawNumber, 10)));
  };

  const renderUserCard = ({ item }) => (
    <View style={[styles.card, themeStyles.card, { flex: 1, margin: 8, maxWidth: numColumns === 3 ? '32%' : '100%' }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.userName, themeStyles.userName]} numberOfLines={1}>{item.name || 'Sem Nome'}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Text style={[styles.badge, item.status === 'ativo' ? styles.badgeActive : item.status === 'pendente' ? styles.badgePending : styles.badgeInactive]}>
            {item.status.toUpperCase()}
          </Text>
          {item.hasPendingRequest && (
            <Text style={[styles.badge, styles.badgePending]}>PENDENTE</Text>
          )}
        </View>
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
        
        <TouchableOpacity style={[styles.btn, themeStyles.btnReset]} onPress={() => handleOpenConfigModal(item)}>
          <Text style={[styles.btnTextReset, themeStyles.btnTextReset]}>⚙️ Configuração</Text>
        </TouchableOpacity>

        {item.hasPendingRequest && (
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#f59e0b' }]} onPress={() => handleClearPending(item)}>
            <Text style={styles.btnText}>✅ Concluir Pendência</Text>
          </TouchableOpacity>
        )}

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
      
      <View style={styles.innerContainer}>
        
        <View style={styles.topBar}>
          <View style={styles.headerInfo}>
            <Text style={[styles.title, themeStyles.title]}>Gerenciamento de Usuários</Text>
            <Text style={[styles.subtitle, themeStyles.subtitle]}>Administre a gestão de usuários do sistema</Text>
          </View>
          <TouchableOpacity style={styles.createBtn} onPress={() => setIsCreateModalVisible(true)}>
            <Text style={styles.createBtnText}>+ Novo Usuário</Text>
          </TouchableOpacity>
        </View>
        
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
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={[styles.emptyText, themeStyles.emptyText]}>Nenhum usuário encontrado.</Text>}
          />
        )}
      </View>

      <Modal animationType="fade" transparent={true} visible={isAlertModalVisible} onRequestClose={() => setIsAlertModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsAlertModalVisible(false)}>
          <Pressable style={[styles.modalContent, themeStyles.modalContent]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, themeStyles.modalTitle]}>{alertTitle}</Text>
            <Text style={[styles.modalSubtitle, themeStyles.modalSubtitle]}>{alertMessage}</Text>
            <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn, { width: '100%', marginTop: 8 }]} onPress={() => setIsAlertModalVisible(false)}>
              <Text style={styles.confirmBtnText}>OK</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={isConfigModalVisible} onRequestClose={() => setIsConfigModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsConfigModalVisible(false)}>
          <Pressable style={[styles.modalContent, themeStyles.modalContent, { maxWidth: 800, padding: 0, overflow: 'hidden' }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView style={{ width: '100%', maxHeight: '85vh' }} contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
              
              <Text style={[styles.modalTitle, themeStyles.modalTitle, { fontSize: 20 }]}>Configurações de {selectedUser?.name}</Text>
              
              <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                
                {/* SESSÃO DE CREDENCIAIS & NÍVEL DE ACESSO */}
                <View style={[styles.configSection, themeStyles.configSection, { flex: 1, minWidth: 280, marginBottom: 0 }]}>
                  <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>Credenciais e Permissões</Text>
                  
                  <Text style={[styles.inputLabel, themeStyles.inputLabel]}>E-mail do Usuário</Text>
                  <TextInput style={[styles.textInput, themeStyles.textInput]} value={newEmailInput} onChangeText={setNewEmailInput} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} />
                  
                  <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Nível de Acesso (Role)</Text>
                  <View style={styles.roleSelector}>
                    <TouchableOpacity style={[styles.roleBtn, themeStyles.roleBtn, editRole === 'vendedor' && themeStyles.roleBtnActive, { paddingVertical: 10 }]} onPress={() => setEditRole('vendedor')}>
                      <Text style={[styles.roleBtnText, themeStyles.roleBtnText, editRole === 'vendedor' && themeStyles.roleBtnTextActive]}>Vendedor</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.roleBtn, themeStyles.roleBtn, editRole === 'admin' && themeStyles.roleBtnActive, { paddingVertical: 10 }]} onPress={() => setEditRole('admin')}>
                      <Text style={[styles.roleBtnText, themeStyles.roleBtnText, editRole === 'admin' && themeStyles.roleBtnTextActive]}>Administrador</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn, { backgroundColor: '#ef4444', marginTop: 16, width: 220, alignSelf: 'flex-start' }]} onPress={handleResetCredentials}>
                    <Text style={styles.confirmBtnText}>Resetar Senha (Senha123!)</Text>
                  </TouchableOpacity>
                </View>

                {/* SESSÃO DE IMPORTAÇÃO DE DADOS */}
                <View style={[styles.configSection, themeStyles.configSection, { flex: 1, minWidth: 280, marginBottom: 0 }]}>
                  <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>Importar Configurações e Dados</Text>

                  {/* Fases */}
                  <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Importar Fases de:</Text>
                  <View style={{ zIndex: 2, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        style={[styles.textInput, themeStyles.textInput, { flex: 1, marginBottom: 0, justifyContent: 'center', paddingVertical: 10 }]} 
                        onPress={() => { setIsPhaseDropdownOpen(!isPhaseDropdownOpen); setIsLeadDropdownOpen(false); }}
                      >
                        <Text style={{ color: selectedImportPhaseUser ? (isDarkMode ? '#f8fafc' : '#0f172a') : (isDarkMode ? '#64748b' : '#94a3b8') }}>
                          {selectedImportPhaseUser ? users.find(u => u.id === selectedImportPhaseUser)?.name || users.find(u => u.id === selectedImportPhaseUser)?.email : 'Selecione um usuário...'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.modalBtn, { backgroundColor: '#3b82f6', paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 }]}
                        onPress={() => handleImport('phases', selectedImportPhaseUser)}
                        disabled={isImporting}
                      >
                        {isImporting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Importar</Text>}
                      </TouchableOpacity>
                    </View>
                    {isPhaseDropdownOpen && (
                      <View style={{ maxHeight: 120, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#cbd5e1', borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', marginTop: 4 }}>
                        <ScrollView nestedScrollEnabled>
                          {users.filter(u => u.id !== selectedUser?.id).map(u => (
                            <TouchableOpacity key={`p_${u.id}`} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' }} onPress={() => { setSelectedImportPhaseUser(u.id); setIsPhaseDropdownOpen(false); }}>
                              <Text style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', fontSize: 13 }}>{u.name || u.email}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* Leads */}
                  <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Importar Leads de:</Text>
                  <View style={{ zIndex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        style={[styles.textInput, themeStyles.textInput, { flex: 1, marginBottom: 0, justifyContent: 'center', paddingVertical: 10 }]} 
                        onPress={() => { setIsLeadDropdownOpen(!isLeadDropdownOpen); setIsPhaseDropdownOpen(false); }}
                      >
                        <Text style={{ color: selectedImportLeadUser ? (isDarkMode ? '#f8fafc' : '#0f172a') : (isDarkMode ? '#64748b' : '#94a3b8') }}>
                          {selectedImportLeadUser ? users.find(u => u.id === selectedImportLeadUser)?.name || users.find(u => u.id === selectedImportLeadUser)?.email : 'Selecione um usuário...'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.modalBtn, { backgroundColor: '#10b981', paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 }]}
                        onPress={() => handleImport('leads', selectedImportLeadUser)}
                        disabled={isImporting}
                      >
                        {isImporting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Importar</Text>}
                      </TouchableOpacity>
                    </View>
                    {isLeadDropdownOpen && (
                      <View style={{ maxHeight: 120, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#cbd5e1', borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', marginTop: 4 }}>
                        <ScrollView nestedScrollEnabled>
                          {users.filter(u => u.id !== selectedUser?.id).map(u => (
                            <TouchableOpacity key={`l_${u.id}`} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9' }} onPress={() => { setSelectedImportLeadUser(u.id); setIsLeadDropdownOpen(false); }}>
                              <Text style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', fontSize: 13 }}>{u.name || u.email}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>

              </View>

              {/* SESSÃO DE PENDÊNCIAS */}
              {selectedUser?.hasPendingRequest && selectedUser.config.pendingRequest && (
                <View style={[styles.configSection, { backgroundColor: isDarkMode ? '#451a03' : '#fef3c7', borderColor: '#f59e0b', borderWidth: 1 }]}>
                  <Text style={[styles.sectionTitle, { color: '#d97706' }]}>⚠️ Solicitação Pendente</Text>
                  <Text style={{ fontSize: 12, marginBottom: 8, color: isDarkMode ? '#fde68a' : '#92400e', fontFamily: MODERN_FONT }}>
                    O usuário solicitou as seguintes alterações:
                  </Text>
                  <Text style={styles.pendingText}>Meta: R$ {selectedUser.config.pendingRequest.goal}</Text>
                  <Text style={styles.pendingText}>Ligações: {selectedUser.config.pendingRequest.calls} | Sims: {selectedUser.config.pendingRequest.sims} | Negs: {selectedUser.config.pendingRequest.negs}</Text>
                  <Text style={styles.pendingText}>Ticket: R$ {selectedUser.config.pendingRequest.ticket} | Conv: {selectedUser.config.pendingRequest.conv}%</Text>
                  <Text style={[styles.pendingText, { marginTop: 8, fontStyle: 'italic' }]}>Justificativa: "{selectedUser.config.pendingRequest.justification}"</Text>
                </View>
              )}

              {/* SESSÃO DE PARÂMETROS - Reorganizada Horizontalmente */}
              <View style={[styles.configSection, themeStyles.configSection]}>
                <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>Metas e Parâmetros (CRM)</Text>
                
                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <View style={{ flex: 1, minWidth: 150 }}>
                    <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Meta do Mês (R$)</Text>
                    <TextInput style={[styles.textInput, themeStyles.textInput, { marginBottom: 0 }]} value={goalInput} onChangeText={(t) => handleCurrencyChange(t, setGoalInput)} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1, minWidth: 150 }}>
                    <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Ticket Médio (R$)</Text>
                    <TextInput style={[styles.textInput, themeStyles.textInput, { marginBottom: 0 }]} value={ticketInput} onChangeText={(t) => handleCurrencyChange(t, setTicketInput)} keyboardType="numeric" />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                  <View style={{ flex: 1, minWidth: 100 }}>
                    <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Ligações</Text>
                    <TextInput style={[styles.textInput, themeStyles.textInput, { marginBottom: 0 }]} value={callsInput} onChangeText={setCallsInput} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1, minWidth: 100 }}>
                    <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Simulações</Text>
                    <TextInput style={[styles.textInput, themeStyles.textInput, { marginBottom: 0 }]} value={simsInput} onChangeText={setSimsInput} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1, minWidth: 100 }}>
                    <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Negociações</Text>
                    <TextInput style={[styles.textInput, themeStyles.textInput, { marginBottom: 0 }]} value={negsInput} onChangeText={setNegsInput} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1, minWidth: 100 }}>
                    <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Conversão (%)</Text>
                    <TextInput style={[styles.textInput, themeStyles.textInput, { marginBottom: 0 }]} value={convInput} onChangeText={setConvInput} keyboardType="numeric" />
                  </View>
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalBtn, themeStyles.cancelBtn]} onPress={() => setIsConfigModalVisible(false)}>
                  <Text style={[styles.cancelBtnText, themeStyles.cancelBtnText]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn, { backgroundColor: '#10b981' }]} onPress={handleSaveParameters}>
                  <Text style={styles.confirmBtnText}>Salvar Alterações</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={isCreateModalVisible} onRequestClose={() => setIsCreateModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsCreateModalVisible(false)}>
          <Pressable style={[styles.modalContent, themeStyles.modalContent]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, themeStyles.modalTitle]}>Criar Novo Usuário</Text>
            <Text style={[styles.modalSubtitle, themeStyles.modalSubtitle]}>Preencha os dados. A senha padrão inicial será <Text style={{fontWeight: 'bold'}}>Senha123!</Text>.</Text>

            <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Nome Completo</Text>
            <TextInput style={[styles.textInput, themeStyles.textInput]} placeholder="Ex: João Silva" placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} value={createName} onChangeText={setCreateName} />

            <Text style={[styles.inputLabel, themeStyles.inputLabel]}>E-mail</Text>
            <TextInput style={[styles.textInput, themeStyles.textInput]} placeholder="joao@email.com" placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} value={createEmail} onChangeText={setCreateEmail} autoCapitalize="none" keyboardType="email-address" />

            <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Nível de Acesso</Text>
            <View style={styles.roleSelector}>
              <TouchableOpacity style={[styles.roleBtn, themeStyles.roleBtn, createRole === 'vendedor' && themeStyles.roleBtnActive]} onPress={() => setCreateRole('vendedor')}>
                <Text style={[styles.roleBtnText, themeStyles.roleBtnText, createRole === 'vendedor' && themeStyles.roleBtnTextActive]}>Vendedor</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roleBtn, themeStyles.roleBtn, createRole === 'admin' && themeStyles.roleBtnActive]} onPress={() => setCreateRole('admin')}>
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
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={isDeleteModalVisible} onRequestClose={() => setIsDeleteModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsDeleteModalVisible(false)}>
          <Pressable style={[styles.modalContent, themeStyles.modalContent]} onPress={(e) => e.stopPropagation()}>
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
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 1050, 
    alignSelf: 'center',
  },

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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 25px rgba(0,0,0,0.15)' } }) },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, fontFamily: MODERN_FONT },
  modalSubtitle: { fontSize: 13, marginBottom: 20, lineHeight: 18, fontFamily: MODERN_FONT },
  
  configSection: { padding: 16, borderRadius: 10, marginBottom: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12, fontFamily: MODERN_FONT },
  pendingText: { fontSize: 12, fontFamily: MODERN_FONT, color: '#92400e', fontWeight: '600' },

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
  configSection: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  sectionTitle: { color: '#334155' },
  inputLabel: { color: '#475569' },
  textInput: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' },
  roleBtn: { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
  roleBtnActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  roleBtnText: { color: '#64748b' },
  roleBtnTextActive: { color: '#2563eb' },
  cancelBtn: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  cancelBtnText: { color: '#475569' }
});

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
  configSection: { backgroundColor: '#0f172a', borderColor: '#334155' },
  sectionTitle: { color: '#cbd5e1' },
  inputLabel: { color: '#cbd5e1' },
  textInput: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' },
  roleBtn: { borderColor: '#334155', backgroundColor: '#0f172a' },
  roleBtnActive: { borderColor: '#3b82f6', backgroundColor: '#1e3a8a' },
  roleBtnText: { color: '#94a3b8' },
  roleBtnTextActive: { color: '#93c5fd' },
  cancelBtn: { backgroundColor: '#0f172a', borderColor: '#334155' },
  cancelBtnText: { color: '#cbd5e1' }
});