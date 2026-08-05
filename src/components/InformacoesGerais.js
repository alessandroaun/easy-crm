import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

// Utilitários de Conversão
const parseMoney = (val) => {
  if (!val) return 0;
  const s = String(val);
  if (s.includes(',')) return parseInt(s.split(',')[0].replace(/\D/g, ''), 10) || 0;
  return parseInt(s.replace(/\D/g, ''), 10) || 0;
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const parseCustomDate = (dateStr) => {
  if (!dateStr || dateStr.length !== 10) return null;
  const [day, month, year] = dateStr.split('/');
  return new Date(`${year}-${month}-${day}T12:00:00Z`);
};

export default function InformacoesGerais() {
  const { width } = useWindowDimensions();
  const isMobile = width < 850;

  const [loading, setLoading] = useState(true);
  const [boardData, setBoardData] = useState(null);
  
  // Filtros
  const [filterType, setFilterType] = useState('current');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    const fetchBoardData = async () => {
      try {
        const { data, error } = await supabase.from('crm_boards').select('data_payload').eq('id', 'crm_principal').maybeSingle();
        if (error) throw error;
        if (data) setBoardData(data.data_payload);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBoardData();
  }, []);

  // MOTOR DE CÁLCULO E BUSINESS INTELLIGENCE
  const reportData = useMemo(() => {
    if (!boardData || !boardData.phases) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let totalLeads = 0;
    let countNegociacao = 0, countTentativa = 0, countPerdido = 0, countFechado = 0;
    
    // Contadores de Esforço (Interações)
    let totalCalls = 0, totalWA = 0, totalSims = 0;
    let closedCalls = 0, closedWA = 0, closedSims = 0;
    let lostCalls = 0, lostWA = 0, lostSims = 0;

    const financialSums = { novo: 0, tentou: 0, contato: 0, negociacao: 0, standby: 0, fechado: 0, perdido: 0 };

    const processClient = (client, isTrash = false) => {
      const createdDate = new Date(client.createdAt || Date.now());
      let includeClient = false;
      
      if (filterType === 'current') {
        includeClient = createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
      } else if (filterType === 'previous') {
        includeClient = createdDate.getMonth() === previousMonth && createdDate.getFullYear() === previousYear;
      } else if (filterType === 'custom') {
        const start = parseCustomDate(customStart);
        const end = parseCustomDate(customEnd);
        if (start && end) {
          end.setHours(23, 59, 59, 999);
          includeClient = createdDate >= start && createdDate <= end;
        } else {
          includeClient = true; 
        }
      }

      if (includeClient) {
        totalLeads++;
        const credit = parseMoney(client.desiredCredit || 0);

        // Identifica a fase do cliente
        let isNovo = false, isTentou = false, isContato = false, isNegociacao = false, isStandby = false, isFechado = false, isPerdido = false;
        
        if (isTrash) {
          isPerdido = true;
        } else {
          const phaseTitle = (client.phaseTitle || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          isNovo = phaseTitle.includes('novo');
          isTentou = phaseTitle.includes('tentou');
          isContato = phaseTitle.includes('contato');
          isNegociacao = phaseTitle.includes('negocia');
          isStandby = phaseTitle.includes('stand');
          isFechado = phaseTitle.includes('fechad');
          isPerdido = phaseTitle.includes('perdid');
        }

        // Somas Financeiras
        if (isNovo) financialSums.novo += credit;
        if (isTentou) { financialSums.tentou += credit; countTentativa++; }
        if (isContato) financialSums.contato += credit;
        if (isNegociacao) { financialSums.negociacao += credit; countNegociacao++; }
        if (isStandby) financialSums.standby += credit;
        if (isFechado) { financialSums.fechado += credit; countFechado++; }
        if (isPerdido) { financialSums.perdido += credit; countPerdido++; }

        // Contagem de Esforços (Interações deste lead)
        let leadCalls = 0, leadWA = 0, leadSims = 0;
        
        if (client.comments) {
          client.comments.forEach(c => {
            const txt = c.text.toLowerCase();
            if (txt.includes('botão de ligar')) leadCalls++;
            if (txt.includes('falar no whatsapp')) leadWA++;
          });
        }
        if (client.appointments) {
          client.appointments.forEach(a => {
            const txt = (a.title || a.type || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (txt.includes('simulaca')) leadSims++;
          });
        }

        totalCalls += leadCalls;
        totalWA += leadWA;
        totalSims += leadSims;

        if (isFechado) { closedCalls += leadCalls; closedWA += leadWA; closedSims += leadSims; }
        if (isPerdido) { lostCalls += leadCalls; lostWA += leadWA; lostSims += leadSims; }
      }
    };

    // Varre o Kanban
    boardData.phases.forEach(phase => {
      phase.clients.forEach(client => processClient({ ...client, phaseTitle: phase.title }, false));
    });

    // Varre a Lixeira (Considerado Perdido)
    if (boardData.trash) {
      boardData.trash.forEach(client => processClient(client, true));
    }

    // KPIs e Taxas
    const txNegociacao = totalLeads > 0 ? ((countNegociacao / totalLeads) * 100).toFixed(1) : 0;
    const txConversao = totalLeads > 0 ? ((countFechado / totalLeads) * 100).toFixed(1) : 0;
    const txPerda = totalLeads > 0 ? ((countPerdido / totalLeads) * 100).toFixed(1) : 0;
    const ticketMedio = countFechado > 0 ? (financialSums.fechado / countFechado) : 0;
    const totalFinanceiro = Object.values(financialSums).reduce((a, b) => a + b, 0);

    // Esforço Médio (Média de toques por tipo de lead)
    const avgClosedTouches = countFechado > 0 ? ((closedCalls + closedWA + closedSims) / countFechado).toFixed(1) : 0;
    const avgLostTouches = countPerdido > 0 ? ((lostCalls + lostWA + lostSims) / countPerdido).toFixed(1) : 0;

    return {
      totalLeads, countFechado, countPerdido,
      txNegociacao, txConversao, txPerda, ticketMedio,
      financialSums, totalFinanceiro,
      efforts: {
        totalCalls, totalWA, totalSims,
        avgClosedTouches, avgLostTouches,
        closedCalls: countFechado > 0 ? (closedCalls/countFechado).toFixed(1) : 0,
        closedWA: countFechado > 0 ? (closedWA/countFechado).toFixed(1) : 0,
      }
    };

  }, [boardData, filterType, customStart, customEnd]);

  const handleDateMask = (text, setter) => {
    let cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 2) cleaned = cleaned.replace(/^(\d{2})(\d)/, '$1/$2');
    if (cleaned.length > 5) cleaned = cleaned.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
    setter(cleaned.substring(0, 10));
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  // Mini Componente para Barra Horizontal
  const HorizontalBar = ({ label, value, percent, color }) => (
    <View style={styles.barContainer}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* HEADER & CONTROLE DE FILTROS */}
      <View style={[styles.headerArea, isMobile && styles.headerAreaMobile]}>
        <View>
          <Text style={styles.pageTitle}>Visão Geral Analítica</Text>
          <Text style={styles.pageSubtitle}>Acompanhamento de conversões, carteira e métricas operacionais.</Text>
        </View>

        <View style={[styles.filterGroup, isMobile && styles.filterGroupMobile]}>
          <TouchableOpacity style={[styles.filterBtn, filterType === 'current' && styles.filterBtnActive]} onPress={() => setFilterType('current')}>
            <Text style={[styles.filterText, filterType === 'current' && styles.filterTextActive]}>Mês Atual</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, filterType === 'previous' && styles.filterBtnActive]} onPress={() => setFilterType('previous')}>
            <Text style={[styles.filterText, filterType === 'previous' && styles.filterTextActive]}>Mês Anterior</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, filterType === 'custom' && styles.filterBtnActive]} onPress={() => setFilterType('custom')}>
            <Text style={[styles.filterText, filterType === 'custom' && styles.filterTextActive]}>Período</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* INPUTS PARA PERÍODO PERSONALIZADO */}
      {filterType === 'custom' && (
        <View style={styles.customDateWrapper}>
          <View style={styles.customDateInputBox}>
            <Text style={styles.customDateLabel}>Data Inicial</Text>
            <TextInput style={styles.customDateInput} placeholder="DD/MM/AAAA" value={customStart} onChangeText={t => handleDateMask(t, setCustomStart)} keyboardType="numeric" maxLength={10} />
          </View>
          <View style={styles.customDateInputBox}>
            <Text style={styles.customDateLabel}>Data Final</Text>
            <TextInput style={styles.customDateInput} placeholder="DD/MM/AAAA" value={customEnd} onChangeText={t => handleDateMask(t, setCustomEnd)} keyboardType="numeric" maxLength={10} />
          </View>
        </View>
      )}

      {/* PAINEL DE KPIs PRINCIPAIS */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <View style={styles.kpiIconWrapper}><Text style={styles.kpiIcon}>👥</Text></View>
          <Text style={styles.kpiTitle}>Total de Leads</Text>
          <Text style={styles.kpiValue}>{reportData?.totalLeads}</Text>
        </View>
        
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#dcfce7' }]}><Text style={styles.kpiIcon}>✅</Text></View>
          <Text style={styles.kpiTitle}>Taxa de Conversão</Text>
          <Text style={[styles.kpiValue, { color: '#059669' }]}>{reportData?.txConversao}%</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#fee2e2' }]}><Text style={styles.kpiIcon}>📉</Text></View>
          <Text style={styles.kpiTitle}>Taxa de Perda</Text>
          <Text style={[styles.kpiValue, { color: '#dc2626' }]}>{reportData?.txPerda}%</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#e0e7ff' }]}><Text style={styles.kpiIcon}>💎</Text></View>
          <Text style={styles.kpiTitle}>Ticket Médio Fechado</Text>
          <Text style={[styles.kpiValue, { color: '#4f46e5', fontSize: 24, marginTop: 10 }]}>{formatCurrency(reportData?.ticketMedio)}</Text>
        </View>
      </View>

      {/* SESSÕES DETALHADAS */}
      <View style={[styles.mainLayout, isMobile && styles.mainLayoutMobile]}>
        
        {/* COLUNA ESQUERDA: Funil e Esforço */}
        <View style={styles.leftColumn}>
          
          {/* Card: Funil de Conversão */}
          <View style={styles.dashboardCard}>
            <Text style={styles.cardHeader}>Funil de Vendas</Text>
            <Text style={styles.cardSubHeader}>Trajetória dos leads capturados no período selecionado.</Text>
            
            <View style={styles.chartArea}>
              <HorizontalBar label="1. Entraram na Base (100%)" value={`${reportData?.totalLeads} Leads`} percent={100} color="#94a3b8" />
              <HorizontalBar label={`2. Avançaram p/ Negociação (${reportData?.txNegociacao}%)`} value={`${reportData?.txNegociacao}%`} percent={reportData?.txNegociacao} color="#3b82f6" />
              <HorizontalBar label={`3. Vendas Fechadas (${reportData?.txConversao}%)`} value={`${reportData?.countFechado} Leads`} percent={reportData?.txConversao} color="#10b981" />
            </View>
          </View>

          {/* Card: NOVO GRÁFICO - Esforço vs Conversão */}
          <View style={styles.dashboardCard}>
            <Text style={styles.cardHeader}>Esforço Operacional vs. Resultado</Text>
            <Text style={styles.cardSubHeader}>Qual o custo de interação para fechar um negócio?</Text>
            
            <View style={styles.effortGrid}>
              <View style={styles.effortBox}>
                <Text style={styles.effortLabel}>Média de Toques p/ Fechar</Text>
                <Text style={styles.effortNumber}>{reportData?.efforts.avgClosedTouches} <Text style={styles.effortMetric}>interações</Text></Text>
                <Text style={styles.effortDesc}>Ligações, WA e Simulações geram conversão.</Text>
              </View>
              <View style={styles.effortBox}>
                <Text style={styles.effortLabel}>Média de Toques p/ Perder</Text>
                <Text style={[styles.effortNumber, {color: '#dc2626'}]}>{reportData?.efforts.avgLostTouches} <Text style={styles.effortMetric}>interações</Text></Text>
                <Text style={styles.effortDesc}>Muito esforço sem conversão = Redefinir perfil.</Text>
              </View>
            </View>

            <View style={styles.chartArea}>
              <Text style={styles.cardHeaderSmall}>Anatomia da Venda Fechada (Média por Lead)</Text>
              <HorizontalBar label="Ligações por Venda" value={`${reportData?.efforts.closedCalls} chamadas`} percent={Math.min(reportData?.efforts.closedCalls * 15, 100)} color="#8b5cf6" />
              <HorizontalBar label="WhatsApp por Venda" value={`${reportData?.efforts.closedWA} mensagens`} percent={Math.min(reportData?.efforts.closedWA * 10, 100)} color="#22c55e" />
            </View>
          </View>

        </View>

        {/* COLUNA DIREITA: Carteira Financeira */}
        <View style={styles.rightColumn}>
          <View style={[styles.dashboardCard, { backgroundColor: '#0f172a' }]}>
            <Text style={[styles.cardHeader, { color: '#f8fafc' }]}>Carteira Financeira (Filtro)</Text>
            <Text style={styles.financialTotalValue}>{formatCurrency(reportData?.totalFinanceiro)}</Text>
            <Text style={[styles.cardSubHeader, { color: '#94a3b8' }]}>Volume total de crédito em trânsito no período.</Text>

            <View style={styles.financialDivider} />

            <View style={styles.financialList}>
              <View style={styles.finItem}><View style={styles.finLeft}><View style={[styles.finDot, {backgroundColor: '#94a3b8'}]} /><Text style={[styles.finLabel, {color: '#cbd5e1'}]}>Novo Cliente</Text></View><Text style={styles.finValue}>{formatCurrency(reportData?.financialSums.novo)}</Text></View>
              <View style={styles.finItem}><View style={styles.finLeft}><View style={[styles.finDot, {backgroundColor: '#f59e0b'}]} /><Text style={[styles.finLabel, {color: '#cbd5e1'}]}>Tentou Contato</Text></View><Text style={styles.finValue}>{formatCurrency(reportData?.financialSums.tentou)}</Text></View>
              <View style={styles.finItem}><View style={styles.finLeft}><View style={[styles.finDot, {backgroundColor: '#38bdf8'}]} /><Text style={[styles.finLabel, {color: '#cbd5e1'}]}>Contato Realizado</Text></View><Text style={styles.finValue}>{formatCurrency(reportData?.financialSums.contato)}</Text></View>
              <View style={styles.finItem}><View style={styles.finLeft}><View style={[styles.finDot, {backgroundColor: '#3b82f6'}]} /><Text style={[styles.finLabel, {color: '#60a5fa', fontWeight: 'bold'}]}>Em Negociação</Text></View><Text style={[styles.finValue, {color: '#60a5fa', fontWeight: 'bold'}]}>{formatCurrency(reportData?.financialSums.negociacao)}</Text></View>
              <View style={styles.finItem}><View style={styles.finLeft}><View style={[styles.finDot, {backgroundColor: '#a855f7'}]} /><Text style={[styles.finLabel, {color: '#cbd5e1'}]}>Stand By</Text></View><Text style={styles.finValue}>{formatCurrency(reportData?.financialSums.standby)}</Text></View>
              <View style={styles.finItem}><View style={styles.finLeft}><View style={[styles.finDot, {backgroundColor: '#10b981'}]} /><Text style={[styles.finLabel, {color: '#34d399', fontWeight: 'bold'}]}>Fechados</Text></View><Text style={[styles.finValue, {color: '#34d399', fontWeight: 'bold'}]}>{formatCurrency(reportData?.financialSums.fechado)}</Text></View>
              <View style={[styles.finItem, { borderBottomWidth: 0 }]}><View style={styles.finLeft}><View style={[styles.finDot, {backgroundColor: '#ef4444'}]} /><Text style={[styles.finLabel, {color: '#f87171'}]}>Perdidos</Text></View><Text style={[styles.finValue, {color: '#f87171'}]}>{formatCurrency(reportData?.financialSums.perdido)}</Text></View>
            </View>
          </View>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 32, maxWidth: 1400, marginHorizontal: 'auto', width: '100%', paddingBottom: 60 },
  
  headerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 },
  headerAreaMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 16 },
  pageTitle: { fontFamily: MODERN_FONT, fontSize: 32, fontWeight: '900', color: '#0f172a', letterSpacing: -1 },
  pageSubtitle: { fontFamily: MODERN_FONT, fontSize: 15, color: '#64748b', marginTop: 4 },
  
  filterGroup: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 10, padding: 4, ...Platform.select({ web: { boxShadow: 'inset 0px 2px 4px rgba(0,0,0,0.05)' } }) },
  filterGroupMobile: { width: '100%', justifyContent: 'space-between' },
  filterBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  filterBtnActive: { backgroundColor: '#ffffff', ...Platform.select({ web: { boxShadow: '0px 2px 8px rgba(0,0,0,0.1)' } }) },
  filterText: { fontFamily: MODERN_FONT, fontSize: 13, fontWeight: '700', color: '#64748b' },
  filterTextActive: { color: '#0f172a' },

  customDateWrapper: { flexDirection: 'row', gap: 16, marginBottom: 24, padding: 20, backgroundColor: '#ffffff', borderRadius: 16, ...Platform.select({ web: { boxShadow: '0px 4px 15px rgba(0,0,0,0.03)' } }) },
  customDateInputBox: { flex: 1, maxWidth: 220 },
  customDateLabel: { fontFamily: MODERN_FONT, fontSize: 12, fontWeight: '800', color: '#475569', marginBottom: 8, textTransform: 'uppercase' },
  customDateInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: MODERN_FONT, ...Platform.select({ web: { outlineStyle: 'none' } }) },

  kpiGrid: { flexDirection: 'row', gap: 20, marginBottom: 32, flexWrap: 'wrap' },
  kpiCard: { flex: 1, minWidth: 220, backgroundColor: '#ffffff', borderRadius: 16, padding: 24, ...Platform.select({ web: { boxShadow: '0px 4px 20px rgba(0,0,0,0.04)' } }) },
  kpiIconWrapper: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  kpiIcon: { fontSize: 18 },
  kpiTitle: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: '700', color: '#64748b', marginBottom: 4 },
  kpiValue: { fontFamily: MODERN_FONT, fontSize: 38, fontWeight: '900', color: '#0f172a', letterSpacing: -1.5 },

  mainLayout: { flexDirection: 'row', gap: 32 },
  mainLayoutMobile: { flexDirection: 'column' },
  leftColumn: { flex: 1.7, gap: 32 },
  rightColumn: { flex: 1.1 },

  dashboardCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 28, ...Platform.select({ web: { boxShadow: '0px 4px 20px rgba(0,0,0,0.04)' } }) },
  cardHeader: { fontFamily: MODERN_FONT, fontSize: 20, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  cardHeaderSmall: { fontFamily: MODERN_FONT, fontSize: 15, fontWeight: '800', color: '#334155', marginBottom: 16, marginTop: 8 },
  cardSubHeader: { fontFamily: MODERN_FONT, fontSize: 14, color: '#64748b', marginTop: 4 },
  
  chartArea: { marginTop: 28 },
  barContainer: { marginBottom: 20 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-end' },
  barLabel: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: '700', color: '#334155' },
  barValue: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: '800', color: '#64748b' },
  barTrack: { height: 14, backgroundColor: '#f1f5f9', borderRadius: 7, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 7 },

  effortGrid: { flexDirection: 'row', gap: 16, marginTop: 24, marginBottom: 24 },
  effortBox: { flex: 1, backgroundColor: '#f8fafc', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  effortLabel: { fontFamily: MODERN_FONT, fontSize: 12, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 },
  effortNumber: { fontFamily: MODERN_FONT, fontSize: 32, fontWeight: '900', color: '#10b981', letterSpacing: -1 },
  effortMetric: { fontSize: 14, fontWeight: '600', color: '#94a3b8', letterSpacing: 0 },
  effortDesc: { fontFamily: MODERN_FONT, fontSize: 12, color: '#94a3b8', marginTop: 8, lineHeight: 18 },

  financialTotalValue: { fontFamily: MODERN_FONT, fontSize: 42, fontWeight: '900', color: '#ffffff', letterSpacing: -1.5, marginTop: 20 },
  financialDivider: { height: 1, backgroundColor: '#334155', marginVertical: 24 },
  
  financialList: { marginTop: 0 },
  finItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  finLeft: { flexDirection: 'row', alignItems: 'center' },
  finDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  finLabel: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: '600' },
  finValue: { fontFamily: MODERN_FONT, fontSize: 15, fontWeight: '700', color: '#f8fafc' },
});