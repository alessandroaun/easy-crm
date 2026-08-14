import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import ReportModal from './ReportModal';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

let globalIsSending = false;
let globalIsPaused = false;
let globalCancelRequested = false;
let globalLogs = [];
let globalProgressText = '';
let globalStats = { success: 0, error: 0, total: 0, startTime: null, messageSummary: '' };
let onLeadUpdateCallback = null;

export const setLeadUpdateCallback = (callback) => {
  onLeadUpdateCallback = callback;
};

const CheckBox = ({ label, value, onValueChange, isDarkMode }) => (
  <TouchableOpacity style={styles.checkboxContainer} onPress={() => onValueChange(!value)}>
    <View style={[styles.checkbox, isDarkMode ? darkStyles.checkbox : lightStyles.checkbox, value && styles.checkboxChecked]}>
      {value && <Text style={styles.checkmark}>✓</Text>}
    </View>
    <Text style={[styles.checkboxLabel, isDarkMode ? darkStyles.checkboxLabel : lightStyles.checkboxLabel]}>{label}</Text>
  </TouchableOpacity>
);

export default function WhatsAppBulkModal({ visible, onClose, boardData, onComplete, isDarkMode }) {
  const hasTransitioned = useRef(false);
  const [connectionStage, setConnectionStage] = useState('connecting');
  const [botNumber, setBotNumber] = useState('');  
  const [selectedPhaseId, setSelectedPhaseId] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');

  const [messageItems, setMessageItems] = useState([]);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const [isBotConnected, setIsBotConnected] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [activeTab, setActiveTab] = useState('disparar');
  const [selectedReport, setSelectedReport] = useState(null);
  
  const [isSending, setIsSending] = useState(globalIsSending);
  const [isPaused, setIsPaused] = useState(globalIsPaused);
  const [logs, setLogs] = useState(globalLogs);
  const [progressText, setProgressText] = useState(globalProgressText);
  const [historicoList, setHistoricoList] = useState([]);

  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertActionType, setAlertActionType] = useState(null);

  const showAlert = (title, message, actionType = 'info') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertActionType(actionType);
    setIsAlertModalVisible(true);
  };

  const handleAlertConfirm = () => {
    if (alertActionType === 'cancel_send') {
      globalCancelRequested = true;
      globalIsPaused = false;
      globalIsSending = false;
      setIsSending(false);
      setIsPaused(false);
      setProgressText('❌ Disparos Cancelados');
    } else if (alertActionType === 'disconnect') {
      executeDisconnect();
    }
    setIsAlertModalVisible(false);
  };

  useEffect(() => {
    let interval;
    if (visible) {
      setConnectionStage('connecting');
      hasTransitioned.current = false; 
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

  const prevBoardId = useRef(boardData?.id);

  useEffect(() => {
    if (prevBoardId.current && boardData?.id && prevBoardId.current !== boardData.id) {
      globalIsSending = false;
      globalIsPaused = false;
      globalCancelRequested = false;
      globalLogs = [];
      globalProgressText = '';
      
      setIsSending(false);
      setIsPaused(false);
      setLogs([]);
      setProgressText('');
    }
    prevBoardId.current = boardData?.id;
  }, [boardData?.id]);

  const handleCloseModal = () => {
    if (!globalIsSending && globalLogs.length > 0) {
      globalLogs = [];
      globalProgressText = '';
      setLogs([]);
      setProgressText('');
    }
    onClose();
  };

  const checkBotStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/status');
      const data = await response.json();

      if (data.connected) {
        setIsBotConnected(true);
        if (data.number) setBotNumber(data.number);

        if (!hasTransitioned.current) {
          hasTransitioned.current = true;
          setConnectionStage('ready');
        }
      } else {
        setIsBotConnected(false);
        
        if (data.qrCode) {
          hasTransitioned.current = false;
          setConnectionStage('qr_code');
          setQrCodeImage(data.qrCode);
        } else {
          setQrCodeImage(null);
          setConnectionStage(prev => prev === 'disconnecting' ? 'disconnecting' : 'connecting');
        }
      }
    } catch (error) {
      setIsBotConnected(false);
      setConnectionStage(prev => prev === 'disconnecting' ? 'disconnecting' : 'connecting');
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchHistorico = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('disparos_historico')
        .select('*')
        .eq('user_id', user.id)
        .order('id', { ascending: false });

      if (error) throw error;
      if (data) setHistoricoList(data);
    } catch (e) {
      console.log('Erro ao buscar histórico do Supabase:', e.message);
    }
  };

  const handleAddItem = (type) => {
    setShowAddMenu(false);
    const newItem = {
      id: Date.now() + Math.random(),
      type, 
      content: type === 'text' ? 'Olá {nome}, tudo bem?' : '',
      caption: '',
      file: null,
      isVariation: false
    };
    setMessageItems([...messageItems, newItem]);
  };

  const handleRemoveItem = (id) => {
    setMessageItems(messageItems.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id, field, value) => {
    setMessageItems(messageItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handlePickFileForItem = async (id, allowedTypes) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: allowedTypes,
        copyToCacheDirectory: true
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const fileObj = {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/octet-stream',
          base64: reader.result
        };
        handleUpdateItem(id, 'file', fileObj);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      showAlert('Erro', 'Não foi possível carregar o arquivo selecionado.');
    }
  };

  const handleStartBulkSend = async () => {
    const fixedItems = [];
    const varItems = [];

    for (const item of messageItems) {
      if (item.type === 'text') {
        if (!item.content.trim()) continue;
        const formattedItem = { type: 'text', text: item.content };
        item.isVariation ? varItems.push(formattedItem) : fixedItems.push(formattedItem);
      } else if (item.type === 'image' || item.type === 'video') {
        if (!item.file) continue;
        const formattedItem = { type: 'media', file: item.file, caption: item.caption };
        item.isVariation ? varItems.push(formattedItem) : fixedItems.push(formattedItem);
      } else if (item.type === 'audio') {
        if (!item.file) continue;
        const formattedItem = { type: 'audio', file: item.file };
        item.isVariation ? varItems.push(formattedItem) : fixedItems.push(formattedItem);
      }
    }

    if (fixedItems.length === 0 && varItems.length === 0) {
      showAlert('Atenção', 'Adicione e configure pelo menos uma mensagem, imagem, vídeo ou áudio.');
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
          source.includes(tagLower) || category.includes(tagLower) || directCategory.includes(tagLower) ||
          rawTags.includes(tagLower) || rawOrigin.includes(tagLower) || rawPlatform.includes(tagLower) || rawInterest.includes(tagLower)
        );
      });
    }

    const validLeads = leadsToMessage.filter(lead => lead.phone && lead.phone.replace(/\D/g, '').length >= 10);

    if (validLeads.length === 0) {
      showAlert('Atenção', 'Nenhum lead encontrado com os filtros selecionados e telefone válido.');
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
      messageSummary: `Itens na fila: Fixos (${fixedItems.length}) / Variações (${varItems.length})`
    };

    let dbBoardId = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userBoards } = await supabase
          .from('crm_boards')
          .select('id')
          .eq('user_id', user.id)
          .ilike('id', 'board_%')
          .order('id', { ascending: false })
          .limit(1);

        if (userBoards && userBoards.length > 0) {
          dbBoardId = userBoards[0].id;
        }
      }
    } catch (err) {
      console.error('Erro ao identificar o ID correto do board:', err);
    }

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

      const leadItems = [...fixedItems];
      if (varItems.length > 0) {
        leadItems.push(varItems[i % varItems.length]);
      }

      let leadSuccess = true;
      let leadErrorMsg = '';
      let sentDescriptions = [];

      for (const item of leadItems) {
        if (globalCancelRequested) break;

        let formData = new FormData();
        formData.append('phone', lead.phone);
        formData.append('name', lead.name);

        if (item.type === 'text') {
          formData.append('messageTemplate', item.text);
        } else if (item.type === 'media') {
          formData.append('messageTemplate', item.caption || '');
          const responseBlob = await fetch(item.file.uri);
          const blobData = await responseBlob.blob();
          formData.append('file', blobData, item.file.name);
        } else if (item.type === 'audio') {
          formData.append('messageTemplate', '');
          const responseBlob = await fetch(item.file.uri);
          const blobData = await responseBlob.blob();
          formData.append('file', blobData, item.file.name);
        }

        try {
          const response = await fetch('http://localhost:3001/disparar-unico', {
            method: 'POST',
            body: formData
          });
          const result = await response.json();

          if (result.success) {
            sentDescriptions.push(item.type === 'text' ? 'Texto' : item.type === 'media' ? 'Mídia' : 'Áudio');
          } else {
            leadSuccess = false;
            leadErrorMsg = result.reason;
            break;
          }
        } catch (err) {
          leadSuccess = false;
          leadErrorMsg = 'Erro de conexão com o servidor';
          break;
        }
      }

      let newLogItem;
      const summaryDesc = sentDescriptions.join(' + ');

      if (leadSuccess) {
        globalStats.success++;
        newLogItem = { status: 'success', text: `✅ Enviado para ${lead.name} (${summaryDesc})` };

        const zapComment = { 
          id: `zap_${Date.now()}`, 
          text: `🤖 Robô WhatsApp: Disparo automático realizado com sucesso para o número ${lead.phone}. Itens: ${summaryDesc}`, 
          date: new Date().toISOString() 
        };

        if (onLeadUpdateCallback) {
          onLeadUpdateCallback(lead.id, zapComment.text);
        }

        if (dbBoardId) {
          try {
            const { data: freshBoard } = await supabase
              .from('crm_boards')
              .select('id, data_payload')
              .eq('id', dbBoardId)
              .single();

            if (freshBoard && freshBoard.data_payload?.phases) {
              const updatedPhases = freshBoard.data_payload.phases.map(phase => {
                return {
                  ...phase,
                  clients: phase.clients.map(c => {
                    if (String(c.id) === String(lead.id)) {
                      const comments = Array.isArray(c.comments) ? c.comments : [];
                      return { 
                        ...c, 
                        whatsappError: false, 
                        comments: [zapComment, ...comments] 
                      };
                    }
                    return c;
                  })
                };
              });

              await supabase
                .from('crm_boards')
                .update({ data_payload: { ...freshBoard.data_payload, phases: updatedPhases } })
                .eq('id', dbBoardId);
              
              boardData.phases = updatedPhases;
            }
          } catch (dbErr) {
            console.error('Erro ao persistir comentário no banco:', dbErr);
          }
        }
      } else {
        globalStats.error++;
        newLogItem = { status: 'error', text: `❌ Falha para ${lead.name} (${lead.phone}): ${leadErrorMsg}` };

        const failComment = { 
          id: `fail_${Date.now()}`, 
          text: `🔴 Robô WhatsApp: Falha ao enviar itens. Motivo: ${leadErrorMsg}`, 
          date: new Date().toISOString() 
        };

        if (onLeadUpdateCallback) {
          onLeadUpdateCallback(lead.id, failComment.text);
        }

        if (dbBoardId) {
          try {
            let { data: freshBoard } = await supabase
              .from('crm_boards')
              .select('id, data_payload')
              .eq('id', dbBoardId)
              .single();

            if (freshBoard && freshBoard.data_payload?.phases) {
              let updatedPhases = freshBoard.data_payload.phases.map(phase => {
                if (!phase.clients) return phase;
                let clients = phase.clients.map(c => {
                  if (String(c.id) === String(lead.id)) {
                    let comments = Array.isArray(c.comments) ? c.comments : [];
                    return { ...c, whatsappError: true, comments: [failComment, ...comments] };
                  }
                  return c;
                });
                return { ...phase, clients };
              });

              await supabase
                .from('crm_boards')
                .update({ data_payload: { ...freshBoard.data_payload, phases: updatedPhases } })
                .eq('id', dbBoardId);
              
              if (boardData && boardData.phases) {
                boardData.phases = updatedPhases;
              }
            }
          } catch (dbErr) {
            console.error('Erro ao salvar comentário de falha no banco:', dbErr);
          }
        }
      }

      globalLogs = [...globalLogs, newLogItem];
      setLogs([...globalLogs]);

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

    const leadsComStatus = validLeads.map(l => {
      const logDoLead = globalLogs.find(log => log.text.includes(l.name) || log.text.includes(l.phone));
      const deuErro = logDoLead && logDoLead.status === 'error';
      return { name: l.name, phone: l.phone, status: deuErro ? 'Falha' : 'Sucesso' };
    });

    const historicoDetalhado = {
      fase: selectedPhaseId === 'all' ? 'Todas as Fases' : (boardData.phases.find(p => p.id === selectedPhaseId)?.title || selectedPhaseId),
      tag: selectedTag === 'all' ? 'Todas as Tags / Origens' : selectedTag,
      leads: leadsComStatus
    };

    const { data: { user } } = await supabase.auth.getUser();

    const novoHistorico = {
      user_id: user?.id,
      status: globalCancelRequested ? 'Cancelado' : 'Concluído',
      inicio: globalStats.startTime ? globalStats.startTime.toLocaleString() : new Date().toLocaleString(),
      fim: endTime.toLocaleString(),
      total_alvos: parseInt(globalStats.total) || 0,
      enviados: parseInt(globalStats.success + globalStats.error) || 0,
      sucesso: parseInt(globalStats.success) || 0,
      falha: parseInt(globalStats.error) || 0,
      mensagem: `${globalStats.messageSummary} [DADOS_EXTRA:${JSON.stringify(historicoDetalhado)}]`,
      whatsapp_numero: botNumber || 'Desconhecido'
    };

    try {
      const { error } = await supabase.from('disparos_historico').insert([novoHistorico]);
      if (error) console.error('Erro ao salvar histórico:', error.message);
      else fetchHistorico();
    } catch (e) {
      console.log('Erro de conexão ao salvar histórico:', e.message);
    }

    globalIsSending = false;
    globalIsPaused = false;
    setIsSending(false);
    setIsPaused(false);

    if (onComplete) onComplete(globalStats);
  };

  const handleTogglePause = () => {
    globalIsPaused = !globalIsPaused;
    setIsPaused(globalIsPaused);
  };

  const handleCancelSend = () => {
    showAlert('Cancelar Disparos', 'Tem certeza que deseja cancelar os disparos permanentemente?', 'cancel_send');
  };

  const executeDisconnect = async () => {
    try {
      setConnectionStage('disconnecting');
      await fetch('http://localhost:3001/desconectar', { method: 'POST' });
      setIsBotConnected(false);
      setQrCodeImage(null);
      
      globalIsSending = false;
      globalIsPaused = false;
      globalCancelRequested = false;
      globalLogs = [];
      globalProgressText = '';
      
      setIsSending(false);
      setIsPaused(false);
      setLogs([]);
      setProgressText('');
    } catch (e) {
      showAlert('Erro', 'Erro ao tentar desconectar.');
    }
  };

  const handleDisconnect = () => {
    showAlert('Desconectar WhatsApp', 'Deseja realmente desconectar o WhatsApp?', 'disconnect');
  };

  if (!visible) return null;

  const themeStyles = isDarkMode ? darkStyles : lightStyles;

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, themeStyles.modalContainer]}>
          
          <View style={styles.header}>
            <Text style={[styles.title, themeStyles.title]}>Disparo de Mensagens</Text>
            <View style={styles.headerRightActions}>
              {isBotConnected && (
                <View style={styles.connectedAccountInfo}>
                  {!isSending && logs.length === 0 && activeTab === 'disparar' && (
                    <TouchableOpacity style={styles.startTopBtn} onPress={handleStartBulkSend}>
                      <Text style={styles.startTopBtnText}>Iniciar Disparo</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.disconnectTopBtn, themeStyles.disconnectTopBtn]} onPress={handleDisconnect}>
                    <Text style={[styles.disconnectTopBtnText, themeStyles.disconnectTopBtnText]}>Desconectar</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
                <Text style={[styles.closeButtonText, themeStyles.closeButtonText]}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isBotConnected && (
            <View style={[styles.tabsRow, themeStyles.tabsRow]}>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'disparar' && (isDarkMode ? darkStyles.tabBtnActive : styles.tabBtnActive)]} onPress={() => setActiveTab('disparar')}>
                <Text style={[styles.tabText, themeStyles.tabText, activeTab === 'disparar' && themeStyles.tabTextActive]}>Central de Disparos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'historico' && (isDarkMode ? darkStyles.tabBtnActive : styles.tabBtnActive)]} onPress={() => { setActiveTab('historico'); fetchHistorico(); }}>
                <Text style={[styles.tabText, themeStyles.tabText, activeTab === 'historico' && themeStyles.tabTextActive]}>Histórico</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.fixedContentBox}>
            {loadingStatus ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={isDarkMode ? '#38bdf8' : '#2563eb'} />
                <Text style={[styles.infoText, themeStyles.infoText]}>Conectando Conta do WhatsApp...</Text>
              </View>
            ) : connectionStage === 'connecting' ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={isDarkMode ? '#38bdf8' : '#2563eb'} />
                <Text style={[styles.infoText, themeStyles.infoText]}>Conectando Conta do WhatsApp...</Text>
              </View>
            ) : connectionStage === 'disconnecting' ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#dc2626" />
                <Text style={[styles.infoText, themeStyles.infoText]}>Desconectando Conta do WhatsApp...</Text>
              </View>
            ) : connectionStage === 'success' ? (
              <View style={styles.centerBox}>
                <Text style={{ fontSize: 80 }}>✅</Text>
                <Text style={[styles.statusSuccess, { fontSize: 22, marginTop: 20 }]}>Conexão bem sucedida!</Text>
              </View>
            ) : connectionStage === 'qr_code' ? (
              <View style={styles.centerBox}>
                <Text style={styles.statusError}>🔴 WhatsApp Desconectado</Text>
                <Text style={[styles.infoText, themeStyles.infoText]}>Abra o WhatsApp no seu celular e leia o QR Code abaixo:</Text>
                {qrCodeImage ? (
                  <Image source={{ uri: qrCodeImage }} style={styles.qrCode} />
                ) : (
                  <ActivityIndicator color={isDarkMode ? '#94a3b8' : '#64748b'} />
                )}
              </View>
            ) : activeTab === 'historico' ? (
              <ScrollView showsVerticalScrollIndicator={true} style={{height: 450}}>
                <Text style={[styles.label, themeStyles.label]}>Histórico de Disparos Realizados</Text>
                {historicoList.length === 0 ? (
                  <Text style={[styles.emptyText, themeStyles.emptyText]}>Nenhum disparo registrado ainda.</Text>
                ) : (
                  historicoList.map((item) => {
                    const getCleanMessage = (fullText) => {
                      if (!fullText) return 'Sem mensagem.';
                      if (fullText.includes('[DADOS_EXTRA:')) {
                        return fullText.split('[DADOS_EXTRA:')[0].trim();
                      }
                      return fullText;
                    };

                    return (
                      <TouchableOpacity key={item.id} onPress={() => setSelectedReport(item)} style={[styles.historyCard, themeStyles.historyCard]}>
                        <View style={styles.historyHeader}>
                          <Text style={[styles.historyStatus, item.status === 'Cancelado' ? {color: '#ef4444'} : {color: '#16a34a'}]}>{item.status}</Text>
                          <Text style={[styles.historyDate, themeStyles.historyDate]}>Início: {item.inicio}</Text>
                        </View>
                        <Text style={[styles.historyMsg, themeStyles.historyMsg]}>
                          <Text style={{fontWeight:'bold'}}>Conta WhatsApp:</Text> +{item.whatsapp_numero || 'N/A'}
                        </Text>
                        <View style={{ marginVertical: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDarkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>Informações:</Text>
                          <Text style={[styles.historyMsgClean, themeStyles.historyMsgClean]} numberOfLines={2}>
                            {getCleanMessage(item.mensagem)}
                          </Text>
                        </View>
                        <Text style={[styles.historyDate, themeStyles.historyDate]}><Text style={{fontWeight:'bold'}}>Fim:</Text> {item.fim}</Text>
                        <View style={[styles.historyStatsRow, themeStyles.historyStatsRow]}>
                          <Text style={[styles.historyStatItem, themeStyles.historyStatItem]}>👥 Alvos: {item.total_alvos}</Text>
                          <Text style={[styles.historyStatItem, {color: '#16a34a'}]}>✅ Sucesso: {item.sucesso}</Text>
                          <Text style={[styles.historyStatItem, {color: '#ef4444'}]}>❌ Falha: {item.falha}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContentContainer} style={{height: 450}}>
                
                {!isSending && logs.length === 0 && (
                  <View style={styles.topActionRow}>
                    <View style={[styles.connectedBadgeInline, themeStyles.connectedBadgeInline]}>
                      <Text style={[styles.connectedText, themeStyles.connectedText]}>🟢 WhatsApp Conectado: +{botNumber}</Text>
                    </View>
                  </View>
                )}

                {!isSending && logs.length === 0 && (
                  <>
                    <View style={styles.filtersRow}>
                      <View style={{flex: 1}}>
                        <Text style={[styles.label, themeStyles.label]}>Coluna (Fase)</Text>
                        <View style={[styles.pickerContainer, themeStyles.pickerContainer]}>
                          <select style={[styles.webSelect, themeStyles.webSelect]} value={selectedPhaseId} onChange={(e) => setSelectedPhaseId(e.target.value)}>
                            <option value="all" style={isDarkMode ? {backgroundColor: '#1e293b', color: '#f8fafc'} : {}}>Todas as Fases</option>
                            {boardData?.phases?.map(phase => (
                              <option key={phase.id} value={phase.id} style={isDarkMode ? {backgroundColor: '#1e293b', color: '#f8fafc'} : {}}>{phase.title} ({phase.clients?.length || 0})</option>
                            ))}
                          </select>
                        </View>
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={[styles.label, themeStyles.label]}>Origem ou Categoria</Text>
                        <View style={[styles.pickerContainer, themeStyles.pickerContainer]}>
                          <select style={[styles.webSelect, themeStyles.webSelect]} value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
                            <option value="all" style={isDarkMode ? {backgroundColor: '#1e293b', color: '#f8fafc'} : {}}>Todas as Tags / Origens</option>
                            <optgroup label="Origem / Plataforma">
                              <option value="Instagram" style={isDarkMode ? {backgroundColor: '#1e293b', color: '#f8fafc'} : {}}>Instagram</option>
                              <option value="Facebook" style={isDarkMode ? {backgroundColor: '#1e293b', color: '#f8fafc'} : {}}>Facebook</option>
                              <option value="TikTok" style={isDarkMode ? {backgroundColor: '#1e293b', color: '#f8fafc'} : {}}>TikTok</option>
                              <option value="Google" style={isDarkMode ? {backgroundColor: '#1e293b', color: '#f8fafc'} : {}}>Google</option>
                              <option value="Indicação" style={isDarkMode ? {backgroundColor: '#1e293b', color: '#f8fafc'} : {}}>Indicação</option>
                            </optgroup>
                            <optgroup label="Categoria / Produto">
                              <option value="Auto" style={isDarkMode ? {backgroundColor: '#1e293b', color: '#f8fafc'} : {}}>Auto (Veículos)</option>
                              <option value="Imóvel" style={isDarkMode ? {backgroundColor: '#1e293b', color: '#f8fafc'} : {}}>Imóvel</option>
                              <option value="Serviço" style={isDarkMode ? {backgroundColor: '#1e293b', color: '#f8fafc'} : {}}>Serviço</option>
                              <option value="Investimento" style={isDarkMode ? {backgroundColor: '#1e293b', color: '#f8fafc'} : {}}>Investimento</option>
                            </optgroup>
                          </select>
                        </View>
                      </View>
                    </View>

                    {messageItems.map((item, index) => (
                      <View key={item.id} style={[styles.itemBlock, themeStyles.itemBlock]}>
                        <View style={styles.blockHeader}>
                          <Text style={[styles.label, themeStyles.label]}>
                            Item {index + 1}: {item.type === 'text' ? 'Texto' : item.type === 'image' ? 'Imagem' : item.type === 'video' ? 'Vídeo' : 'Áudio'}
                          </Text>
                          <TouchableOpacity onPress={() => handleRemoveItem(item.id)}>
                            <Text style={styles.removeText}>Remover</Text>
                          </TouchableOpacity>
                        </View>

                        {item.type === 'text' && (
                          <>
                            <TextInput
                              style={[styles.textAreaLarge, themeStyles.textAreaLarge]}
                              multiline
                              numberOfLines={3}
                              value={item.content}
                              onChangeText={(val) => handleUpdateItem(item.id, 'content', val)}
                              placeholder="Digite a mensagem aqui... Use {nome} para personalizar."
                              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
                            />
                            <CheckBox label="Esta mensagem é uma variação (alternar no disparo)" value={item.isVariation} onValueChange={(val) => handleUpdateItem(item.id, 'isVariation', val)} isDarkMode={isDarkMode} />
                          </>
                        )}

                        {item.type === 'image' && (
                          <>
                            <TouchableOpacity style={[styles.mediaPickerBtn, themeStyles.mediaPickerBtn]} onPress={() => handlePickFileForItem(item.id, ['image/*'])}>
                              <Text style={[styles.mediaPickerBtnText, themeStyles.mediaPickerBtnText]}>🖼️ {item.file ? 'Trocar Imagem' : 'Selecionar Imagem'}</Text>
                            </TouchableOpacity>
                            {item.file && (
                              <View style={{ marginTop: 8 }}>
                                <Text style={styles.selectedFileText}>Arquivo: {item.file.name}</Text>
                                <TextInput style={[styles.textAreaLarge, themeStyles.textAreaLarge, { minHeight: 45, marginTop: 6 }]} value={item.caption} onChangeText={(val) => handleUpdateItem(item.id, 'caption', val)} placeholder="Legenda da imagem (opcional)..." placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} />
                              </View>
                            )}
                            <CheckBox label="Esta imagem é uma variação (alternar no disparo)" value={item.isVariation} onValueChange={(val) => handleUpdateItem(item.id, 'isVariation', val)} isDarkMode={isDarkMode} />
                          </>
                        )}

                        {item.type === 'video' && (
                          <>
                            <TouchableOpacity style={[styles.mediaPickerBtn, themeStyles.mediaPickerBtn]} onPress={() => handlePickFileForItem(item.id, ['video/*'])}>
                              <Text style={[styles.mediaPickerBtnText, themeStyles.mediaPickerBtnText]}>🎥 {item.file ? 'Trocar Vídeo' : 'Selecionar Vídeo'}</Text>
                            </TouchableOpacity>
                            {item.file && (
                              <View style={{ marginTop: 8 }}>
                                <Text style={styles.selectedFileText}>Arquivo: {item.file.name}</Text>
                                <TextInput style={[styles.textAreaLarge, themeStyles.textAreaLarge, { minHeight: 45, marginTop: 6 }]} value={item.caption} onChangeText={(val) => handleUpdateItem(item.id, 'caption', val)} placeholder="Legenda do vídeo (opcional)..." placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} />
                              </View>
                            )}
                            <CheckBox label="Este vídeo é uma variação (alternar no disparo)" value={item.isVariation} onValueChange={(val) => handleUpdateItem(item.id, 'isVariation', val)} isDarkMode={isDarkMode} />
                          </>
                        )}

                        {item.type === 'audio' && (
                          <>
                            <TouchableOpacity style={[styles.mediaPickerBtn, themeStyles.mediaPickerBtn]} onPress={() => handlePickFileForItem(item.id, ['audio/*'])}>
                              <Text style={[styles.mediaPickerBtnText, themeStyles.mediaPickerBtnText]}>🎵 {item.file ? 'Trocar Áudio' : 'Selecionar Arquivo de Áudio'}</Text>
                            </TouchableOpacity>
                            <Text style={styles.audioFormatHint}>Formatos aceitos: MP3, WAV, OGG</Text>
                            {item.file && (
                              <View style={{ marginTop: 8 }}>
                                <Text style={styles.selectedFileText}>Áudio: {item.file.name}</Text>
                              </View>
                            )}
                            <CheckBox label="Este áudio é uma variação (alternar no disparo)" value={item.isVariation} onValueChange={(val) => handleUpdateItem(item.id, 'isVariation', val)} isDarkMode={isDarkMode} />
                          </>
                        )}
                      </View>
                    ))}

                    <View style={{ marginVertical: 12, position: 'relative' }}>
                      {!showAddMenu ? (
                        <TouchableOpacity onPress={() => setShowAddMenu(true)} style={[styles.addBtn, themeStyles.addBtn]}>
                          <Text style={[styles.addBtnText, themeStyles.addBtnText]}>+ Adicionar Mensagem</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.floatingMenu, themeStyles.floatingMenu]}>
                          <Text style={[styles.menuTitle, themeStyles.menuTitle]}>Selecione o tipo de item:</Text>
                          <TouchableOpacity style={[styles.menuItem, themeStyles.menuItem]} onPress={() => handleAddItem('text')}><Text style={[styles.menuItemText, themeStyles.menuItemText]}>📝 Texto</Text></TouchableOpacity>
                          <TouchableOpacity style={[styles.menuItem, themeStyles.menuItem]} onPress={() => handleAddItem('image')}><Text style={[styles.menuItemText, themeStyles.menuItemText]}>🖼️ Imagem</Text></TouchableOpacity>
                          <TouchableOpacity style={[styles.menuItem, themeStyles.menuItem]} onPress={() => handleAddItem('video')}><Text style={[styles.menuItemText, themeStyles.menuItemText]}>🎥 Vídeo</Text></TouchableOpacity>
                          <TouchableOpacity style={[styles.menuItem, themeStyles.menuItem]} onPress={() => handleAddItem('audio')}><Text style={[styles.menuItemText, themeStyles.menuItemText]}>🎵 Áudio</Text></TouchableOpacity>
                          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }, isDarkMode ? {backgroundColor: '#0f172a'} : {backgroundColor: '#f1f5f9'}]} onPress={() => setShowAddMenu(false)}>
                            <Text style={[styles.menuItemText, { color: '#ef4444', textAlign: 'center' }]}>Cancelar</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </>
                )}

                {(isSending || logs.length > 0) && (
                  <View style={styles.logWrapper}>
                    <View style={styles.logHeaderBar}>
                      <Text style={styles.progressLabel}>{progressText}</Text>
                      {isSending && !isPaused && <ActivityIndicator size="small" color={isDarkMode ? '#38bdf8' : '#2563eb'} />}
                    </View>
                    <ScrollView style={styles.logContainer} nestedScrollEnabled={true}>
                      {logs.map((log, index) => (
                        <Text key={index} style={[styles.logItem, log.status === 'error' ? styles.logError : styles.logSuccess]}>{log.text}</Text>
                      ))}
                    </ScrollView>
                    {isSending && (
                      <View style={styles.controlButtonsRow}>
                        <TouchableOpacity style={[styles.controlBtn, isPaused ? styles.btnResume : styles.btnPause]} onPress={handleTogglePause}>
                          <Text style={styles.controlBtnText}>{isPaused ? 'Continuar Disparos' : 'Pausar Disparos'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnCancel} onPress={handleCancelSend}>
                          <Text style={styles.controlBtnText}>Cancelar Disparos</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {!isSending && (
                      <TouchableOpacity style={[styles.primaryButton, { marginTop: 16, marginBottom: 20 }]} onPress={() => { globalLogs = []; setLogs([]); }}>
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

      <Modal animationType="fade" transparent={true} visible={isAlertModalVisible} onRequestClose={() => setIsAlertModalVisible(false)}>
        <View style={styles.alertOverlay}>
          <View style={[styles.alertContent, themeStyles.alertContent]}>
            <Text style={[styles.alertTitle, themeStyles.alertTitle]}>{alertTitle}</Text>
            <Text style={[styles.alertSubtitle, themeStyles.alertSubtitle]}>{alertMessage}</Text>
            <View style={styles.alertButtonsRow}>
              {alertActionType !== 'info' ? (
                <>
                  <TouchableOpacity style={[styles.alertBtn, themeStyles.alertCancelBtn]} onPress={() => setIsAlertModalVisible(false)}>
                    <Text style={[styles.alertCancelBtnText, themeStyles.alertCancelBtnText]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.alertBtn, styles.alertConfirmBtn]} onPress={handleAlertConfirm}>
                    <Text style={styles.alertConfirmBtnText}>Confirmar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={[styles.alertBtn, styles.alertConfirmBtn, { width: '100%' }]} onPress={() => setIsAlertModalVisible(false)}>
                  <Text style={styles.alertConfirmBtnText}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <ReportModal visible={!!selectedReport} report={selectedReport} boardData={boardData} onClose={() => setSelectedReport(null)} isDarkMode={isDarkMode} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '100%', maxWidth: 620, borderRadius: 16, padding: 24, height: 680 },
  fixedContentBox: { height: 500, overflow: 'hidden' },
  scrollContentContainer: { alignItems: 'stretch' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  
  startTopBtn: { backgroundColor: '#2563eb', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, justifyContent: 'center' },
  startTopBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },

  closeButton: { padding: 4 },
  closeButtonText: { fontSize: 20, fontWeight: 'bold' },

  tabsRow: { flexDirection: 'row', marginBottom: 16, borderRadius: 8, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabText: { fontSize: 13, fontWeight: '600' },

  label: { fontSize: 13, fontWeight: '600', marginBottom: 4, marginTop: 8 },
  filtersRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },

  itemBlock: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  removeText: { fontSize: 12, color: '#ef4444', fontWeight: 'bold' },
  addBtn: { paddingVertical: 12, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderRadius: 8 },
  addBtnText: { fontWeight: '700', fontSize: 14 },
  
  floatingMenu: { borderWidth: 1, borderRadius: 8, padding: 8, ...Platform.select({ web: { boxShadow: '0px 4px 12px rgba(0,0,0,0.1)' } }) },
  menuTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  menuItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  menuItemText: { fontSize: 14, fontWeight: '600' },

  mediaPickerBtn: { borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'center', width: '100%' },
  mediaPickerBtnText: { fontWeight: '600', fontSize: 13 },
  selectedFileText: { fontSize: 12, color: '#16a34a', fontWeight: '600', marginTop: 4 },
  audioFormatHint: { fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 4 },

  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderRadius: 4, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkmark: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  checkboxLabel: { fontSize: 13, flex: 1 },

  infoText: { fontSize: 15, textAlign: 'center', marginTop: 12, marginBottom: 12 },
  statusError: { fontSize: 18, fontWeight: 'bold', color: '#ef4444' },
  qrCode: { width: 220, height: 220, marginTop: 10 },
  
  topActionRow: { 
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12 
  },
  connectedBadgeInline: { 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    display: 'inline-flex'
  },
  connectedText: { 
    fontWeight: 'bold', 
    fontSize: 13, 
    whiteSpace: 'nowrap',
    textAlign: 'center'
  },
  
  pickerContainer: { borderWidth: 1, borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  webSelect: { width: '100%', padding: 10, borderWidth: 0, backgroundColor: 'transparent', outlineStyle: 'none', fontSize: 14, fontFamily: 'inherit' },
  
  textAreaLarge: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, minHeight: 70, textAlignVertical: 'top', marginBottom: 6, outlineStyle: 'none' },
  primaryButton: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  logWrapper: { marginTop: 4 },
  logHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressLabel: { fontSize: 13, fontWeight: 'bold', color: '#2563eb' },
  logContainer: { backgroundColor: '#0f172a', borderRadius: 8, padding: 10, height: 180 },
  logItem: { fontSize: 12, fontFamily: 'monospace', marginBottom: 4, lineHeight: 16 },
  logSuccess: { color: '#4ade80' },
  logError: { color: '#f87171' },

  controlButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  controlBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnPause: { backgroundColor: '#d97706' },
  btnResume: { backgroundColor: '#16a34a' },
  btnCancel: { flex: 1, backgroundColor: '#dc2626', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  controlBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },

  emptyText: { textAlign: 'center', fontStyle: 'italic', marginTop: 40 },
  historyCard: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  historyStatus: { fontWeight: 'bold', fontSize: 13 },
  historyDate: { fontSize: 12 },
  historyMsg: { fontSize: 13, marginBottom: 6 },
  historyStatsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 6 },
  historyStatItem: { fontSize: 12, fontWeight: '600' },
  connectedAccountInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyMsgClean: { fontSize: 13, padding: 6, borderRadius: 4, borderWidth: 1, fontStyle: 'italic', marginTop: 2 },
  statusSuccess: { color: '#16a34a', fontWeight: '800', textAlign: 'center' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },

  alertOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  alertContent: { borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center', ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 20px rgba(0,0,0,0.15)'} }) },
  alertTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  alertSubtitle: { fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  alertButtonsRow: { flexDirection: 'row', gap: 12, width: '100%' },
  alertBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  alertConfirmBtn: { backgroundColor: '#2563eb' },
  alertConfirmBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 }
});

const lightStyles = StyleSheet.create({
  modalContainer: { backgroundColor: '#ffffff' },
  title: { color: '#1e293b' },
  disconnectTopBtn: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  disconnectTopBtnText: { color: '#dc2626' },
  closeButtonText: { color: '#64748b' },
  tabsRow: { backgroundColor: '#f1f5f9' },
  tabBtnActive: { backgroundColor: '#ffffff', ...Platform.select({ web: { boxShadow: '0px 1px 3px rgba(0,0,0,0.1)' } }) },
  tabText: { color: '#64748b' },
  tabTextActive: { color: '#2563eb' },
  label: { color: '#475569' },
  itemBlock: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  addBtn: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  addBtnText: { color: '#2563eb' },
  floatingMenu: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  menuTitle: { color: '#64748b' },
  menuItem: { borderBottomColor: '#f1f5f9' },
  menuItemText: { color: '#334155' },
  mediaPickerBtn: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  mediaPickerBtnText: { color: '#334155' },
  checkbox: { borderColor: '#cbd5e1' },
  checkboxLabel: { color: '#475569' },
  infoText: { color: '#475569' },
  connectedBadgeInline: { backgroundColor: '#dcfce7' },
  connectedText: { color: '#16a34a' },
  pickerContainer: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  webSelect: { color: '#0f172a' },
  textAreaLarge: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' },
  emptyText: { color: '#94a3b8' },
  historyCard: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  historyDate: { color: '#64748b' },
  historyMsg: { color: '#334155' },
  historyStatsRow: { borderTopColor: '#e2e8f0' },
  historyStatItem: { color: '#475569' },
  historyMsgClean: { color: '#475569', backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  alertContent: { backgroundColor: '#ffffff' },
  alertTitle: { color: '#1e293b' },
  alertSubtitle: { color: '#64748b' },
  alertCancelBtn: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  alertCancelBtnText: { color: '#475569' }
});

const darkStyles = StyleSheet.create({
  modalContainer: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 },
  title: { color: '#f8fafc' },
  disconnectTopBtn: { backgroundColor: '#450a0a', borderColor: '#7f1d1d' },
  disconnectTopBtnText: { color: '#fca5a5' },
  closeButtonText: { color: '#94a3b8' },
  tabsRow: { backgroundColor: '#0f172a' },
  tabBtnActive: { backgroundColor: '#334155' },
  tabText: { color: '#94a3b8' },
  tabTextActive: { color: '#ffffff' },
  label: { color: '#94a3b8' },
  itemBlock: { backgroundColor: '#0f172a', borderColor: '#334155' },
  addBtn: { borderColor: '#3b82f6', backgroundColor: '#172554' },
  addBtnText: { color: '#60a5fa' },
  floatingMenu: { backgroundColor: '#1e293b', borderColor: '#334155' },
  menuTitle: { color: '#94a3b8' },
  menuItem: { borderBottomColor: '#334155' },
  menuItemText: { color: '#f8fafc' },
  mediaPickerBtn: { backgroundColor: '#0f172a', borderColor: '#334155' },
  mediaPickerBtnText: { color: '#f8fafc' },
  checkbox: { borderColor: '#334155', backgroundColor: '#0f172a' },
  checkboxLabel: { color: '#cbd5e1' },
  infoText: { color: '#94a3b8' },
  connectedBadgeInline: { backgroundColor: '#052e16' },
  connectedText: { color: '#34d399' },
  pickerContainer: { backgroundColor: '#0f172a', borderColor: '#334155' },
  webSelect: { color: '#f8fafc' },
  textAreaLarge: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' },
  emptyText: { color: '#64748b' },
  historyCard: { backgroundColor: '#0f172a', borderColor: '#334155' },
  historyDate: { color: '#94a3b8' },
  historyMsg: { color: '#cbd5e1' },
  historyStatsRow: { borderTopColor: '#334155' },
  historyStatItem: { color: '#94a3b8' },
  historyMsgClean: { color: '#cbd5e1', backgroundColor: '#1e293b', borderColor: '#334155' },
  alertContent: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 },
  alertTitle: { color: '#f8fafc' },
  alertSubtitle: { color: '#94a3b8' },
  alertCancelBtn: { backgroundColor: '#0f172a', borderColor: '#334155' },
  alertCancelBtnText: { color: '#cbd5e1' }
});