import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient'; // Ajuste o caminho conforme o seu projeto
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';

let globalIsSending = false;
let globalIsPaused = false;
let globalCancelRequested = false;
let globalLogs = [];
let globalProgressText = '';
let globalStats = { success: 0, error: 0, total: 0, startTime: null, messageSummary: '' };
// Variável para armazenar a função de atualização do Lead (se o modal estiver aberto)
let onLeadUpdateCallback = null;

export const setLeadUpdateCallback = (callback) => {
  onLeadUpdateCallback = callback;
};

export default function WhatsAppBulkModal({ visible, onClose, boardData, onComplete}) {
  const [botNumber, setBotNumber] = useState('');  
  const [selectedPhaseId, setSelectedPhaseId] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all'); // Filtro de Tag / Origem / Categoria
  
  // Apenas 2 Variações de Mensagem
  const [msg1, setMsg1] = useState('Olá {nome}, tudo bem?');
  const [msg2, setMsg2] = useState('Oi {nome}, como vão as coisas?');

  const [isBotConnected, setIsBotConnected] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [activeTab, setActiveTab] = useState('disparar');
  
  const [isSending, setIsSending] = useState(globalIsSending);
  const [isPaused, setIsPaused] = useState(globalIsPaused);
  const [logs, setLogs] = useState(globalLogs);
  const [progressText, setProgressText] = useState(globalProgressText);
  const [historicoList, setHistoricoList] = useState([]);

  useEffect(() => {
    let interval;
    if (visible) {
      checkBotStatus();
      fetchHistorico();
      interval = setInterval(checkBotStatus, 3000);
      
      setIsSending(globalIsSending);
      setIsPaused(globalIsPaused);
      setLogs(globalLogs);
      setProgressText(globalProgressText);
    } else {
      setQrCodeImage(null);
    }
    return () => clearInterval(interval);
  }, [visible]);

  const checkBotStatus = async () => {
  try {
    const response = await fetch('http://localhost:3001/status');
    const data = await response.json();

    setIsBotConnected(data.connected);
    if (data.number) setBotNumber(data.number);
    else setBotNumber('');

    if (data.qrCode) setQrCodeImage(data.qrCode);
    else setQrCodeImage(null);
  } catch (error) {
    setIsBotConnected(false);
  } finally {
    setLoadingStatus(false);
  }
};

  // BUSCA O HISTÓRICO DIRETAMENTE DO SUPABASE
  const fetchHistorico = async () => {
    try {
      const { data, error } = await supabase
        .from('disparos_historico')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      if (data) setHistoricoList(data);
    } catch (e) {
      console.log('Erro ao buscar histórico do Supabase:', e.message);
    }
  };

  const handleStartBulkSend = async () => {
    const activeMessages = [msg1, msg2].filter(m => m.trim().length > 0);
    if (activeMessages.length === 0) {
      alert('Preencha pelo menos a Mensagem 1.');
      return;
    }

    let leadsToMessage = [];
    if (selectedPhaseId === 'all') {
      boardData.phases.forEach(phase => {
        if (phase.clients) leadsToMessage = [...leadsToMessage, ...phase.clients];
      });
    } else {
      const phase = boardData.phases.find(p => p.id === selectedPhaseId);
      if (phase && phase.clients) leadsToMessage = [...phase.clients];
    }

    // =========================================================================
    // FILTRAGEM AMPLA E BLINDADA (COMBINAÇÃO PERFEITA DE ORIGENS E CATEGORIAS)
    // =========================================================================
    if (selectedTag !== 'all') {
      const tagLower = selectedTag.toLowerCase().trim();
      
      leadsToMessage = leadsToMessage.filter(lead => {
        const source = lead.interest?.source ? String(lead.interest.source).toLowerCase() : '';
        const category = lead.interest?.category ? String(lead.interest.category).toLowerCase() : '';
        const directCategory = lead.category ? String(lead.category).toLowerCase() : '';
        const rawTags = lead.tags ? String(lead.tags).toLowerCase() : '';
        const rawOrigin = lead.origin ? String(lead.origin).toLowerCase() : '';
        const rawPlatform = lead.platform ? String(lead.platform).toLowerCase() : '';
        const rawInterest = lead.interesse ? String(lead.interesse).toLowerCase() : '';

        return (
          source.includes(tagLower) || 
          category.includes(tagLower) || 
          directCategory.includes(tagLower) ||
          rawTags.includes(tagLower) || 
          rawOrigin.includes(tagLower) || 
          rawPlatform.includes(tagLower) || 
          rawInterest.includes(tagLower)
        );
      });
    }

    const validLeads = leadsToMessage.filter(lead => lead.phone && lead.phone.replace(/\D/g, '').length >= 10);

    if (validLeads.length === 0) {
      alert('Nenhum lead encontrado com os filtros selecionados e telefone válido.');
      return;
    }

    globalIsSending = true;
    globalIsPaused = false;
    globalCancelRequested = false;
    setIsSending(true);
    setIsPaused(false);
    
    globalLogs = [];
    setLogs([]);

    globalStats = {
      success: 0,
      error: 0,
      total: validLeads.length,
      startTime: new Date(),
      messageSummary: `Variantes (${activeMessages.length}): ${msg1.substring(0, 25)}...`
    };

    for (let i = 0; i < validLeads.length; i++) {
      if (globalCancelRequested) break;

      while (globalIsPaused && !globalCancelRequested) {
        globalProgressText = '⏸️ Disparos Pausados pelo Usuário';
        setProgressText('⏸️ Disparos Pausados pelo Usuário');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (globalCancelRequested) break;

      const lead = validLeads[i];
      const currentProgress = `Enviando ${i + 1} de ${validLeads.length}...`;
      globalProgressText = currentProgress;
      setProgressText(currentProgress);

      const templateToUse = activeMessages[i % activeMessages.length];

      try {
        const response = await fetch('http://localhost:3001/disparar-unico', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: lead.phone,
            name: lead.name,
            messageTemplate: templateToUse
          })
        });

        const result = await response.json();
        let newLogItem;

        if (result.success) {
          globalStats.success++;
          newLogItem = { status: 'success', text: `✅ Enviado para ${lead.name} (${lead.phone})` };

          if (onLeadUpdateCallback) {
            onLeadUpdateCallback(lead.id, `🤖 Robô WhatsApp: Disparo realizado. Msg: "${templateToUse.substring(0, 30)}..."`);
          }

          const zapComment = { 
            id: `zap_${Date.now()}`, 
            text: `🤖 Robô WhatsApp: Disparo automático realizado com sucesso para o número ${lead.phone}. Mensagem: "${templateToUse.substring(0, 30)}..."`, 
            date: new Date().toISOString() 
          };

          try {
            const { data: boardData, error: fetchError } = await supabase
              .from('crm_boards')
              .select('data_payload')
              .eq('id', 'crm_principal')
              .single();

            if (!fetchError && boardData && boardData.data_payload) {
              let updatedPayload = { ...boardData.data_payload };
              let leadFound = false;

              for (let phase of updatedPayload.phases) {
                if (!phase.clients) continue;
                let clientIndex = phase.clients.findIndex(c => c.id === lead.id);
                
                if (clientIndex !== -1) {
                  let existingComments = Array.isArray(phase.clients[clientIndex].comments) ? phase.clients[clientIndex].comments : [];
                  phase.clients[clientIndex].comments = [zapComment, ...existingComments];
                  leadFound = true;
                  break;
                }
              }

              if (leadFound) {
                await supabase
                  .from('crm_boards')
                  .update({ data_payload: updatedPayload })
                  .eq('id', 'crm_principal');
              }
            }
          } catch (e) {
            console.error("Erro ao gravar comentário no JSON do Supabase:", e);
          }
        } else {
          globalStats.error++;
          newLogItem = { status: 'error', text: `❌ Falha para ${lead.name} (${lead.phone}): ${result.reason}` };
        }

        globalLogs = [...globalLogs, newLogItem];
        setLogs([...globalLogs]);

      } catch (err) {
        globalStats.error++;
        const errorItem = { status: 'error', text: `❌ Erro de conexão ao enviar para ${lead.name}` };
        globalLogs = [...globalLogs, errorItem];
        setLogs([...globalLogs]);
      }

      if (i < validLeads.length - 1 && !globalCancelRequested) {
        const delay = Math.floor(Math.random() * (14000 - 8000 + 1)) + 8000;
        const pauseMsg = `Pausa anti-spam (${Math.round(delay/1000)}s)...`;
        globalProgressText = pauseMsg;
        setProgressText(pauseMsg);
        
        let elapsed = 0;
        while (elapsed < delay && !globalCancelRequested) {
          if (!globalIsPaused) elapsed += 1000;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    const endTime = new Date();
    const finalStatusText = globalCancelRequested ? '❌ Disparo Cancelado pelo Usuário' : '🎉 Disparo em Massa Concluído!';
    
    globalProgressText = finalStatusText;
    setProgressText(finalStatusText);

    const novoHistorico = {
      status: globalCancelRequested ? 'Cancelado' : 'Concluído',
      inicio: globalStats.startTime.toLocaleString(),
      fim: endTime.toLocaleString(),
      total_alvos: globalStats.total,
      enviados: globalStats.success + globalStats.error,
      sucesso: globalStats.success,
      falha: globalStats.error,
      mensagem: globalStats.messageSummary,
      whatsapp_numero: botNumber || 'Desconhecido'
    };

    try {
      const { error } = await supabase
        .from('disparos_historico')
        .insert([novoHistorico]);

      if (error) throw error;
      fetchHistorico();
    } catch (e) {
      console.log('Erro ao salvar histórico no Supabase:', e.message);
    }

    globalIsSending = false;
    globalIsPaused = false;
    setIsSending(false);
    setIsPaused(false);

    // AGORA SIM: Dispara a notificação de conclusão ao final do processo
    if (onComplete) {
      onComplete(globalStats);
    }
  };
  

  const handleTogglePause = () => {
    globalIsPaused = !globalIsPaused;
    setIsPaused(globalIsPaused);
  };

  const handleCancelSend = () => {
    if (confirm('Tem certeza que deseja cancelar os disparos permanentemente?')) {
      globalCancelRequested = true;
      globalIsPaused = false;
      globalIsSending = false;
      setIsSending(false);
      setIsPaused(false);
      setProgressText('❌ Disparos Cancelados');
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Deseja realmente desconectar o WhatsApp?')) {
      try {
        await fetch('http://localhost:3001/desconectar', { method: 'POST' });
        setIsBotConnected(false);
        setQrCodeImage(null);
        globalIsSending = false;
        setIsSending(false);
      } catch (e) {
        alert('Erro ao tentar desconectar.');
      }
    }
  };

  if (!visible) return null;

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          <View style={styles.header}>
            <Text style={styles.title}>📣 Disparo em Massa</Text>
            
            <View style={styles.headerRightActions}>
              {isBotConnected && (
                <View style={styles.connectedAccountInfo}>
                  <Text style={styles.connectedNumberText}>📱 +{botNumber}</Text>
                  <TouchableOpacity style={styles.disconnectTopBtn} onPress={handleDisconnect}>
                    <Text style={styles.disconnectTopBtnText}>Desconectar</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isBotConnected && (
            <View style={styles.tabsRow}>
              <TouchableOpacity 
                style={[styles.tabBtn, activeTab === 'disparar' && styles.tabBtnActive]} 
                onPress={() => setActiveTab('disparar')}
              >
                <Text style={[styles.tabText, activeTab === 'disparar' && styles.tabTextActive]}>🚀 Central de Disparos</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabBtn, activeTab === 'historico' && styles.tabBtnActive]} 
                onPress={() => { setActiveTab('historico'); fetchHistorico(); }}
              >
                <Text style={[styles.tabText, activeTab === 'historico' && styles.tabTextActive]}>📊 Histórico</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.fixedContentBox}>
            {loadingStatus ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.infoText}>Conectando ao Robô Local...</Text>
              </View>
            ) : !isBotConnected ? (
              <View style={styles.centerBox}>
                <Text style={styles.statusError}>🔴 WhatsApp Desconectado</Text>
                <Text style={styles.infoText}>Abra o WhatsApp no seu celular e leia o QR Code abaixo:</Text>
                {qrCodeImage ? (
                  <Image source={{ uri: qrCodeImage }} style={styles.qrCode} />
                ) : (
                  <View style={styles.qrCodePlaceholder}>
                    <ActivityIndicator color="#64748b" />
                    <Text style={styles.infoText}>Gerando QR Code...</Text>
                  </View>
                )}
              </View>
            ) : activeTab === 'historico' ? (
              <ScrollView showsVerticalScrollIndicator={true} style={{height: 450}}>
                <Text style={styles.label}>Histórico de Disparos Realizados</Text>
                {historicoList.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum disparo registrado ainda.</Text>
                ) : (
                  historicoList.map((item) => (
                    <View key={item.id} style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <Text style={[styles.historyStatus, item.status === 'Cancelado' ? {color: '#ef4444'} : {color: '#16a34a'}]}>
                          {item.status}
                        </Text>
                        <Text style={styles.historyDate}>Início: {item.inicio}</Text>
                      </View>
                      
                      {/* Exibe o número do WhatsApp que realizou o disparo */}
                      <Text style={styles.historyMsg}>
                        <Text style={{fontWeight:'bold'}}>Conta WhatsApp:</Text> +{item.whatsapp_numero || 'N/A'}
                      </Text>

                      <Text style={styles.historyMsg}><Text style={{fontWeight:'bold'}}>Resumo:</Text> {item.mensagem}</Text>
                      <Text style={styles.historyDate}><Text style={{fontWeight:'bold'}}>Fim:</Text> {item.fim}</Text>
                      
                      <View style={styles.historyStatsRow}>
                        <Text style={styles.historyStatItem}>👥 Alvos: {item.total_alvos}</Text>
                        <Text style={[styles.historyStatItem, {color: '#16a34a'}]}>✅ Sucesso: {item.sucesso}</Text>
                        <Text style={[styles.historyStatItem, {color: '#ef4444'}]}>❌ Falha: {item.falha}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{height: 450}}>
                <View style={styles.connectedBadge}>
                  <Text style={styles.connectedText}>🟢 WhatsApp Conectado e Pronto</Text>
                </View>

                {!isSending && logs.length === 0 && (
                  <>
                    <View style={styles.filtersRow}>
                      <View style={{flex: 1}}>
                        <Text style={styles.label}>Coluna (Fase)</Text>
                        <View style={styles.pickerContainer}>
                          <select 
                            style={styles.webSelect} 
                            value={selectedPhaseId} 
                            onChange={(e) => setSelectedPhaseId(e.target.value)}
                          >
                            <option value="all">Todas as Fases</option>
                            {boardData?.phases?.map(phase => (
                              <option key={phase.id} value={phase.id}>{phase.title} ({phase.clients?.length || 0})</option>
                            ))}
                          </select>
                        </View>
                      </View>

                      <View style={{flex: 1}}>
                        <Text style={styles.label}>Origem ou Categoria</Text>
                        <View style={styles.pickerContainer}>
                          <select 
                            style={styles.webSelect} 
                            value={selectedTag} 
                            onChange={(e) => setSelectedTag(e.target.value)}
                          >
                            <option value="all">Todas as Tags / Origens</option>
                            <optgroup label="Origem / Plataforma">
                              <option value="Instagram">Instagram</option>
                              <option value="Facebook">Facebook</option>
                              <option value="TikTok">TikTok</option>
                              <option value="Google">Google</option>
                              <option value="Indicação">Indicação</option>
                            </optgroup>
                            <optgroup label="Categoria / Produto">
                              <option value="Auto">Auto (Veículos)</option>
                              <option value="Imóvel">Imóvel</option>
                              <option value="Serviço">Serviço</option>
                              <option value="Investimento">Investimento</option>
                            </optgroup>
                          </select>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.label}>Mensagem 1 (Obrigatória - Use {'{nome}'})</Text>
                    <TextInput
                      style={styles.textAreaLarge}
                      multiline
                      numberOfLines={3}
                      value={msg1}
                      onChangeText={setMsg1}
                      placeholder="Digite a primeira mensagem..."
                    />

                    <Text style={styles.label}>Mensagem 2 (Opcional - Variação Anti-ban)</Text>
                    <TextInput
                      style={styles.textAreaLarge}
                      multiline
                      numberOfLines={3}
                      value={msg2}
                      onChangeText={setMsg2}
                      placeholder="Digite a segunda mensagem alternativa..."
                    />

                    <TouchableOpacity style={[styles.primaryButton, {marginTop: 12, marginBottom: 20}]} onPress={handleStartBulkSend}>
                      <Text style={styles.primaryButtonText}>Iniciar Disparo em Massa 🚀</Text>
                    </TouchableOpacity>
                  </>
                )}

                {(isSending || logs.length > 0) && (
                  <View style={styles.logWrapper}>
                    <View style={styles.logHeaderBar}>
                      <Text style={styles.progressLabel}>{progressText}</Text>
                      {isSending && !isPaused && <ActivityIndicator size="small" color="#2563eb" />}
                    </View>

                    <ScrollView style={styles.logContainer} nestedScrollEnabled={true}>
                      {logs.map((log, index) => (
                        <Text key={index} style={[styles.logItem, log.status === 'error' ? styles.logError : styles.logSuccess]}>
                          {log.text}
                        </Text>
                      ))}
                    </ScrollView>

                    {isSending && (
                      <View style={styles.controlButtonsRow}>
                        <TouchableOpacity 
                          style={[styles.controlBtn, isPaused ? styles.btnResume : styles.btnPause]} 
                          onPress={handleTogglePause}
                        >
                          <Text style={styles.controlBtnText}>
                            {isPaused ? 'Continuar Disparos ▶' : 'Pausar Disparos ⏸'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.btnCancel} onPress={handleCancelSend}>
                          <Text style={styles.controlBtnText}>Cancelar Disparos ✕</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {!isSending && (
                      <TouchableOpacity 
                        style={[styles.primaryButton, { marginTop: 16, marginBottom: 20 }]} 
                        onPress={() => { globalLogs = []; setLogs([]); }}
                      >
                        <Text style={styles.primaryButtonText}>Fazer Novo Disparo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '100%', maxWidth: 620, backgroundColor: '#ffffff', borderRadius: 16, padding: 24, height: 630 },
  fixedContentBox: { height: 450, overflow: 'hidden' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  
  disconnectTopBtn: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6 },
  disconnectTopBtnText: { color: '#dc2626', fontWeight: 'bold', fontSize: 12 },
  
  closeButton: { padding: 4 },
  closeButtonText: { fontSize: 20, color: '#64748b', fontWeight: 'bold' },

  tabsRow: { flexDirection: 'row', marginBottom: 16, backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabBtnActive: { backgroundColor: '#ffffff', ...Platform.select({ web: { boxShadow: '0px 1px 3px rgba(0,0,0,0.1)' } }) },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#2563eb', fontWeight: 'bold' },

  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 4, marginTop: 8 },
  filtersRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },

  centerBox: { alignItems: 'center', paddingVertical: 40 },
  infoText: { fontSize: 15, color: '#475569', textAlign: 'center', marginTop: 12, marginBottom: 12 },
  statusError: { fontSize: 18, fontWeight: 'bold', color: '#ef4444' },
  qrCode: { width: 220, height: 220, marginTop: 10 },
  qrCodePlaceholder: { width: 220, height: 220, marginTop: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  
  connectedBadge: { backgroundColor: '#dcfce7', paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  connectedText: { color: '#16a34a', fontWeight: 'bold', fontSize: 13 },

  pickerContainer: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  webSelect: { width: '100%', padding: 10, borderWidth: 0, backgroundColor: 'transparent', outlineStyle: 'none', fontSize: 14, color: '#0f172a', fontFamily: 'inherit' },
  
  textAreaLarge: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#0f172a', minHeight: 75, textAlignVertical: 'top', marginBottom: 6, outlineStyle: 'none' },
  primaryButton: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  logWrapper: { marginTop: 4 },
  logHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressLabel: { fontSize: 13, fontWeight: 'bold', color: '#2563eb' },
  logContainer: { backgroundColor: '#0f172a', borderRadius: 8, padding: 10, height: 220 },
  logItem: { fontSize: 12, fontFamily: 'monospace', marginBottom: 4, lineHeight: 16 },
  logSuccess: { color: '#4ade80' },
  logError: { color: '#f87171' },

  controlButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  controlBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnPause: { backgroundColor: '#d97706' },
  btnResume: { backgroundColor: '#16a34a' },
  btnCancel: { flex: 1, backgroundColor: '#dc2626', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  controlBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },

  emptyText: { textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', marginTop: 40 },
  historyCard: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  historyStatus: { fontWeight: 'bold', fontSize: 13 },
  historyDate: { fontSize: 12, color: '#64748b' },
  historyMsg: { fontSize: 13, color: '#334155', marginBottom: 6 },
  historyStatsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 6 },
  historyStatItem: { fontSize: 12, fontWeight: '600', color: '#475569' },
  connectedAccountInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connectedNumberText: { fontSize: 13, fontWeight: '600', color: '#475569' }
});