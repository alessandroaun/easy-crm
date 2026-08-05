import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../services/supabaseClient';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

// Extrai números puros de campos financeiros (ignora centavos após a vírgula)
const parseMoney = (val) => {
  if (!val) return 0;
  const s = String(val);
  if (s.includes(',')) {
    return parseInt(s.split(',')[0].replace(/\D/g, ''), 10) || 0;
  }
  return parseInt(s.replace(/\D/g, ''), 10) || 0;
};

// Formatação Padrão de Moeda Brasileira
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

export default function MinhaCentral({ boardData, onOpenClient }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 850;

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // Busca as configurações (Metas e Nome) salvas no Supabase
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase.from('crm_boards').select('data_payload').eq('id', 'crm_config').maybeSingle();
        if (error) throw error;
        if (data && data.data_payload) {
          setConfig(data.data_payload);
        } else {
          setConfig({ name: 'Alessandro', monthlyGoal: '0' });
        }
      } catch (err) {
        console.error("Erro ao buscar configurações:", err);
        setConfig({ name: 'Alessandro', monthlyGoal: '0' });
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const firstName = config?.name ? config.name.split(' ')[0] : 'Alessandro';
  const metaMensalNumerica = parseMoney(config?.monthlyGoal);

  // MOTOR DE INTELIGÊNCIA ANALÍTICA CORRIGIDO
  const metrics = useMemo(() => {
    let inactive = 0, noContact = 0, hot = 0, highChance = 0, todayAppts = 0;
    let calls = 0, whatsapps = 0, sims = 0, overdue = 0;
    let allClients = [];
    
    let vendasMes = 0;
    let negMesAtual = 0;
    let negMesesAnteriores = 0;
    
    let estagnadosNovoCliente = [];
    let contatosRealizados = [];
    let standByAlerts = [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayStr = now.toLocaleDateString();

    if (boardData && boardData.phases) {
      boardData.phases.forEach(phase => {
        // Normaliza o título para ignorar acentos e maiúsculas na leitura das fases
        const title = phase.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const isFechado = title.includes('fechad');
        const isNegociacao = title.includes('negocia');
        const isNovo = title.includes('novo');
        const isTentou = title.includes('tentou');
        const isContato = title.includes('contato realizado');
        const isStandby = title.includes('stand');

        phase.clients.forEach(client => {
          allClients.push({ ...client, phaseTitle: phase.title });
          
          // CORREÇÃO: Captura o Valor Desejado (Crédito) do formulário
          const creditValue = parseMoney(client.desiredCredit || 0);
          
          const created = new Date(client.createdAt);
          const lastUpdate = new Date(client.updatedAt || client.createdAt);
          
          const daysInactive = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
          const daysInPhase = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
          
          const isCreatedCurrentMonth = created.getMonth() === currentMonth && created.getFullYear() === currentYear;

          // --- RESUMO DO DIA ---
          
          // 1. Leads sem movimentações há mais de 3 dias nas fases iniciais e de negociação
          if (daysInactive >= 3 && (isNovo || isTentou || isContato || isNegociacao)) {
            inactive++;
          }
          
          // 2. Leads ainda sem contato (Restrito a Novo Cliente e Tentou Contato)
          if (isNovo || isTentou) {
            noContact++;
          }

          if (client.leadTemp?.toLowerCase().includes('quente')) hot++;
          const prob = parseInt(client.winProbability?.replace(/\D/g, '') || '0');
          if (prob >= 80) highChance++;

          // --- TAREFAS OPERACIONAIS E AGENDAMENTOS ---
          if (client.appointments) {
            client.appointments.forEach(appt => {
              const apptDateObj = new Date(appt.dateTime);
              const isPast = apptDateObj < now;
              
              if (!appt.notified && isPast) overdue++;
              if (apptDateObj.toLocaleDateString() === todayStr && !appt.notified) todayAppts++;

              const apptTitle = (appt.title || appt.type || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              if (apptTitle.includes('simulaca')) sims++;
            });
          }

          if (client.comments) {
            client.comments.forEach(comment => {
              const commentDate = new Date(comment.date).toLocaleDateString();
              if (commentDate === todayStr) {
                const text = comment.text.toLowerCase();
                if (text.includes('botão de ligar')) calls++;
                if (text.includes('falar no whatsapp')) whatsapps++;
              }
            });
          }

          // --- MATEMÁTICA FINANCEIRA CORRIGIDA ---
          
          // Vendas do Mês Atual (Soma todos os leads na coluna Fechados)
          if (isFechado) {
            vendasMes += creditValue;
          }

          // Em Negociação (Divide entre leads criados neste mês e nos anteriores)
          if (isNegociacao) {
            if (isCreatedCurrentMonth) {
              negMesAtual += creditValue;
            } else {
              negMesesAnteriores += creditValue;
            }
          }

          // --- ALERTAS E INSIGHTS ---
          if (isNovo && daysInPhase >= 7) {
            estagnadosNovoCliente.push(client);
          }

          if (isContato) {
            contatosRealizados.push({ ...client, daysInPhase });
          }

          if (isStandby && daysInPhase >= 15) {
            standByAlerts.push({ ...client, daysInPhase });
          }
        });
      });
    }

    allClients.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    return { 
      inactive, noContact, hot, highChance, todayAppts, calls, whatsapps, sims, overdue, allClients,
      vendasMes, negMesAtual, negMesesAnteriores, estagnadosNovoCliente, contatosRealizados, standByAlerts 
    };
  }, [boardData]);

  const metaPercentage = metaMensalNumerica > 0 ? Math.min(Math.round((metrics.vendasMes / metaMensalNumerica) * 100), 100) : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const currentDate = new Date();
  const weekDays = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'];
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const dateFormatted = `Hoje É ${weekDays[currentDate.getDay()]}, ${currentDate.getDate()} De ${months[currentDate.getMonth()]}.`;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      <View style={styles.heroSection}>
        <Text style={styles.greeting}>{getGreeting()}, {firstName}.</Text>
        <Text style={styles.dateText}>{dateFormatted}</Text>
      </View>

      <View style={[styles.grid, isMobile && styles.gridMobile]}>
        
        <View style={styles.mainColumn}>
          
          <Text style={styles.sectionTitle}>Resumo do Dia</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}><Text style={styles.summaryIcon}>🔴</Text><Text style={styles.summaryText}>{metrics.inactive} leads sem movimentações há mais de 3 dias</Text></View>
            <View style={styles.summaryItem}><Text style={styles.summaryIcon}>🟠</Text><Text style={styles.summaryText}>{metrics.noContact} leads ainda sem contato</Text></View>
            <View style={styles.summaryItem}><Text style={styles.summaryIcon}>🟢</Text><Text style={styles.summaryText}>{metrics.hot} clientes quentes</Text></View>
            <View style={styles.summaryItem}><Text style={styles.summaryIcon}>⭐</Text><Text style={styles.summaryText}>{metrics.highChance} clientes com grande chance de fechar</Text></View>
            <View style={styles.summaryItem}><Text style={styles.summaryIcon}>📅</Text><Text style={styles.summaryText}>{metrics.todayAppts} contatos programados para hoje</Text></View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Tarefas Operacionais</Text>
          <View style={styles.tasksRow}>
            <View style={styles.taskBox}>
              <Text style={styles.taskIcon}>📞</Text>
              <Text style={styles.taskCount}>{metrics.calls}</Text>
              <Text style={styles.taskLabel}>Ligações</Text>
            </View>
            <View style={styles.taskBox}>
              <Text style={styles.taskIcon}>💬</Text>
              <Text style={styles.taskCount}>{metrics.whatsapps}</Text>
              <Text style={styles.taskLabel}>WhatsApp</Text>
            </View>
            <View style={styles.taskBox}>
              <Text style={styles.taskIcon}>📄</Text>
              <Text style={styles.taskCount}>{metrics.sims}</Text>
              <Text style={styles.taskLabel}>Simulações</Text>
            </View>
            <View style={styles.taskBox}>
              <Text style={styles.taskIcon}>⏰</Text>
              <Text style={styles.taskCount}>{metrics.overdue}</Text>
              <Text style={styles.taskLabel}>Atrasados</Text>
            </View>
          </View>

          <View style={styles.executiveSummary}>
            <Text style={styles.executiveSummaryText}>
              {firstName}, você tem <Text style={styles.highlightText}>{formatCurrency(metrics.negMesAtual)}</Text> em negociação dos leads deste mês e <Text style={styles.highlightText}>{formatCurrency(metrics.negMesesAnteriores)}</Text> dos clientes pendentes de meses anteriores.
            </Text>
          </View>
          
          {metrics.contatosRealizados.length > 0 && (
            <View style={styles.reportCard}>
              <Text style={styles.reportText}>
                A inteligência do sistema identificou <Text style={{fontWeight: '700', color: '#0f172a'}}>{metrics.contatosRealizados.length}</Text> clientes na fase de "Contato Realizado" aguardando conversão para negociação. Mantenha o acompanhamento ativo para reduzir o ciclo de venda.
              </Text>
            </View>
          )}

        </View>

        <View style={styles.sideColumn}>
          
          <View style={styles.goalCard}>
            <Text style={styles.goalTitle}>🏆 Vendas do mês</Text>
            <Text style={styles.goalValue}>{formatCurrency(metrics.vendasMes)}</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${metaPercentage}%` }]} />
            </View>
            <Text style={styles.goalPercent}>Meta atingida: {metaPercentage}%</Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Últimos Movimentados</Text>
          <View style={styles.recentCard}>
            {metrics.allClients.slice(0, 3).map((client, idx) => (
              <TouchableOpacity key={client.id} style={[styles.recentItem, idx !== 2 && styles.recentBorder]} onPress={() => onOpenClient(client, client.originalPhaseId)}>
                <Text style={styles.recentName} numberOfLines={1}>{client.name}</Text>
                <Text style={styles.recentPhase}>{client.phaseTitle}</Text>
              </TouchableOpacity>
            ))}
            {metrics.allClients.length === 0 && (
              <Text style={styles.emptyRecentText}>Nenhuma movimentação ainda.</Text>
            )}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Insights & Alertas</Text>

          {metrics.estagnadosNovoCliente.length > 5 && (
            <View style={styles.alertCardDanger}>
              <Text style={styles.alertTitleDanger}>Atenção Operacional</Text>
              <Text style={styles.alertTextDanger}>
                {firstName}, você tem {metrics.estagnadosNovoCliente.length} leads que estão há mais de uma semana parados ainda na coluna de "Novo Cliente", você deve entrar em contato com eles e informar ao CRM o quanto antes!
              </Text>
            </View>
          )}

          {metrics.standByAlerts.length > 0 && (
            metrics.standByAlerts.sort((a, b) => b.daysInPhase - a.daysInPhase).slice(0, 3).map((client) => {
              const cycle = Math.floor(client.daysInPhase / 15) * 15;
              return (
                <TouchableOpacity key={client.id} style={styles.alertCardInfo} onPress={() => onOpenClient(client, client.originalPhaseId)}>
                  <Text style={styles.alertTitleInfo}>Aviso de Stand By</Text>
                  <Text style={styles.alertTextInfo}>
                    O cliente <Text style={{fontWeight: '700'}}>{client.name}</Text> já está a {cycle} dias em StandBY, tente contato com ele(a) mais uma vez!
                  </Text>
                </TouchableOpacity>
              )
            })
          )}
          
          {metrics.estagnadosNovoCliente.length <= 5 && metrics.standByAlerts.length === 0 && (
             <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateText}>Nenhum alerta crítico no momento.</Text>
             </View>
          )}

        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  content: { padding: 32, maxWidth: 1280, marginHorizontal: 'auto', width: '100%', paddingBottom: 60 },
  
  heroSection: { marginBottom: 32 },
  greeting: { fontFamily: MODERN_FONT, fontSize: 32, fontWeight: '900', color: '#111827', letterSpacing: -1 },
  dateText: { fontFamily: MODERN_FONT, fontSize: 15, color: '#64748b', marginTop: 4, textTransform: 'capitalize' },
  
  grid: { flexDirection: 'row', gap: 32 },
  gridMobile: { flexDirection: 'column', gap: 24 },
  mainColumn: { flex: 1.8 },
  sideColumn: { flex: 1.2 },
  
  sectionTitle: { fontFamily: MODERN_FONT, fontSize: 17, fontWeight: '800', color: '#1e293b', marginBottom: 16 },
  
  summaryCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 24, borderWidth: 1, borderColor: '#e2e8f0', ...Platform.select({ web: { boxShadow: '0px 4px 12px rgba(0,0,0,0.03)' } }) },
  summaryItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 14 },
  summaryIcon: { fontSize: 20 },
  summaryText: { fontFamily: MODERN_FONT, fontSize: 15, color: '#475569', fontWeight: '500' },

  tasksRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  taskBox: { flex: 1, minWidth: 120, backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', ...Platform.select({ web: { boxShadow: '0px 2px 6px rgba(0,0,0,0.02)' } }) },
  taskIcon: { fontSize: 26, marginBottom: 12 },
  taskCount: { fontFamily: MODERN_FONT, fontSize: 26, fontWeight: '900', color: '#0f172a' },
  taskLabel: { fontFamily: MODERN_FONT, fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 4 },

  executiveSummary: { 
    marginTop: 24, 
    backgroundColor: '#ffffff', 
    padding: 18, 
    borderRadius: 8, 
    borderLeftWidth: 4, 
    borderLeftColor: '#2563eb',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({ web: { boxShadow: '0px 2px 5px rgba(0,0,0,0.03)' } })
  },
  executiveSummaryText: { fontFamily: MODERN_FONT, fontSize: 15, color: '#334155', lineHeight: 22, fontWeight: '500' },
  highlightText: { color: '#1d4ed8', fontWeight: '800' },

  reportCard: { marginTop: 16, backgroundColor: '#ffffff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  reportText: { fontFamily: MODERN_FONT, fontSize: 14, color: '#475569', lineHeight: 22 },

  goalCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 24, ...Platform.select({ web: { boxShadow: '0px 8px 20px rgba(0,0,0,0.1)' } }) },
  goalTitle: { fontFamily: MODERN_FONT, fontSize: 13, color: '#94a3b8', fontWeight: '600', marginBottom: 12 },
  goalValue: { fontFamily: MODERN_FONT, fontSize: 34, color: '#ffffff', fontWeight: '900', marginBottom: 20, letterSpacing: -1 },
  progressBarBg: { height: 8, backgroundColor: '#334155', borderRadius: 4, marginBottom: 12, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  goalPercent: { fontFamily: MODERN_FONT, fontSize: 12, color: '#e2e8f0', fontWeight: '600', textAlign: 'right' },

  recentCard: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 8, ...Platform.select({ web: { boxShadow: '0px 4px 10px rgba(0,0,0,0.03)' } }) },
  recentItem: { paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  recentName: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: '600', color: '#1e293b', flex: 1, paddingRight: 8 },
  recentPhase: { fontFamily: MODERN_FONT, fontSize: 11, color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  emptyRecentText: { fontFamily: MODERN_FONT, fontSize: 13, color: '#94a3b8', paddingVertical: 12, textAlign: 'center' },

  alertCardDanger: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#fecaca', marginBottom: 16 },
  alertTitleDanger: { fontFamily: MODERN_FONT, fontSize: 12, fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  alertTextDanger: { fontFamily: MODERN_FONT, fontSize: 14, color: '#991b1b', lineHeight: 22 },

  alertCardInfo: { backgroundColor: '#f0fdfa', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#ccfbf1', marginBottom: 12, ...Platform.select({ web: { cursor: 'pointer' } }) },
  alertTitleInfo: { fontFamily: MODERN_FONT, fontSize: 11, fontWeight: '800', color: '#0f766e', textTransform: 'uppercase', marginBottom: 8 },
  alertTextInfo: { fontFamily: MODERN_FONT, fontSize: 14, color: '#115e59', lineHeight: 22 },

  emptyStateCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  emptyStateText: { fontFamily: MODERN_FONT, fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
});