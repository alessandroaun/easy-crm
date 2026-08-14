import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Platform, useWindowDimensions, ActivityIndicator, Modal } from 'react-native';
import { supabase } from '../services/supabaseClient';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function Configuracao({ onConfigSaved }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 850;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestingNameChange, setRequestingNameChange] = useState(false);

  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [originalName, setOriginalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [canEditName, setCanEditName] = useState(false);
  const [nameChangeRequested, setNameChangeRequested] = useState(false);

  const [monthlyGoal, setMonthlyGoal] = useState('');
  const [dailyCalls, setDailyCalls] = useState('');
  const [dailyNeg, setDailyNeg] = useState('');
  const [dailySims, setDailySims] = useState('');
  const [ticketMedio, setTicketMedio] = useState('');
  const [conversionRateGoal, setConversionRateGoal] = useState('');
  const [goalHistory, setGoalHistory] = useState([]);

  const [newPass, setNewPass] = useState('');
  const [newPassConfirm, setNewPassConfirm] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  const [customModal, setCustomModal] = useState({ visible: false, title: '', message: '', type: 'info' });

  const showAlertModal = (title, message, type = 'info') => {
    setCustomModal({ visible: true, title, message, type });
  };

  const closeAlertModal = () => {
    setCustomModal({ visible: false, title: '', message: '', type: 'info' });
  };

  const getCurrentMonthLabel = () => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const d = new Date();
    return `${months[d.getMonth()]} / ${d.getFullYear()}`;
  };

  useEffect(() => {
    fetchConfigAndProfile();
  }, []);

  const fetchConfigAndProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email);

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('name, name_change_requested, can_edit_name, role')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profileError && profileError.code !== 'PGRST116') {
        console.error("Erro ao buscar perfil.", profileError);
      }

      if (profileData) {
        setUserRole(profileData.role);
        const loadedName = profileData.name || '';
        setDisplayName(loadedName);
        setOriginalName(loadedName);
        setNameChangeRequested(profileData.name_change_requested || false);
        setCanEditName(profileData.role === 'admin' ? true : (profileData.can_edit_name || false));
      }

      const { data: configs } = await supabase
        .from('crm_boards')
        .select('data_payload')
        .eq('id', `config_${user.id}`)
        .order('id', { ascending: false })
        .limit(1);
      
      const configData = configs && configs.length > 0 ? configs[0] : null;

      if (configData && configData.data_payload) {
        const p = configData.data_payload;
        setMonthlyGoal(p.monthlyGoal || '2.500.000');
        setDailyCalls(p.dailyCalls || '15');
        setDailyNeg(p.dailyNeg || '5');
        setDailySims(p.dailySims || '3');
        setTicketMedio(p.ticketMedio || '100.000');
        setConversionRateGoal(p.conversionRateGoal || '12');
        setGoalHistory(p.goalHistory || []);
      } else {
        const defaultHistory = [
          { id: 1, month: 'Julho / 2026', goal: '2.000.000', reached: '2.430.000', status: 'success' },
          { id: 2, month: 'Junho / 2026', goal: '1.800.000', reached: '1.500.000', status: 'warning' },
        ];
        const defaultData = {
          monthlyGoal: '2.500.000', dailyCalls: '15', dailyNeg: '5', dailySims: '3', 
          ticketMedio: '100.000', conversionRateGoal: '12', goalHistory: defaultHistory
        };
        await supabase.from('crm_boards').insert([{ id: `config_${user.id}`, user_id: user.id, data_payload: defaultData }]);
        
        setMonthlyGoal(defaultData.monthlyGoal);
        setDailyCalls(defaultData.dailyCalls);
        setDailyNeg(defaultData.dailyNeg);
        setDailySims(defaultData.dailySims);
        setTicketMedio(defaultData.ticketMedio);
        setConversionRateGoal(defaultData.conversionRateGoal);
        setGoalHistory(defaultHistory);
      }
    } catch (err) {
      showAlertModal("Erro de Conexão", "Não foi possível carregar os dados.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNameChange = async () => {
    try {
      setRequestingNameChange(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('user_profiles').update({ 
        name_change_requested: true,
        old_name: originalName 
      }).eq('id', user.id);

      if (error) throw error;

      setNameChangeRequested(true);
      showAlertModal("Solicitação Enviada", "O administrador avaliará a alteração do seu nome.", "success");
    } catch (err) {
      showAlertModal("Erro", "Não foi possível enviar a solicitação.", "error");
    } finally {
      setRequestingNameChange(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Atualiza estritamente a tabela de configurações do usuário
      const updatedConfig = { monthlyGoal, dailyCalls, dailyNeg, dailySims, ticketMedio, conversionRateGoal, goalHistory };
      const { error: configError } = await supabase
        .from('crm_boards')
        .update({ data_payload: updatedConfig })
        .eq('id', `config_${user.id}`);

      if (configError) throw configError;

      const hasChanged = originalName !== displayName;
      if (hasChanged) {
        const updatePayload = { name: displayName };
        
        if (userRole !== 'admin') {
          updatePayload.can_edit_name = false;
          updatePayload.name_change_requested = false;
          updatePayload.name_change_alert = true;
        }

        const { error: profileError } = await supabase
          .from('user_profiles')
          .update(updatePayload)
          .eq('id', user.id);

        if (profileError) throw profileError;
        
        setOriginalName(displayName);
        if (userRole !== 'admin') {
          setCanEditName(false);
          setNameChangeRequested(false);
        }
      }
      
      // Notifica o componente pai apenas para atualizar perfis, sem mexer no payload do Kanban
      if (onConfigSaved) {
        onConfigSaved();
      }

      showAlertModal("Salvo com Sucesso", "Suas configurações foram atualizadas.", "success");
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
      showAlertModal("Erro", "Ocorreu um erro ao salvar as configurações.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    const validatePassword = (pwd) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/.test(pwd);
    if (!validatePassword(newPass)) {
      showAlertModal("Senha Inválida", "A senha requer 6 caracteres, contendo maiúscula, minúscula, número e símbolo.", "error");
      return;
    }
    if (newPass !== newPassConfirm) {
      showAlertModal("Erro", "As senhas informadas não coincidem.", "error");
      return;
    }

    setIsChangingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      showAlertModal("Senha Atualizada", "Sua senha de acesso foi alterada.", "success");
      setNewPass('');
      setNewPassConfirm('');
    } catch (err) {
      showAlertModal("Erro", "Erro ao alterar senha: " + err.message, "error");
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleCurrencyChange = (text) => {
    const rawNumber = text.replace(/\D/g, '');
    if (!rawNumber) return setMonthlyGoal('');
    setMonthlyGoal(new Intl.NumberFormat('pt-BR').format(parseInt(rawNumber, 10)));
  };

  const handleTicketCurrencyChange = (text) => {
    const rawNumber = text.replace(/\D/g, '');
    if (!rawNumber) return setTicketMedio('');
    setTicketMedio(new Intl.NumberFormat('pt-BR').format(parseInt(rawNumber, 10)));
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Configurações</Text>
          <Text style={styles.pageSubtitle}>Ajuste suas metas e credenciais</Text>
        </View>

        <View style={[styles.grid, isMobile && styles.gridMobile]}>
          
          <View style={styles.column}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Identidade</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput style={[styles.input, styles.inputDisabled]} value={userEmail} editable={false} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome de Exibição</Text>
                <View style={styles.rowInline}>
                  <TextInput 
                    style={[styles.input, { flex: 1 }, !canEditName && styles.inputDisabled]} 
                    value={displayName} 
                    onChangeText={setDisplayName} 
                    editable={canEditName} 
                  />
                  {userRole !== 'admin' && !canEditName && (
                    <TouchableOpacity 
                      style={[styles.requestButton, nameChangeRequested && styles.requestButtonDisabled]} 
                      onPress={handleRequestNameChange} 
                      disabled={nameChangeRequested || requestingNameChange}
                    >
                      <Text style={styles.requestButtonText}>
                        {nameChangeRequested ? 'Pendente' : 'Alterar'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Segurança</Text>
              <View style={styles.inputGroup}>
                <TextInput style={styles.input} secureTextEntry value={newPass} onChangeText={setNewPass} placeholder="Nova Senha" />
              </View>
              <View style={styles.inputGroup}>
                <TextInput style={styles.input} secureTextEntry value={newPassConfirm} onChangeText={setNewPassConfirm} placeholder="Confirmar Senha" />
              </View>
              <TouchableOpacity style={[styles.secondaryButton, isChangingPass && { opacity: 0.7 }]} onPress={handleUpdatePassword} disabled={isChangingPass}>
                <Text style={styles.secondaryButtonText}>{isChangingPass ? 'Atualizando...' : 'Atualizar Senha'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Meta ({getCurrentMonthLabel()})</Text>
              <View style={styles.currencyInputContainer}>
                <Text style={styles.currencySymbol}>R$</Text>
                <TextInput style={styles.currencyInput} value={monthlyGoal} onChangeText={handleCurrencyChange} keyboardType="numeric" placeholder="0" />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Parâmetros (Diários)</Text>
              <View style={[styles.row, isMobile && styles.rowMobile]}>
                <View style={styles.inputGroupRow}>
                  <Text style={styles.label}>Ligações</Text>
                  <TextInput style={styles.inputSmall} value={dailyCalls} onChangeText={setDailyCalls} keyboardType="numeric" />
                </View>
                <View style={styles.inputGroupRow}>
                  <Text style={styles.label}>Simulações</Text>
                  <TextInput style={styles.inputSmall} value={dailySims} onChangeText={setDailySims} keyboardType="numeric" />
                </View>
                <View style={styles.inputGroupRow}>
                  <Text style={styles.label}>Negociações</Text>
                  <TextInput style={styles.inputSmall} value={dailyNeg} onChangeText={setDailyNeg} keyboardType="numeric" />
                </View>
              </View>
              <View style={[styles.row, { marginTop: 12 }, isMobile && styles.rowMobile]}>
                <View style={styles.inputGroupRow}>
                  <Text style={styles.label}>Ticket Médio (R$)</Text>
                  <TextInput style={styles.input} value={ticketMedio} onChangeText={handleTicketCurrencyChange} keyboardType="numeric" />
                </View>
                <View style={styles.inputGroupRow}>
                  <Text style={styles.label}>Conversão (%)</Text>
                  <TextInput style={styles.input} value={conversionRateGoal} onChangeText={setConversionRateGoal} keyboardType="numeric" />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Histórico</Text>
              <View style={styles.historyList}>
                {goalHistory.map((item) => (
                  <View key={item.id} style={styles.historyItem}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyMonth}>{item.month}</Text>
                      <View style={[styles.statusBadge, item.status === 'success' ? styles.badgeSuccess : styles.badgeWarning]}>
                        <Text style={[styles.statusBadgeText, item.status === 'success' ? styles.badgeSuccessText : styles.badgeWarningText]}>
                          {item.status === 'success' ? 'Meta Batida' : 'Abaixo da Meta'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.historyDataRow}>
                      <View>
                        <Text style={styles.historyDataLabel}>Meta Fixada</Text>
                        <Text style={styles.historyDataValue}>R$ {item.goal}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.historyDataLabel}>Alcançado</Text>
                        <Text style={[styles.historyDataValue, { color: item.status === 'success' ? '#059669' : '#d97706' }]}>
                          R$ {item.reached}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>

        </View>

        <TouchableOpacity style={[styles.saveButton, saving && { backgroundColor: '#94a3b8' }]} onPress={handleSaveConfig} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar Configurações'}</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={customModal.visible} transparent={true} animationType="fade" onRequestClose={closeAlertModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderBar}>
              <Text style={styles.modalHeaderTitle}>{customModal.title}</Text>
            </View>
            <Text style={styles.modalMessageText}>{customModal.message}</Text>
            <TouchableOpacity style={styles.modalButtonPrimary} onPress={closeAlertModal}>
              <Text style={styles.modalButtonPrimaryText}>Compreendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 16, maxWidth: 1100, marginHorizontal: 'auto', width: '100%', flexGrow: 1, paddingBottom: 24 },
  header: { marginBottom: 16, alignItems: 'center' },
  pageTitle: { fontFamily: MODERN_FONT, fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  pageSubtitle: { fontFamily: MODERN_FONT, fontSize: 13, color: '#64748b', marginTop: 4 },
  grid: { flexDirection: 'row', gap: 16, flex: 1 },
  gridMobile: { flexDirection: 'column' },
  column: { flex: 1 },
  card: { backgroundColor: '#ffffff', borderRadius: 10, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', ...Platform.select({ web: { boxShadow: '0px 1px 4px rgba(0,0,0,0.03)' } }) },
  cardTitle: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 6 },
  inputGroup: { marginBottom: 12 },
  label: { fontFamily: MODERN_FONT, fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4 },
  input: { fontFamily: MODERN_FONT, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, color: '#0f172a', ...Platform.select({ web: { outlineStyle: 'none' } }) },
  inputDisabled: { backgroundColor: '#f1f5f9', color: '#94a3b8', borderColor: '#e2e8f0' },
  rowInline: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  requestButton: { backgroundColor: '#0f172a', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, justifyContent: 'center' },
  requestButtonDisabled: { backgroundColor: '#94a3b8' },
  requestButtonText: { fontFamily: MODERN_FONT, color: '#ffffff', fontSize: 11, fontWeight: '700' },
  currencyInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, overflow: 'hidden' },
  currencySymbol: { fontFamily: MODERN_FONT, fontSize: 12, fontWeight: '700', color: '#64748b', paddingLeft: 12, paddingRight: 6 },
  currencyInput: { flex: 1, fontFamily: MODERN_FONT, paddingVertical: 8, paddingRight: 12, fontSize: 13, fontWeight: '700', color: '#0f172a', ...Platform.select({ web: { outlineStyle: 'none' } }) },
  row: { flexDirection: 'row', gap: 12 },
  rowMobile: { flexDirection: 'column', gap: 10 },
  inputGroupRow: { flex: 1 },
  inputSmall: { fontFamily: MODERN_FONT, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: '#0f172a', textAlign: 'center', ...Platform.select({ web: { outlineStyle: 'none' } }) },
  saveButton: { backgroundColor: '#2563eb', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 40, alignItems: 'center', alignSelf: 'center', marginTop: 'auto', ...Platform.select({ web: { boxShadow: '0px 4px 12px rgba(37,99,235,0.3)' } }) },
  saveButtonText: { fontFamily: MODERN_FONT, color: '#ffffff', fontSize: 13, fontWeight: '700' },
  secondaryButton: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  secondaryButtonText: { fontFamily: MODERN_FONT, color: '#475569', fontSize: 12, fontWeight: '700' },
  historyList: { marginTop: 4 },
  historyItem: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  historyMonth: { fontFamily: MODERN_FONT, fontSize: 12, fontWeight: '700', color: '#334155' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeSuccess: { backgroundColor: '#dcfce7' },
  badgeWarning: { backgroundColor: '#fef3c7' },
  statusBadgeText: { fontFamily: MODERN_FONT, fontSize: 9, fontWeight: '700' },
  badgeSuccessText: { color: '#16a34a' },
  badgeWarningText: { color: '#d97706' },
  historyDataRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
  historyDataLabel: { fontFamily: MODERN_FONT, fontSize: 10, color: '#64748b', fontWeight: '600', marginBottom: 2 },
  historyDataValue: { fontFamily: MODERN_FONT, fontSize: 12, fontWeight: '800', color: '#0f172a' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: '#ffffff', borderRadius: 12, padding: 20, width: '90%', maxWidth: 320, ...Platform.select({ web: { boxShadow: '0px 10px 30px rgba(0,0,0,0.15)' } }) },
  modalHeaderBar: { marginBottom: 12 },
  modalHeaderTitle: { fontFamily: MODERN_FONT, fontSize: 16, fontWeight: '800', color: '#0f172a' },
  modalMessageText: { fontFamily: MODERN_FONT, fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 20 },
  modalButtonPrimary: { backgroundColor: '#2563eb', borderRadius: 6, paddingVertical: 10, alignItems: 'center' },
  modalButtonPrimaryText: { fontFamily: MODERN_FONT, color: '#ffffff', fontSize: 12, fontWeight: '700' }
});