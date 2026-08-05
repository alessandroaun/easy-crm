import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions, TouchableOpacity } from 'react-native';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function MinhaCentral({ boardData, onOpenClient }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 850;

  // Usa inteligência para extrair dados reais do Kanban
  const metrics = useMemo(() => {
    let inactive = 0, overdue = 0, hot = 0, highChance = 0, todayAppts = 0;
    let calls = 0, whatsapps = 0, sims = 0;
    let allClients = [];
    const now = new Date();
    const todayStr = now.toLocaleDateString();

    if (boardData && boardData.phases) {
      boardData.phases.forEach(phase => {
        phase.clients.forEach(client => {
          allClients.push({ ...client, phaseTitle: phase.title });
          
          // Clientes quentes e chance alta
          if (client.leadTemp?.toLowerCase().includes('quente')) hot++;
          const prob = parseInt(client.winProbability?.replace(/\D/g, '') || '0');
          if (prob >= 80) highChance++;

          // Inativos (> 3 dias sem mover)
          const lastUpdate = new Date(client.updatedAt || client.createdAt);
          const daysInactive = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
          if (daysInactive >= 3) inactive++;

          // Agendamentos e Tarefas
          if (client.appointments) {
            client.appointments.forEach(appt => {
              const apptDateObj = new Date(appt.dateTime);
              if (!appt.notified && apptDateObj < now) overdue++;
              if (apptDateObj.toLocaleDateString() === todayStr) todayAppts++;

              if (!appt.notified) {
                const t = appt.type?.toLowerCase() || '';
                if (t.includes('ligar')) calls++;
                if (t.includes('mensagem') || t.includes('whatsapp')) whatsapps++;
                if (t.includes('simulação')) sims++;
              }
            });
          }
        });
      });
    }

    // Últimos movimentados
    allClients.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    return { inactive, overdue, hot, highChance, todayAppts, calls, whatsapps, sims, allClients };
  }, [boardData]);

  // Saudação dinâmica com base na hora e formatação da data
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const currentDate = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  
  // Encontrar um Insight Inteligente
  const insightClient = metrics.allClients.find(c => c.phaseTitle && c.phaseTitle.toLowerCase().includes('negocia'));
  const insightDays = insightClient ? Math.floor((new Date() - new Date(insightClient.createdAt)) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* Cabeçalho da Central */}
      <View style={styles.heroSection}>
        <Text style={styles.greeting}>{getGreeting()}, Alessandro.</Text>
        <Text style={styles.dateText}>Hoje é {currentDate}.</Text>
      </View>

      <View style={[styles.grid, isMobile && styles.gridMobile]}>
        
        {/* COLUNA ESQUERDA: Resumo e Insight */}
        <View style={styles.mainColumn}>
          <Text style={styles.sectionTitle}>Resumo do Dia</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}><Text style={styles.summaryIcon}>🔴</Text><Text style={styles.summaryText}>{metrics.inactive} clientes sem contato há mais de 3 dias</Text></View>
            <View style={styles.summaryItem}><Text style={styles.summaryIcon}>🟠</Text><Text style={styles.summaryText}>{metrics.overdue} follow-ups vencidos</Text></View>
            <View style={styles.summaryItem}><Text style={styles.summaryIcon}>🟢</Text><Text style={styles.summaryText}>{metrics.hot} clientes quentes</Text></View>
            <View style={styles.summaryItem}><Text style={styles.summaryIcon}>⭐</Text><Text style={styles.summaryText}>{metrics.highChance} clientes com grande chance de fechar</Text></View>
            <View style={styles.summaryItem}><Text style={styles.summaryIcon}>📅</Text><Text style={styles.summaryText}>{metrics.todayAppts} contatos programados para hoje</Text></View>
          </View>

          {insightClient && (
            <View style={styles.insightCard}>
              <Text style={styles.insightIcon}>💡</Text>
              <View style={styles.insightTextContainer}>
                <Text style={styles.insightTitle}>Insight Automático</Text>
                <Text style={styles.insightText}>Seu cliente <Text style={{fontWeight: 'bold'}}>{insightClient.name}</Text> está há {insightDays} dias em {insightClient.phaseTitle}.</Text>
                <Text style={styles.insightSub}>Talvez seja um bom momento para enviar outra simulação.</Text>
              </View>
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Tarefas Operacionais</Text>
          <View style={styles.tasksRow}>
            <View style={styles.taskBox}><Text style={styles.taskIcon}>📞</Text><Text style={styles.taskCount}>{metrics.calls}</Text><Text style={styles.taskLabel}>Ligações</Text></View>
            <View style={styles.taskBox}><Text style={styles.taskIcon}>💬</Text><Text style={styles.taskCount}>{metrics.whatsapps}</Text><Text style={styles.taskLabel}>WhatsApp</Text></View>
            <View style={styles.taskBox}><Text style={styles.taskIcon}>📄</Text><Text style={styles.taskCount}>{metrics.sims}</Text><Text style={styles.taskLabel}>Simulações</Text></View>
            <View style={styles.taskBox}><Text style={styles.taskIcon}>⏰</Text><Text style={styles.taskCount}>{metrics.overdue}</Text><Text style={styles.taskLabel}>Atrasados</Text></View>
          </View>
        </View>

        {/* COLUNA DIREITA: Metas e Recentes */}
        <View style={styles.sideColumn}>
          
          <View style={styles.goalCard}>
            <Text style={styles.goalTitle}>🏆 Vendas do mês</Text>
            <Text style={styles.goalValue}>R$ 2.430.000</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '83%' }]} />
            </View>
            <Text style={styles.goalPercent}>Meta atingida: 83%</Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Últimos Movimentados</Text>
          <View style={styles.recentCard}>
            {metrics.allClients.slice(0, 4).map((client, idx) => (
              <TouchableOpacity key={client.id} style={[styles.recentItem, idx !== 3 && styles.recentBorder]} onPress={() => onOpenClient(client, client.originalPhaseId)}>
                <Text style={styles.recentName}>{client.name}</Text>
                <Text style={styles.recentPhase}>{client.phaseTitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 24, maxWidth: 1200, marginHorizontal: 'auto', width: '100%' },
  heroSection: { marginBottom: 32 },
  greeting: { fontFamily: MODERN_FONT, fontSize: 32, fontWeight: '800', color: '#1e293b', letterSpacing: -1 },
  dateText: { fontFamily: MODERN_FONT, fontSize: 16, color: '#64748b', marginTop: 4, textTransform: 'capitalize' },
  
  grid: { flexDirection: 'row', gap: 24 },
  gridMobile: { flexDirection: 'column' },
  mainColumn: { flex: 2 },
  sideColumn: { flex: 1 },
  
  sectionTitle: { fontFamily: MODERN_FONT, fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 16 },
  
  summaryCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 24, ...Platform.select({ web: { boxShadow: '0px 4px 10px rgba(0,0,0,0.03)' } }) },
  summaryItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  summaryIcon: { fontSize: 18 },
  summaryText: { fontFamily: MODERN_FONT, fontSize: 15, color: '#475569', fontWeight: '500' },
  
  insightCard: { flexDirection: 'row', backgroundColor: '#eff6ff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#bfdbfe' },
  insightIcon: { fontSize: 28, marginRight: 16 },
  insightTextContainer: { flex: 1 },
  insightTitle: { fontFamily: MODERN_FONT, fontSize: 13, fontWeight: '700', color: '#2563eb', marginBottom: 4, textTransform: 'uppercase' },
  insightText: { fontFamily: MODERN_FONT, fontSize: 15, color: '#1e3a8a', marginBottom: 4 },
  insightSub: { fontFamily: MODERN_FONT, fontSize: 13, color: '#3b82f6' },

  tasksRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  taskBox: { flex: 1, minWidth: 100, backgroundColor: '#ffffff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', ...Platform.select({ web: { boxShadow: '0px 2px 6px rgba(0,0,0,0.02)' } }) },
  taskIcon: { fontSize: 24, marginBottom: 8 },
  taskCount: { fontFamily: MODERN_FONT, fontSize: 24, fontWeight: '800', color: '#0f172a' },
  taskLabel: { fontFamily: MODERN_FONT, fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 4 },

  goalCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, ...Platform.select({ web: { boxShadow: '0px 10px 25px rgba(0,0,0,0.15)' } }) },
  goalTitle: { fontFamily: MODERN_FONT, fontSize: 14, color: '#94a3b8', fontWeight: '600', marginBottom: 8 },
  goalValue: { fontFamily: MODERN_FONT, fontSize: 32, color: '#ffffff', fontWeight: '900', marginBottom: 16 },
  progressBarBg: { height: 8, backgroundColor: '#334155', borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  goalPercent: { fontFamily: MODERN_FONT, fontSize: 12, color: '#cbd5e1', fontWeight: '600', textAlign: 'right' },

  recentCard: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 8, ...Platform.select({ web: { boxShadow: '0px 4px 10px rgba(0,0,0,0.03)' } }) },
  recentItem: { paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  recentName: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: '600', color: '#1e293b' },
  recentPhase: { fontFamily: MODERN_FONT, fontSize: 12, color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
});