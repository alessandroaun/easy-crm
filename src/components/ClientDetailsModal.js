import React, { useState, useEffect, useRef } from 'react';
import { 
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView, ActivityIndicator, Linking, useWindowDimensions, Animated 
} from 'react-native';
import { setLeadUpdateCallback } from './WhatsAppBulkModal';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../services/supabaseClient';

export default function ClientDetailsModal({ visible, onClose, clientData, onSave, isAdmin, usersList, currentUserId, onTransferLead, isDarkMode }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 850;

  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState({}); 
  const [activeTab, setActiveTab] = useState('informacoes');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  
  const [apptType, setApptType] = useState('Ligar');
  const [apptDate, setApptDate] = useState(''); 
  const [apptTime, setApptTime] = useState(''); 
  const [apptReminder, setApptReminder] = useState(0); 

  const [selectedTransferUserId, setSelectedTransferUserId] = useState('');
  const [transferWithoutComment, setTransferWithoutComment] = useState(false);
  
  // Motor Dinâmico de Alertas (Sucesso / Erro)
  const [alertConfig, setAlertConfig] = useState({ visible: false, type: 'success', title: '', message: '' });
  const alertScale = useRef(new Animated.Value(0.8)).current;
  const alertOpacity = useRef(new Animated.Value(0)).current;

  const showCustomAlert = (type, title, message) => {
    setAlertConfig({ visible: true, type, title, message });
    alertScale.setValue(0.8);
    alertOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(alertScale, { toValue: 1, friction: 6, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(alertOpacity, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' })
    ]).start();
  };

  const closeCustomAlert = () => {
    Animated.parallel([
      Animated.timing(alertScale, { toValue: 0.8, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(alertOpacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' })
    ]).start(() => {
      setAlertConfig({ visible: false, type: 'success', title: '', message: '' });
    });
  };

  useEffect(() => {
    if (clientData) {
      let mergedInfo = clientData.initialInfo || '';
      if (clientData.history) {
        mergedInfo = mergedInfo ? `${mergedInfo}\n\n=== DADOS DA IMPORTAÇÃO ===\n${clientData.history}` : clientData.history;
      }
      const dataToSet = { ...clientData, initialInfo: mergedInfo };
      delete dataToSet.history; 

      setFormData(dataToSet);
      setOriginalData(JSON.parse(JSON.stringify(dataToSet))); 
      setActiveTab('informacoes');
      setNewCommentText('');
      setSelectedTransferUserId('');
      setTransferWithoutComment(false);
      
      const now = new Date();
      setApptDate(now.toLocaleDateString('pt-BR'));
      setApptTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }
  }, [clientData]);

  useEffect(() => {
    setLeadUpdateCallback((leadId, messageText) => {
      if (clientData?.id === leadId) {
        const newComment = { 
          id: `zap_${Date.now()}`, 
          text: messageText, 
          date: new Date().toISOString() 
        };
        
        setFormData(prev => ({ 
          ...prev, 
          comments: [newComment, ...(prev.comments || [])] 
        }));
      }
    });

    return () => setLeadUpdateCallback(null);
  }, [clientData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (text) => {
    let cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 2) cleaned = cleaned.replace(/^(\d{2})(\d)/, '$1/$2');
    if (cleaned.length > 5) cleaned = cleaned.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
    setApptDate(cleaned.substring(0, 10)); 
  };

  const handleTimeChange = (text) => {
    let cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 2) cleaned = cleaned.replace(/^(\d{2})(\d)/, '$1:$2');
    setApptTime(cleaned.substring(0, 5)); 
  };

  const handleSave = () => {
    // INTERCEPTADOR DE TRANSFERÊNCIA
    if (activeTab === 'transferir') {
      if (!selectedTransferUserId) {
        showCustomAlert('error', 'Atenção', 'Selecione um vendedor de destino para transferir o lead.');
        return;
      }
      if (onTransferLead) {
        onTransferLead(formData, selectedTransferUserId, transferWithoutComment);
      }
      onClose();
      return;
    }

    let updatedData = { ...formData };
    
    if (updatedData.phone && updatedData.phone !== originalData.phone) {
      let cl = updatedData.phone.replace(/\D/g, '');
      if (!cl.startsWith('55') && cl.length <= 11) cl = '55' + cl;
      const match = cl.match(/^(\d{2})(\d{2})(\d+)$/);
      if (match) {
        const numero = match[3];
        const numeroFormatado = numero.length > 4 ? `${numero.slice(0, -4)}-${numero.slice(-4)}` : numero;
        updatedData.phone = `+${match[1]} (${match[2]}) ${numeroFormatado}`;
      }
    }

    const fieldsToTrack = {
      name: 'Nome', phone: 'Telefone', email: 'E-mail', category: 'Categoria', desiredCredit: 'Crédito', leadTemp: 'Temperatura'
    };

    let changes = [];
    for (let key in fieldsToTrack) {
      if ((updatedData[key] || '') !== (originalData[key] || '')) {
        changes.push(`- ${fieldsToTrack[key]}: alterado.`);
      }
    }

    if (changes.length > 0) {
      const summaryText = `⚙️ Sistema: Perfil atualizado\n${changes.join('\n')}`;
      updatedData.comments = [{ id: `sys_${Date.now()}`, text: summaryText, date: new Date().toISOString() }, ...(updatedData.comments || [])];
    }

    onSave(updatedData);
    onClose();
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const comment = { id: Date.now().toString(), text: newCommentText, date: new Date().toISOString() };
    setFormData(prev => ({ ...prev, comments: [comment, ...(prev.comments || [])] }));
    setNewCommentText('');
  };

  const handleAddAppointment = () => {
    if (!apptDate || !apptTime || apptDate.length < 10 || apptTime.length < 5) {
      showCustomAlert('error', 'Campos Incompletos', 'Preencha a data e o horário completos do agendamento.');
      return;
    }

    try {
      const [day, month, year] = apptDate.split('/');
      const [hours, minutes] = apptTime.split(':');
      const eventDateTime = new Date(year, month - 1, day, hours, minutes);

      if (isNaN(eventDateTime.getTime())) throw new Error("Data inválida");

      if (eventDateTime <= new Date()) {
        showCustomAlert('error', 'Ação Inválida', 'A data e o horário do agendamento devem ser no futuro. Por favor, escolha um horário válido.');
        return;
      }

      const newAppointment = {
        id: `appt_${Date.now()}`,
        type: apptType,
        dateTime: eventDateTime.toISOString(),
        reminderMinutes: apptReminder,
        notified: false
      };

      setFormData(prev => ({
        ...prev,
        appointments: [newAppointment, ...(prev.appointments || [])],
        comments: [
          { id: `sys_appt_${Date.now()}`, text: `⚙️ Sistema: Agendou para ${apptType} em ${apptDate} às ${apptTime}.`, date: new Date().toISOString() },
          ...(prev.comments || [])
        ]
      }));
      
      showCustomAlert('success', 'Agendado!', 'Seu compromisso foi salvo e você será notificado no horário programado.');
      
    } catch (error) {
      showCustomAlert('error', 'Formato Inválido', 'Formato de data ou hora inválido. Use DD/MM/AAAA e HH:MM.');
    }
  };

  const handleDeleteAppointment = (apptId) => {
    setFormData(prev => {
      const updatedAppts = (prev.appointments || []).filter(a => a.id !== apptId);
      return {
        ...prev,
        appointments: updatedAppts,
        comments: [
          { id: `sys_appt_del_${Date.now()}`, text: `⚙️ Sistema: Um agendamento pendente foi cancelado.`, date: new Date().toISOString() },
          ...(prev.comments || [])
        ]
      };
    });
  };

  const handleUpload = async (fieldKey) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (result.canceled) return;
      setUploadingDoc(true);
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const fileExt = asset.name.split('.').pop();
      const fileName = `${clientData.id}_${fieldKey}_${Date.now()}.${fileExt}`;
      const filePath = `${clientData.id}/${fileName}`;
      const { error } = await supabase.storage.from('crm_documents').upload(filePath, blob, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('crm_documents').getPublicUrl(filePath);
      handleChange(fieldKey, publicUrlData.publicUrl);
      showCustomAlert('success', 'Sucesso', 'Upload concluído com sucesso!');
    } catch (error) {
      console.error("Erro no upload:", error);
      showCustomAlert('error', 'Erro', 'Erro ao fazer o upload do documento.');
    } finally {
      setUploadingDoc(false);
    }
  };

  if (!clientData) return null;

  const themeStyles = isDarkMode ? darkStyles : lightStyles;

  const TabButton = ({ id, label }) => {
    const isActive = activeTab === id;
    return (
      <TouchableOpacity 
        style={[
          styles.tabButton, 
          themeStyles.tabButton,
          isMobile && styles.tabButtonMobile, 
          isActive && themeStyles.tabButtonActive, 
          isMobile && isActive && themeStyles.tabButtonMobileActive
        ]} 
        onPress={() => setActiveTab(id)}
      >
        <Text style={[
          styles.tabText, 
          themeStyles.tabText,
          isMobile && styles.tabTextMobile, 
          isActive && themeStyles.tabTextActive,
          isMobile && isActive && themeStyles.tabTextMobileActive
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const CommentsSection = () => (
    <View style={[styles.commentsContainer, isMobile && styles.commentsContainerMobile]}>
      <Text style={[styles.commentsTitle, themeStyles.commentsTitle]}>Atividades e Comentários</Text>
      <View style={[styles.commentInputContainer, themeStyles.commentInputContainer]}>
        <TextInput 
          style={[styles.commentInput, themeStyles.commentInput]} 
          placeholder="Registre uma ação..." 
          placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
          multiline={true} 
          value={newCommentText} 
          onChangeText={setNewCommentText} 
        />
        <TouchableOpacity style={styles.addCommentBtn} onPress={handleAddComment}><Text style={styles.addCommentBtnText}>Salvar</Text></TouchableOpacity>
      </View>
      <ScrollView style={styles.commentsList} showsVerticalScrollIndicator={false}>
        {(!formData.comments || formData.comments.length === 0) ? (
          <Text style={[styles.noCommentsText, themeStyles.noCommentsText]}>Nenhuma interação registrada.</Text>
        ) : (
          formData.comments.map(comment => {
            const isSystem = comment.text.includes('Sistema:');
            return (
              <View key={comment.id} style={[styles.commentCard, isSystem ? themeStyles.commentCardAuto : themeStyles.commentCardManual]}>
                <Text style={[styles.commentDate, themeStyles.commentDate]}>{new Date(comment.date).toLocaleDateString('pt-BR')} às {new Date(comment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
                <Text style={[styles.commentText, isSystem ? themeStyles.commentTextAuto : themeStyles.commentTextManual]}>{comment.text}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        
        {alertConfig.visible && (
          <View style={styles.successAlertOverlay}>
            <Animated.View style={[styles.successAlertBox, themeStyles.successAlertBox, { opacity: alertOpacity, transform: [{ scale: alertScale }] }]}>
              <Text style={styles.successAlertIcon}>{alertConfig.type === 'success' ? '✅' : '⚠️'}</Text>
              <Text style={[styles.successAlertTitle, themeStyles.successAlertTitle]}>{alertConfig.title}</Text>
              <Text style={[styles.successAlertMessage, themeStyles.successAlertMessage]}>{alertConfig.message}</Text>
              <TouchableOpacity 
                style={[styles.successAlertBtn, alertConfig.type === 'error' && { backgroundColor: '#ef4444' }]} 
                onPress={closeCustomAlert}
              >
                <Text style={styles.successAlertBtnText}>{alertConfig.type === 'success' ? 'Continuar' : 'Entendi'}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        <View style={[styles.modalWrapper, themeStyles.modalWrapper, isMobile && styles.modalWrapperMobile]}>
          
          <View style={[styles.header, themeStyles.header, isMobile && styles.headerMobile]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.title, themeStyles.title, isMobile && styles.titleMobile]} numberOfLines={1}>{formData.name || 'Detalhes do Lead'}</Text>
              {formData.createdAt && <Text style={[styles.subtitle, themeStyles.subtitle]}>Cadastrado em: {new Date(formData.createdAt).toLocaleDateString('pt-BR')} às {new Date(formData.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, themeStyles.closeButton]}><Text style={[styles.closeButtonText, themeStyles.closeButtonText]}>✕</Text></TouchableOpacity>
          </View>

          <View style={[styles.body, themeStyles.body, isMobile && styles.bodyMobile]}>
            
            {isMobile ? (
              <View style={[styles.sidebarMobileContainer, themeStyles.sidebarMobileContainer]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sidebarMobile} contentContainerStyle={{ paddingRight: 20 }}>
                  <TabButton id="informacoes" label="Informações" />
                  <TabButton id="dados" label="Dados Pessoais" />
                  <TabButton id="consorcio" label="Interesse" />
                  <TabButton id="financeiro" label="Financeiro" />
                  <TabButton id="docs" label="Documentos" />
                  <TabButton id="kpis" label="Inteligência" />
                  <TabButton id="comentarios" label="Comentários" />
                  <TabButton id="agendamentos" label="Agendamentos" />
                  {isAdmin && <TabButton id="transferir" label="🔄 Transferir Lead" />}
                </ScrollView>
              </View>
            ) : (
              <View style={[styles.sidebar, themeStyles.sidebar]}>
                <TabButton id="informacoes" label="Informações Principais" />
                <TabButton id="dados" label="Dados Pessoais" />
                <TabButton id="consorcio" label="Interesse" />
                <TabButton id="financeiro" label="Financeiro" />
                <TabButton id="docs" label="Documentos" />
                <TabButton id="kpis" label="Inteligência" />
                <TabButton id="agendamentos" label="Agendamentos" />
                {isAdmin && <TabButton id="transferir" label="🔄 Transferir Lead" />}
              </View>
            )}

            <ScrollView style={[styles.contentArea, themeStyles.contentArea, isMobile && styles.contentAreaMobile]} showsVerticalScrollIndicator={false}>
              
              {activeTab === 'informacoes' && (
                <View style={styles.formSection}>
                  <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>Informações Principais</Text>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, themeStyles.label]}>Valor Desejado (Crédito)</Text>
                      <TextInput style={[styles.input, themeStyles.input]} value={formData.desiredCredit || ''} onChangeText={t => handleChange('desiredCredit', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, themeStyles.label]}>Parcela Ideal / Possível</Text>
                      <TextInput style={[styles.input, themeStyles.input]} value={formData.idealInstallment || ''} onChangeText={t => handleChange('idealInstallment', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} />
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, themeStyles.label]}>Informações (Lembretes, Observações e Histórico)</Text>
                    <TextInput style={[styles.input, themeStyles.input, { height: 220, textAlignVertical: 'top' }]} multiline={true} value={formData.initialInfo || ''} onChangeText={t => handleChange('initialInfo', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} />
                  </View>
                </View>
              )}

              {activeTab === 'agendamentos' && (
                <View style={[styles.splitContainer, isMobile && styles.splitContainerMobile]}>
                  
                  {/* Bloco da Esquerda: Criar Agendamento */}
                  <View style={[styles.splitLeft, isMobile && styles.splitLeftMobile]}>
                    <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>Criar Novo Agendamento</Text>
                    
                    <View style={styles.apptTypeContainer}>
                      {['Ligar', 'Visitar', 'Mensagem', 'Simulação'].map(tipo => (
                        <TouchableOpacity key={tipo} style={[styles.apptTypeBtn, themeStyles.apptTypeBtn, apptType === tipo && themeStyles.apptTypeBtnActive]} onPress={() => setApptType(tipo)}>
                          <Text style={[styles.apptTypeText, themeStyles.apptTypeText, apptType === tipo && themeStyles.apptTypeTextActive]}>{tipo}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={[styles.row, isMobile && styles.rowMobile]}>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, themeStyles.label]}>Data (DD/MM/AAAA)</Text>
                        <TextInput style={[styles.inputSmall, themeStyles.inputSmall]} placeholder="Ex: 25/12/2026" placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} value={apptDate} onChangeText={handleDateChange} keyboardType="numeric" maxLength={10} />
                      </View>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, themeStyles.label]}>Horário (HH:MM)</Text>
                        <TextInput style={[styles.inputSmall, themeStyles.inputSmall]} placeholder="Ex: 14:30" placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} value={apptTime} onChangeText={handleTimeChange} keyboardType="numeric" maxLength={5} />
                      </View>
                    </View>

                    <Text style={[styles.label, themeStyles.label]}>Lembrar-me com antecedência de:</Text>
                    <View style={styles.apptTypeContainer}>
                      {[0, 15, 30, 60, 120].map(mins => (
                        <TouchableOpacity key={mins} style={[styles.apptTypeBtn, themeStyles.apptTypeBtn, apptReminder === mins && themeStyles.apptTypeBtnActive]} onPress={() => setApptReminder(mins)}>
                          <Text style={[styles.apptTypeText, themeStyles.apptTypeText, apptReminder === mins && themeStyles.apptTypeTextActive]}>
                            {mins === 0 ? 'Na hora' : mins === 60 ? '1 hora' : mins === 120 ? '2 horas' : `${mins}m`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity style={styles.saveApptBtn} onPress={handleAddAppointment}>
                      <Text style={styles.saveApptBtnText}>+ Programar Agendamento</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Bloco da Direita: Agendamentos Ativos */}
                  <View style={[styles.splitRight, themeStyles.splitRight, isMobile && styles.splitRightMobile]}>
                    <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>Agendamentos Ativos</Text>
                    
                    <View style={{ width: '100%' }}>
                      {(!formData.appointments || formData.appointments.length === 0) ? (
                        <Text style={[styles.noCommentsText, themeStyles.noCommentsText]}>Nenhum agendamento futuro.</Text>
                      ) : (
                        formData.appointments.map(appt => (
                          <View key={appt.id} style={[styles.scheduledCard, themeStyles.scheduledCard, appt.notified && themeStyles.scheduledCardDone]}>
                            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4}}>
                              <Text style={[styles.scheduledCardTitle, themeStyles.scheduledCardTitle]}>{appt.type}</Text>
                              
                              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                <Text style={[styles.scheduledCardReminder, themeStyles.scheduledCardReminder]}>{appt.reminderMinutes === 0 ? 'Na hora' : `${appt.reminderMinutes}m antes`}</Text>
                                {!appt.notified && (
                                  <TouchableOpacity onPress={() => handleDeleteAppointment(appt.id)} style={[styles.deleteApptBtn, themeStyles.deleteApptBtn]}>
                                    <Text style={{fontSize: 14, color: '#ef4444'}}>🗑️</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                            
                            <Text style={[styles.scheduledCardDate, themeStyles.scheduledCardDate]}>
                              📅 {new Date(appt.dateTime).toLocaleDateString('pt-BR')} às {new Date(appt.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            
                            {appt.notified && <Text style={styles.scheduledCardStatus}>✓ Concluído</Text>}
                          </View>
                        ))
                      )}
                    </View>
                  </View>

                </View>
              )}

              {activeTab === 'dados' && (
                <View style={styles.formSection}>
                  <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>Dados Pessoais e Contato</Text>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>Nome Completo</Text><TextInput style={[styles.input, themeStyles.input]} value={formData.name || ''} onChangeText={t => handleChange('name', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} /></View>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>CPF</Text><TextInput style={[styles.input, themeStyles.input]} value={formData.cpf || ''} onChangeText={t => handleChange('cpf', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} /></View>
                  </View>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, themeStyles.label]}>Telefone / WhatsApp</Text>
                      <TextInput style={[styles.input, themeStyles.input]} value={formData.phone || ''} onChangeText={t => handleChange('phone', t)} maxLength={19} keyboardType="phone-pad" placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} />
                    </View>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>E-mail</Text><TextInput style={[styles.input, themeStyles.input]} value={formData.email || ''} onChangeText={t => handleChange('email', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} /></View>
                  </View>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>Profissão</Text><TextInput style={[styles.input, themeStyles.input]} value={formData.profession || ''} onChangeText={t => handleChange('profession', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} /></View>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>Renda Mensal</Text><TextInput style={[styles.input, themeStyles.input]} value={formData.monthlyIncome || ''} onChangeText={t => handleChange('monthlyIncome', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} /></View>
                  </View>
                </View>
              )}

              {activeTab === 'consorcio' && (
                <View style={styles.formSection}>
                  <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>Detalhes do Interesse</Text>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>Categoria (Auto, Imóvel)</Text><TextInput style={[styles.input, themeStyles.input]} value={formData.category || ''} onChangeText={t => handleChange('category', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} /></View>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>Urgência</Text><TextInput style={[styles.input, themeStyles.input]} value={formData.urgency || ''} onChangeText={t => handleChange('urgency', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} /></View>
                  </View>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>Origem / Plataforma (Ex: Facebook)</Text><TextInput style={[styles.input, themeStyles.input]} value={formData.platform || formData.origin || ''} onChangeText={t => handleChange('platform', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} /></View>
                  </View>
                </View>
              )}

              {activeTab === 'financeiro' && (
                <View style={styles.formSection}>
                  <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>Perfil Financeiro e Lances</Text>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>Valor Disponível p/ Lance</Text><TextInput style={[styles.input, themeStyles.input]} value={formData.bidAmount || ''} onChangeText={t => handleChange('bidAmount', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} /></View>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>Tipo de Lance Preferido</Text><TextInput style={[styles.input, themeStyles.input]} placeholder="Livre, Embutido, FGTS..." placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} value={formData.bidType || ''} onChangeText={t => handleChange('bidType', t)} /></View>
                  </View>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>Possui Financiamento Ativo?</Text><TextInput style={[styles.input, themeStyles.input]} value={formData.hasFinancing || ''} onChangeText={t => handleChange('hasFinancing', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} /></View>
                  </View>
                </View>
              )}

              {activeTab === 'docs' && (
                <View style={styles.formSection}>
                  <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>Documentos Anexos</Text>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, themeStyles.label]}>Documento Pessoal (RG/CNH)</Text>
                      {formData.docPessoalUrl && (
                        <TouchableOpacity style={[styles.viewDocButton, themeStyles.viewDocButton]} onPress={() => Linking.openURL(formData.docPessoalUrl)}>
                          <Text style={[styles.viewDocText, themeStyles.viewDocText]}>Visualizar Documento</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.uploadButton, themeStyles.uploadButton]} onPress={() => handleUpload('docPessoalUrl')} disabled={uploadingDoc}>
                        {uploadingDoc ? <ActivityIndicator size="small" color="#2563eb" /> : <Text style={[styles.uploadButtonText, themeStyles.uploadButtonText]}>{formData.docPessoalUrl ? 'Substituir' : 'Fazer Upload'}</Text>}
                      </TouchableOpacity>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, themeStyles.label]}>Comprovante de Residência</Text>
                      {formData.docResidenciaUrl && (
                        <TouchableOpacity style={[styles.viewDocButton, themeStyles.viewDocButton]} onPress={() => Linking.openURL(formData.docResidenciaUrl)}>
                          <Text style={[styles.viewDocText, themeStyles.viewDocText]}>Visualizar Comprovante</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.uploadButton, themeStyles.uploadButton]} onPress={() => handleUpload('docResidenciaUrl')} disabled={uploadingDoc}>
                        {uploadingDoc ? <ActivityIndicator size="small" color="#2563eb" /> : <Text style={[styles.uploadButtonText, themeStyles.uploadButtonText]}>{formData.docResidenciaUrl ? 'Substituir' : 'Fazer Upload'}</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {activeTab === 'kpis' && (
                <View style={styles.formSection}>
                  <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>Campos Inteligentes</Text>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>Temperatura do Lead</Text><TextInput style={[styles.input, themeStyles.input]} placeholder="Frio, Morno, Quente" placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} value={formData.leadTemp || ''} onChangeText={t => handleChange('leadTemp', t)} /></View>
                    <View style={styles.inputGroup}><Text style={[styles.label, themeStyles.label]}>Probabilidade de Fechamento (%)</Text><TextInput style={[styles.input, themeStyles.input]} value={formData.winProbability || ''} onChangeText={t => handleChange('winProbability', t)} placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} /></View>
                  </View>
                </View>
              )}

              {isAdmin && activeTab === 'transferir' && (
                <View style={styles.formSection}>
                  <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>Transferência de Lead</Text>
                  
                  <Text style={[styles.label, themeStyles.label]}>Selecione o Vendedor Destino:</Text>
                  <ScrollView nestedScrollEnabled={true} style={[styles.userListContainer, themeStyles.userListContainer]}>
                    {usersList?.filter(u => u.id !== currentUserId).map(u => (
                      <TouchableOpacity 
                        key={u.id} 
                        style={[styles.userOption, themeStyles.userOption, selectedTransferUserId === u.id && themeStyles.userOptionSelected]} 
                        onPress={() => setSelectedTransferUserId(u.id)}
                      >
                        <Text style={[styles.userOptionText, themeStyles.userOptionText, selectedTransferUserId === u.id && themeStyles.userOptionTextSelected]}>
                          {u.name || u.email}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {usersList?.filter(u => u.id !== currentUserId).length === 0 && (
                       <Text style={{ padding: 12, color: '#94a3b8', fontStyle: 'italic' }}>Nenhum outro vendedor disponível.</Text>
                    )}
                  </ScrollView>

                  <TouchableOpacity style={styles.checkboxContainer} onPress={() => setTransferWithoutComment(!transferWithoutComment)}>
                    <View style={[styles.checkbox, themeStyles.checkbox, transferWithoutComment && styles.checkboxChecked]}>
                      {transferWithoutComment && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.checkboxLabel, themeStyles.checkboxLabel]}>Transferir sem registrar comentário automático no card</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isMobile && activeTab === 'comentarios' && <CommentsSection />}
            </ScrollView>

            {!isMobile && (
              <View style={[styles.commentsSidebarDesktop, themeStyles.commentsSidebarDesktop]}>
                <CommentsSection />
              </View>
            )}

          </View>

          <View style={[styles.footer, themeStyles.footer, isMobile && styles.footerMobile]}>
            <TouchableOpacity style={[styles.cancelButton, themeStyles.cancelButton, isMobile && { flex: 1, alignItems: 'center' }]} onPress={onClose}>
              <Text style={[styles.cancelButtonText, themeStyles.cancelButtonText]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, isMobile && { flex: 1, alignItems: 'center' }]} onPress={handleSave}>
              <Text style={styles.saveButtonText}>{activeTab === 'transferir' ? 'Confirmar Transferência' : 'Salvar Alterações'}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalWrapper: { width: '100%', maxWidth: 1150, height: '90%', borderRadius: 16, overflow: 'hidden', ...Platform.select({ web: { outlineStyle: 'none' } }) },
  modalWrapperMobile: { height: '100%', borderRadius: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 24, borderBottomWidth: 1 },
  headerMobile: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800' },
  titleMobile: { fontSize: 18 },
  subtitle: { fontSize: 13, marginTop: 4 },
  closeButton: { padding: 8, borderRadius: 8 },
  closeButtonText: { fontSize: 16, fontWeight: 'bold' },
  body: { flex: 1, flexDirection: 'row' },
  bodyMobile: { flexDirection: 'column' }, 
  sidebar: { width: 220, padding: 16, borderRightWidth: 1 },
  tabButton: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4 },
  tabText: { fontSize: 14, fontWeight: '600' },
  sidebarMobileContainer: { borderBottomWidth: 1 },
  sidebarMobile: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row' },
  tabButtonMobile: { marginRight: 8, marginBottom: 0, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  tabTextMobile: { fontSize: 13 },
  contentArea: { flex: 1, padding: 24 },
  contentAreaMobile: { padding: 16 },
  formSection: { paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  row: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  rowMobile: { flexDirection: 'column', gap: 0, marginBottom: 0 }, 
  inputGroup: { flex: 1, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  inputSmall: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, ...Platform.select({ web: { outlineStyle: 'none' } }) },

  splitContainer: { flexDirection: 'row', width: '100%', gap: 24 },
  splitContainerMobile: { flexDirection: 'column', width: '100%' },
  splitLeft: { flex: 1.6 },
  splitLeftMobile: { width: '100%', marginBottom: 28 }, 
  splitRight: { flex: 1, borderLeftWidth: 1, paddingLeft: 24 },
  splitRightMobile: { width: '100%', borderLeftWidth: 0, paddingLeft: 0, borderTopWidth: 1, paddingTop: 20, marginTop: 35 },
  
  apptTypeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  apptTypeBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  apptTypeText: { fontWeight: '600', fontSize: 12 },
  saveApptBtn: { backgroundColor: '#f59e0b', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 12, marginBottom: 8 },
  saveApptBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  deleteApptBtn: { padding: 4, borderRadius: 6 },

  scheduledCard: { borderWidth: 1, borderLeftWidth: 4, borderLeftColor: '#f59e0b', borderRadius: 8, padding: 12, marginBottom: 10, ...Platform.select({ web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.03)' } }) },
  scheduledCardDone: { opacity: 0.5, borderLeftColor: '#cbd5e1' },
  scheduledCardTitle: { fontSize: 14, fontWeight: 'bold' },
  scheduledCardReminder: { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  scheduledCardDate: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  scheduledCardStatus: { fontSize: 10, color: '#10b981', marginTop: 8, fontWeight: 'bold' },

  uploadButton: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 16, alignItems: 'center' },
  uploadButtonText: { fontWeight: '600', fontSize: 14 },
  viewDocButton: { padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
  viewDocText: { fontWeight: '600', fontSize: 13, textAlign: 'center' },
  
  commentsSidebarDesktop: { width: 340, borderLeftWidth: 1, padding: 16, paddingBottom: 0 },
  commentsContainer: { flex: 1 },
  commentsContainerMobile: { paddingBottom: 20 },
  commentsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  commentInputContainer: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 16 },
  commentInput: { height: 60, textAlignVertical: 'top', fontSize: 13, marginBottom: 12, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  addCommentBtn: { alignSelf: 'flex-end', backgroundColor: '#10b981', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 6 },
  addCommentBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 12 },
  commentsList: { flex: 1 },
  noCommentsText: { fontStyle: 'italic', textAlign: 'center', marginTop: 20, fontSize: 13 },
  commentCard: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  commentDate: { fontSize: 10, marginBottom: 6, fontWeight: '600' },
  commentTextManual: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  commentTextAuto: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },

  footer: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, gap: 12 },
  footerMobile: { padding: 16 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  cancelButtonText: { fontWeight: '600', fontSize: 14 },
  saveButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, backgroundColor: '#2563eb' },
  saveButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },

  successAlertOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  successAlertBox: { padding: 24, borderRadius: 16, alignItems: 'center', width: 320 },
  successAlertIcon: { fontSize: 48, marginBottom: 12 },
  successAlertTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  successAlertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  successAlertBtn: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 8, width: '100%', alignItems: 'center' },
  successAlertBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },

  userListContainer: { maxHeight: 180, borderWidth: 1, borderRadius: 8, marginBottom: 20 },
  userOption: { padding: 14, borderBottomWidth: 1 },
  userOptionText: { fontSize: 13, fontWeight: '600' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderRadius: 6, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkmark: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  checkboxLabel: { fontSize: 13, flex: 1, flexWrap: 'wrap' }
});

/* Estilos de Tema Claro */
const lightStyles = StyleSheet.create({
  modalWrapper: { backgroundColor: '#ffffff', ...Platform.select({ web: { boxShadow: '0px 10px 25px rgba(0,0,0,0.15)' } }) },
  header: { borderBottomColor: '#f1f5f9' },
  title: { color: '#0f172a' },
  subtitle: { color: '#64748b' },
  closeButton: { backgroundColor: '#f8fafc' },
  closeButtonText: { color: '#64748b' },
  body: { backgroundColor: '#ffffff' },
  sidebar: { backgroundColor: '#f8fafc', borderRightColor: '#f1f5f9' },
  tabButtonActive: { backgroundColor: '#eff6ff' },
  tabText: { color: '#64748b' },
  tabTextActive: { color: '#2563eb' },
  sidebarMobileContainer: { borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  tabButtonMobile: { backgroundColor: '#e2e8f0' },
  tabButtonMobileActive: { backgroundColor: '#2563eb' },
  tabTextMobile: { color: '#475569' },
  tabTextMobileActive: { color: '#ffffff' },
  contentArea: { backgroundColor: '#ffffff' },
  sectionTitle: { color: '#1e293b' },
  label: { color: '#475569' },
  input: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#0f172a' },
  inputSmall: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#0f172a' },
  splitRight: { borderColor: '#e2e8f0' },
  apptTypeBtn: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  apptTypeBtnActive: { backgroundColor: '#e0e7ff', borderColor: '#4f46e5' },
  apptTypeText: { color: '#64748b' },
  apptTypeTextActive: { color: '#4f46e5' },
  deleteApptBtn: { backgroundColor: '#fee2e2' },
  scheduledCard: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  scheduledCardDone: { backgroundColor: '#f8fafc' },
  scheduledCardTitle: { color: '#1e293b' },
  scheduledCardReminder: { color: '#f59e0b', backgroundColor: '#fef3c7' },
  scheduledCardDate: { color: '#475569' },
  uploadButton: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  uploadButtonText: { color: '#475569' },
  viewDocButton: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  viewDocText: { color: '#2563eb' },
  commentsSidebarDesktop: { backgroundColor: '#f8fafc', borderLeftColor: '#e2e8f0' },
  commentsTitle: { color: '#1e293b' },
  commentInputContainer: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  commentInput: { color: '#0f172a' },
  noCommentsText: { color: '#94a3b8' },
  commentDate: { color: '#64748b' },
  commentCardManual: { backgroundColor: '#ffffff', borderColor: '#bfdbfe', borderLeftColor: '#3b82f6', borderLeftWidth: 4 },
  commentTextManual: { color: '#1e293b' },
  commentCardAuto: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderLeftColor: '#cbd5e1', borderLeftWidth: 4 },
  commentTextAuto: { color: '#64748b' },
  footer: { borderTopColor: '#f1f5f9', backgroundColor: '#ffffff' },
  cancelButton: { backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#475569' },
  successAlertBox: { backgroundColor: '#ffffff', ...Platform.select({ web: { boxShadow: '0px 10px 25px rgba(0,0,0,0.2)' } }) },
  successAlertTitle: { color: '#1e293b' },
  successAlertMessage: { color: '#475569' },
  userListContainer: { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  userOption: { borderBottomColor: '#f1f5f9' },
  userOptionSelected: { backgroundColor: '#e0e7ff' },
  userOptionText: { color: '#475569' },
  userOptionTextSelected: { color: '#4f46e5' },
  checkbox: { borderColor: '#cbd5e1', backgroundColor: '#fff' },
  checkboxLabel: { color: '#475569' }
});

/* Estilos de Tema Escuro */
const darkStyles = StyleSheet.create({
  modalWrapper: { backgroundColor: '#1e293b', ...Platform.select({ web: { boxShadow: '0px 10px 25px rgba(0,0,0,0.4)' } }) },
  header: { borderBottomColor: '#334155' },
  title: { color: '#f8fafc' },
  subtitle: { color: '#94a3b8' },
  closeButton: { backgroundColor: '#334155' },
  closeButtonText: { color: '#f8fafc' },
  body: { backgroundColor: '#0f172a' },
  sidebar: { backgroundColor: '#1e293b', borderRightColor: '#334155' },
  tabButtonActive: { backgroundColor: '#334155' },
  tabText: { color: '#94a3b8' },
  tabTextActive: { color: '#60a5fa' },
  sidebarMobileContainer: { borderBottomColor: '#334155', backgroundColor: '#1e293b' },
  tabButtonMobile: { backgroundColor: '#334155' },
  tabButtonMobileActive: { backgroundColor: '#2563eb' },
  tabTextMobile: { color: '#cbd5e1' },
  tabTextMobileActive: { color: '#ffffff' },
  contentArea: { backgroundColor: '#0f172a' },
  sectionTitle: { color: '#f8fafc' },
  label: { color: '#cbd5e1' },
  input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' },
  inputSmall: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' },
  splitRight: { borderColor: '#334155' },
  apptTypeBtn: { backgroundColor: '#1e293b', borderColor: '#334155' },
  apptTypeBtnActive: { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' },
  apptTypeText: { color: '#94a3b8' },
  apptTypeTextActive: { color: '#93c5fd' },
  deleteApptBtn: { backgroundColor: '#450a0a' },
  scheduledCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
  scheduledCardDone: { backgroundColor: '#0f172a' },
  scheduledCardTitle: { color: '#f8fafc' },
  scheduledCardReminder: { color: '#fbbf24', backgroundColor: '#451a03' },
  scheduledCardDate: { color: '#94a3b8' },
  uploadButton: { backgroundColor: '#1e293b', borderColor: '#475569' },
  uploadButtonText: { color: '#cbd5e1' },
  viewDocButton: { backgroundColor: '#1e3a8a', borderColor: '#1d4ed8' },
  viewDocText: { color: '#93c5fd' },
  commentsSidebarDesktop: { backgroundColor: '#1e293b', borderLeftColor: '#334155' },
  commentsTitle: { color: '#f8fafc' },
  commentInputContainer: { backgroundColor: '#1e293b', borderColor: '#334155' },
  commentInput: { color: '#f8fafc' },
  noCommentsText: { color: '#64748b' },
  commentDate: { color: '#94a3b8' },
  commentCardManual: { backgroundColor: '#1e293b', borderColor: '#1e3a8a', borderLeftColor: '#3b82f6', borderLeftWidth: 4 },
  commentTextManual: { color: '#f8fafc' },
  commentCardAuto: { backgroundColor: '#0f172a', borderColor: '#334155', borderLeftColor: '#475569', borderLeftWidth: 4 },
  commentTextAuto: { color: '#94a3b8' },
  footer: { borderTopColor: '#334155', backgroundColor: '#1e293b' },
  cancelButton: { backgroundColor: '#334155' },
  cancelButtonText: { color: '#cbd5e1' },
  successAlertBox: { backgroundColor: '#1e293b', ...Platform.select({ web: { boxShadow: '0px 10px 25px rgba(0,0,0,0.4)' } }) },
  successAlertTitle: { color: '#f8fafc' },
  successAlertMessage: { color: '#94a3b8' },
  userListContainer: { borderColor: '#334155', backgroundColor: '#1e293b' },
  userOption: { borderBottomColor: '#334155' },
  userOptionSelected: { backgroundColor: '#1e3a8a' },
  userOptionText: { color: '#cbd5e1' },
  userOptionTextSelected: { color: '#93c5fd' },
  checkbox: { borderColor: '#475569', backgroundColor: '#0f172a' },
  checkboxLabel: { color: '#cbd5e1' }
});