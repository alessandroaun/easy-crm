import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient'; // Importação do banco de dados

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function Configuracao() {
  const { width } = useWindowDimensions();
  const isMobile = width < 850;

  // Estados de Carregamento
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados dos parâmetros
  const [name, setName] = useState(''); 
  const [monthlyGoal, setMonthlyGoal] = useState('');
  const [dailyCalls, setDailyCalls] = useState('');
  const [dailyNeg, setDailyNeg] = useState('');
  const [dailySims, setDailySims] = useState('');
  const [goalHistory, setGoalHistory] = useState([]);

  // Retorna o Mês/Ano atual formatado (ex: "Agosto / 2026")
  const getCurrentMonthLabel = () => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const d = new Date();
    return `${months[d.getMonth()]} / ${d.getFullYear()}`;
  };

  // Carrega os dados do Supabase ao abrir a tela
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      // Busca as configurações na tabela genérica crm_boards usando o ID 'crm_config'
      const { data, error } = await supabase.from('crm_boards').select('data_payload').eq('id', 'crm_config').maybeSingle();
      if (error) throw error;

      if (data && data.data_payload) {
        const p = data.data_payload;
        setName(p.name || 'Alessandro Uchoa');
        setMonthlyGoal(p.monthlyGoal || '2.500.000');
        setDailyCalls(p.dailyCalls || '15');
        setDailyNeg(p.dailyNeg || '5');
        setDailySims(p.dailySims || '3');
        setGoalHistory(p.goalHistory || []);
      } else {
        // Se for a primeira vez que abre, cria o registro padrão no banco
        const defaultHistory = [
          { id: 1, month: 'Julho / 2026', goal: '2.000.000', reached: '2.430.000', status: 'success' },
          { id: 2, month: 'Junho / 2026', goal: '1.800.000', reached: '1.500.000', status: 'warning' },
        ];
        const defaultData = {
          name: 'Alessandro Uchoa', monthlyGoal: '2.500.000', dailyCalls: '15', dailyNeg: '5', dailySims: '3', goalHistory: defaultHistory
        };
        
        await supabase.from('crm_boards').insert([{ id: 'crm_config', data_payload: defaultData }]);
        
        setName(defaultData.name);
        setMonthlyGoal(defaultData.monthlyGoal);
        setDailyCalls(defaultData.dailyCalls);
        setDailyNeg(defaultData.dailyNeg);
        setDailySims(defaultData.dailySims);
        setGoalHistory(defaultHistory);
      }
    } catch (err) {
      console.error("Erro ao buscar configurações:", err);
      alert("Erro ao carregar as configurações do banco de dados.");
    } finally {
      setLoading(false);
    }
  };

  // Salva definitivamente no Supabase
  const handleSaveConfig = async () => {
    setSaving(true);
    const updatedConfig = {
      name, monthlyGoal, dailyCalls, dailyNeg, dailySims, goalHistory
    };

    try {
      const { error } = await supabase.from('crm_boards').update({ data_payload: updatedConfig }).eq('id', 'crm_config');
      if (error) throw error;
      
      alert('✅ Sucesso! Suas metas e parâmetros foram salvos definitivamente na nuvem.');
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("❌ Ocorreu um erro ao tentar salvar as configurações.");
    } finally {
      setSaving(false);
    }
  };

  // Função para formatar o valor como moeda (R$ 1.500.000)
  const handleCurrencyChange = (text) => {
    const rawNumber = text.replace(/\D/g, '');
    if (!rawNumber) {
      setMonthlyGoal('');
      return;
    }
    const formattedNumber = new Intl.NumberFormat('pt-BR').format(parseInt(rawNumber, 10));
    setMonthlyGoal(formattedNumber);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ fontFamily: MODERN_FONT, marginTop: 12, color: '#64748b' }}>Carregando dados da nuvem...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Configurações do Sistema</Text>
        <Text style={styles.pageSubtitle}>Ajuste suas metas e defina os parâmetros analíticos da sua operação.</Text>
      </View>

      <View style={[styles.grid, isMobile && styles.gridMobile]}>
        
        {/* COLUNA ESQUERDA: Formulários de Configuração */}
        <View style={styles.formColumn}>
          
          {/* Card: Perfil */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Perfil do Consultor</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome de Exibição</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Seu nome completo" />
            </View>
          </View>

          {/* Card: Meta de Vendas */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Meta Mensal ({getCurrentMonthLabel()})</Text>
            <Text style={styles.cardDescription}>Volume total de créditos de consórcio que você deseja comercializar este mês.</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Valor da Meta (R$)</Text>
              <View style={styles.currencyInputContainer}>
                <Text style={styles.currencySymbol}>R$</Text>
                <TextInput 
                  style={styles.currencyInput} 
                  value={monthlyGoal} 
                  onChangeText={handleCurrencyChange} 
                  keyboardType="numeric" 
                  placeholder="0.000.000" 
                />
              </View>
            </View>
          </View>

          {/* Card: Metas Operacionais */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Parâmetros Diários</Text>
            <Text style={styles.cardDescription}>O CRM usará estes números como base para gerar seus insights operacionais.</Text>
            
            <View style={[styles.row, isMobile && styles.rowMobile]}>
              <View style={styles.inputGroupRow}>
                <Text style={styles.label}>Ligações p/ dia</Text>
                <TextInput style={styles.inputSmall} value={dailyCalls} onChangeText={setDailyCalls} keyboardType="numeric" />
              </View>
              <View style={styles.inputGroupRow}>
                <Text style={styles.label}>Simulações p/ dia</Text>
                <TextInput style={styles.inputSmall} value={dailySims} onChangeText={setDailySims} keyboardType="numeric" />
              </View>
              <View style={styles.inputGroupRow}>
                <Text style={styles.label}>Em Negociação</Text>
                <TextInput style={styles.inputSmall} value={dailyNeg} onChangeText={setDailyNeg} keyboardType="numeric" />
              </View>
            </View>
          </View>

          <TouchableOpacity style={[styles.saveButton, saving && { backgroundColor: '#94a3b8' }]} onPress={handleSaveConfig} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar Configurações'}</Text>
          </TouchableOpacity>

        </View>

        {/* COLUNA DIREITA: Histórico */}
        <View style={styles.historyColumn}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Histórico de Performance</Text>
            <Text style={styles.cardDescription}>Resumo dos meses anteriores com base no volume de crédito.</Text>
            
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
                      <Text style={[styles.historyDataValue, { color: item.status === 'success' ? '#10b981' : '#f59e0b' }]}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 24, maxWidth: 1200, marginHorizontal: 'auto', width: '100%', paddingBottom: 40 },
  
  header: { marginBottom: 32 },
  pageTitle: { fontFamily: MODERN_FONT, fontSize: 28, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  pageSubtitle: { fontFamily: MODERN_FONT, fontSize: 15, color: '#64748b', marginTop: 6 },
  
  grid: { flexDirection: 'row', gap: 24 },
  gridMobile: { flexDirection: 'column' },
  
  formColumn: { flex: 1.5 },
  historyColumn: { flex: 1 },
  
  card: { 
    backgroundColor: '#ffffff', 
    borderRadius: 12, 
    padding: 24, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({ web: { boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' } })
  },
  cardTitle: { fontFamily: MODERN_FONT, fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
  cardDescription: { fontFamily: MODERN_FONT, fontSize: 13, color: '#64748b', marginBottom: 20 },
  
  inputGroup: { marginBottom: 16 },
  label: { fontFamily: MODERN_FONT, fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  input: { 
    fontFamily: MODERN_FONT, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', 
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#0f172a',
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
  
  currencyInputContainer: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, 
    borderColor: '#cbd5e1', borderRadius: 8, overflow: 'hidden' 
  },
  currencySymbol: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: '700', color: '#64748b', paddingLeft: 16, paddingRight: 8 },
  currencyInput: { 
    flex: 1, fontFamily: MODERN_FONT, paddingVertical: 12, paddingRight: 16, fontSize: 15, fontWeight: '600', color: '#0f172a',
    ...Platform.select({ web: { outlineStyle: 'none' } }) 
  },
  
  row: { flexDirection: 'row', gap: 16 },
  rowMobile: { flexDirection: 'column', gap: 12 },
  inputGroupRow: { flex: 1 },
  inputSmall: {
    fontFamily: MODERN_FONT, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', 
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#0f172a', textAlign: 'center',
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },

  saveButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  saveButtonText: { fontFamily: MODERN_FONT, color: '#ffffff', fontSize: 15, fontWeight: '700' },

  historyList: { marginTop: 8 },
  historyItem: { 
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 16, marginBottom: 12 
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  historyMonth: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: '700', color: '#334155' },
  
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeSuccess: { backgroundColor: '#d1fae5' },
  badgeWarning: { backgroundColor: '#fef3c7' },
  statusBadgeText: { fontFamily: MODERN_FONT, fontSize: 11, fontWeight: '700' },
  badgeSuccessText: { color: '#059669' },
  badgeWarningText: { color: '#d97706' },

  historyDataRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12 },
  historyDataLabel: { fontFamily: MODERN_FONT, fontSize: 11, color: '#64748b', fontWeight: '600', marginBottom: 4 },
  historyDataValue: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: '800', color: '#0f172a' },
});