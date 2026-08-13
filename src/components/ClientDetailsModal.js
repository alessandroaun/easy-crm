import React, { useState, useEffect, useRef } from 'react';
import { 
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView, ActivityIndicator, Linking, useWindowDimensions, Animated 
} from 'react-native';
import { setLeadUpdateCallback } from './WhatsAppBulkModal';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../services/supabaseClient';

export default function ClientDetailsModal({ visible, onClose, clientData, onSave, isAdmin, usersList, currentUserId, onTransferLead }) {
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

  const TabButton = ({ id, label }) => {
    const isActive = activeTab === id;
    return (
      <TouchableOpacity 
        style={[
          styles.tabButton, 
          isMobile && styles.tabButtonMobile, 
          isActive && styles.tabButtonActive, 
          isMobile && isActive && styles.tabButtonMobileActive
        ]} 
        onPress={() => setActiveTab(id)}
      >
        <Text style={[
          styles.tabText, 
          isMobile && styles.tabTextMobile, 
          isActive && styles.tabTextActive,
          isMobile && isActive && styles.tabTextMobileActive
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const CommentsSection = () => (
    <View style={[styles.commentsContainer, isMobile && styles.commentsContainerMobile]}>
      <Text style={styles.commentsTitle}>Atividades e Comentários</Text>
      <View style={styles.commentInputContainer}>
        <TextInput style={styles.commentInput} placeholder="Registre uma ação..." multiline={true} value={newCommentText} onChangeText={setNewCommentText} />
        <TouchableOpacity style={styles.addCommentBtn} onPress={handleAddComment}><Text style={styles.addCommentBtnText}>Salvar</Text></TouchableOpacity>
      </View>
      <ScrollView style={styles.commentsList} showsVerticalScrollIndicator={false}>
        {(!formData.comments || formData.comments.length === 0) ? (
          <Text style={styles.noCommentsText}>Nenhuma interação registrada.</Text>
        ) : (
          formData.comments.map(comment => {
            const isSystem = comment.text.includes('Sistema:');
            return (
              <View key={comment.id} style={[styles.commentCard, isSystem ? styles.commentCardAuto : styles.commentCardManual]}>
                <Text style={styles.commentDate}>{new Date(comment.date).toLocaleDateString('pt-BR')} às {new Date(comment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
                <Text style={[styles.commentText, isSystem ? styles.commentTextAuto : styles.commentTextManual]}>{comment.text}</Text>
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
            <Animated.View style={[styles.successAlertBox, { opacity: alertOpacity, transform: [{ scale: alertScale }] }]}>
              <Text style={styles.successAlertIcon}>{alertConfig.type === 'success' ? '✅' : '⚠️'}</Text>
              <Text style={styles.successAlertTitle}>{alertConfig.title}</Text>
              <Text style={styles.successAlertMessage}>{alertConfig.message}</Text>
              <TouchableOpacity 
                style={[styles.successAlertBtn, alertConfig.type === 'error' && { backgroundColor: '#ef4444' }]} 
                onPress={closeCustomAlert}
              >
                <Text style={styles.successAlertBtnText}>{alertConfig.type === 'success' ? 'Continuar' : 'Entendi'}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        <View style={[styles.modalWrapper, isMobile && styles.modalWrapperMobile]}>
          
          <View style={[styles.header, isMobile && styles.headerMobile]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1}>{formData.name || 'Detalhes do Lead'}</Text>
              {formData.createdAt && <Text style={styles.subtitle}>Cadastrado em: {new Date(formData.createdAt).toLocaleDateString('pt-BR')} às {new Date(formData.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}><Text style={styles.closeButtonText}>✕</Text></TouchableOpacity>
          </View>

          <View style={[styles.body, isMobile && styles.bodyMobile]}>
            
            {isMobile ? (
              <View style={styles.sidebarMobileContainer}>
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
              <View style={styles.sidebar}>
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

            <ScrollView style={[styles.contentArea, isMobile && styles.contentAreaMobile]} showsVerticalScrollIndicator={false}>
              
              {activeTab === 'informacoes' && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Informações Principais</Text>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={styles.label}>Valor Desejado (Crédito)</Text><TextInput style={styles.input} value={formData.desiredCredit || ''} onChangeText={t => handleChange('desiredCredit', t)} /></View>
                    <View style={styles.inputGroup}><Text style={styles.label}>Parcela Ideal / Possível</Text><TextInput style={styles.input} value={formData.idealInstallment || ''} onChangeText={t => handleChange('idealInstallment', t)} /></View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Informações (Lembretes, Observações e Histórico)</Text>
                    <TextInput style={[styles.input, { height: 220, textAlignVertical: 'top' }]} multiline={true} value={formData.initialInfo || ''} onChangeText={t => handleChange('initialInfo', t)} />
                  </View>
                </View>
              )}

              {activeTab === 'agendamentos' && (
                <View style={[styles.splitContainer, isMobile && styles.splitContainerMobile]}>
                  
                  {/* Bloco da Esquerda: Criar Agendamento */}
                  <View style={[styles.splitLeft, isMobile && styles.splitLeftMobile]}>
                    <Text style={styles.sectionTitle}>Criar Novo Agendamento</Text>
                    
                    <View style={styles.apptTypeContainer}>
                      {['Ligar', 'Visitar', 'Mensagem', 'Simulação'].map(tipo => (
                        <TouchableOpacity key={tipo} style={[styles.apptTypeBtn, apptType === tipo && styles.apptTypeBtnActive]} onPress={() => setApptType(tipo)}>
                          <Text style={[styles.apptTypeText, apptType === tipo && styles.apptTypeTextActive]}>{tipo}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={[styles.row, isMobile && styles.rowMobile]}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Data (DD/MM/AAAA)</Text>
                        <TextInput style={styles.inputSmall} placeholder="Ex: 25/12/2026" value={apptDate} onChangeText={handleDateChange} keyboardType="numeric" maxLength={10} />
                      </View>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Horário (HH:MM)</Text>
                        <TextInput style={styles.inputSmall} placeholder="Ex: 14:30" value={apptTime} onChangeText={handleTimeChange} keyboardType="numeric" maxLength={5} />
                      </View>
                    </View>

                    <Text style={styles.label}>Lembrar-me com antecedência de:</Text>
                    <View style={styles.apptTypeContainer}>
                      {[0, 15, 30, 60, 120].map(mins => (
                        <TouchableOpacity key={mins} style={[styles.apptTypeBtn, apptReminder === mins && styles.apptTypeBtnActive]} onPress={() => setApptReminder(mins)}>
                          <Text style={[styles.apptTypeText, apptReminder === mins && styles.apptTypeTextActive]}>
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
                  <View style={[styles.splitRight, isMobile && styles.splitRightMobile]}>
                    <Text style={styles.sectionTitle}>Agendamentos Ativos</Text>
                    
                    <View style={{ width: '100%' }}>
                      {(!formData.appointments || formData.appointments.length === 0) ? (
                        <Text style={styles.noCommentsText}>Nenhum agendamento futuro.</Text>
                      ) : (
                        formData.appointments.map(appt => (
                          <View key={appt.id} style={[styles.scheduledCard, appt.notified && styles.scheduledCardDone]}>
                            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4}}>
                              <Text style={styles.scheduledCardTitle}>{appt.type}</Text>
                              
                              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                <Text style={styles.scheduledCardReminder}>{appt.reminderMinutes === 0 ? 'Na hora' : `${appt.reminderMinutes}m antes`}</Text>
                                {!appt.notified && (
                                  <TouchableOpacity onPress={() => handleDeleteAppointment(appt.id)} style={styles.deleteApptBtn}>
                                    <Text style={{fontSize: 14, color: '#ef4444'}}>🗑️</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                            
                            <Text style={styles.scheduledCardDate}>
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
                  <Text style={styles.sectionTitle}>Dados Pessoais e Contato</Text>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={styles.label}>Nome Completo</Text><TextInput style={styles.input} value={formData.name || ''} onChangeText={t => handleChange('name', t)} /></View>
                    <View style={styles.inputGroup}><Text style={styles.label}>CPF</Text><TextInput style={styles.input} value={formData.cpf || ''} onChangeText={t => handleChange('cpf', t)} /></View>
                  </View>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Telefone / WhatsApp</Text>
                      <TextInput style={styles.input} value={formData.phone || ''} onChangeText={t => handleChange('phone', t)} maxLength={19} keyboardType="phone-pad" />
                    </View>
                    <View style={styles.inputGroup}><Text style={styles.label}>E-mail</Text><TextInput style={styles.input} value={formData.email || ''} onChangeText={t => handleChange('email', t)} /></View>
                  </View>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={styles.label}>Profissão</Text><TextInput style={styles.input} value={formData.profession || ''} onChangeText={t => handleChange('profession', t)} /></View>
                    <View style={styles.inputGroup}><Text style={styles.label}>Renda Mensal</Text><TextInput style={styles.input} value={formData.monthlyIncome || ''} onChangeText={t => handleChange('monthlyIncome', t)} /></View>
                  </View>
                </View>
              )}

              {activeTab === 'consorcio' && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Detalhes do Interesse</Text>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={styles.label}>Categoria (Auto, Imóvel)</Text><TextInput style={styles.input} value={formData.category || ''} onChangeText={t => handleChange('category', t)} /></View>
                    <View style={styles.inputGroup}><Text style={styles.label}>Urgência</Text><TextInput style={styles.input} value={formData.urgency || ''} onChangeText={t => handleChange('urgency', t)} /></View>
                  </View>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={styles.label}>Origem / Plataforma (Ex: Facebook)</Text><TextInput style={styles.input} value={formData.platform || formData.origin || ''} onChangeText={t => handleChange('platform', t)} /></View>
                  </View>
                </View>
              )}

              {activeTab === 'financeiro' && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Perfil Financeiro e Lances</Text>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={styles.label}>Valor Disponível p/ Lance</Text><TextInput style={styles.input} value={formData.bidAmount || ''} onChangeText={t => handleChange('bidAmount', t)} /></View>
                    <View style={styles.inputGroup}><Text style={styles.label}>Tipo de Lance Preferido</Text><TextInput style={styles.input} placeholder="Livre, Embutido, FGTS..." value={formData.bidType || ''} onChangeText={t => handleChange('bidType', t)} /></View>
                  </View>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={styles.label}>Possui Financiamento Ativo?</Text><TextInput style={styles.input} value={formData.hasFinancing || ''} onChangeText={t => handleChange('hasFinancing', t)} /></View>
                  </View>
                </View>
              )}

              {activeTab === 'docs' && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Documentos Anexos</Text>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Documento Pessoal (RG/CNH)</Text>
                      {formData.docPessoalUrl && (
                        <TouchableOpacity style={styles.viewDocButton} onPress={() => Linking.openURL(formData.docPessoalUrl)}>
                          <Text style={styles.viewDocText}>Visualizar Documento</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.uploadButton} onPress={() => handleUpload('docPessoalUrl')} disabled={uploadingDoc}>
                        {uploadingDoc ? <ActivityIndicator size="small" color="#2563eb" /> : <Text style={styles.uploadButtonText}>{formData.docPessoalUrl ? 'Substituir' : 'Fazer Upload'}</Text>}
                      </TouchableOpacity>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Comprovante de Residência</Text>
                      {formData.docResidenciaUrl && (
                        <TouchableOpacity style={styles.viewDocButton} onPress={() => Linking.openURL(formData.docResidenciaUrl)}>
                          <Text style={styles.viewDocText}>Visualizar Comprovante</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.uploadButton} onPress={() => handleUpload('docResidenciaUrl')} disabled={uploadingDoc}>
                        {uploadingDoc ? <ActivityIndicator size="small" color="#2563eb" /> : <Text style={styles.uploadButtonText}>{formData.docResidenciaUrl ? 'Substituir' : 'Fazer Upload'}</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {activeTab === 'kpis' && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Campos Inteligentes</Text>
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.inputGroup}><Text style={styles.label}>Temperatura do Lead</Text><TextInput style={styles.input} placeholder="Frio, Morno, Quente" value={formData.leadTemp || ''} onChangeText={t => handleChange('leadTemp', t)} /></View>
                    <View style={styles.inputGroup}><Text style={styles.label}>Probabilidade de Fechamento (%)</Text><TextInput style={styles.input} value={formData.winProbability || ''} onChangeText={t => handleChange('winProbability', t)} /></View>
                  </View>
                </View>
              )}

              {isAdmin && activeTab === 'transferir' && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Transferência de Lead</Text>
                  
                  <Text style={styles.label}>Selecione o Vendedor Destino:</Text>
                  <ScrollView nestedScrollEnabled={true} style={styles.userListContainer}>
                    {usersList?.filter(u => u.id !== currentUserId).map(u => (
                      <TouchableOpacity 
                        key={u.id} 
                        style={[styles.userOption, selectedTransferUserId === u.id && styles.userOptionSelected]} 
                        onPress={() => setSelectedTransferUserId(u.id)}
                      >
                        <Text style={[styles.userOptionText, selectedTransferUserId === u.id && styles.userOptionTextSelected]}>
                          {u.name || u.email}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {usersList?.filter(u => u.id !== currentUserId).length === 0 && (
                       <Text style={{ padding: 12, color: '#94a3b8', fontStyle: 'italic' }}>Nenhum outro vendedor disponível.</Text>
                    )}
                  </ScrollView>

                  <TouchableOpacity style={styles.checkboxContainer} onPress={() => setTransferWithoutComment(!transferWithoutComment)}>
                    <View style={[styles.checkbox, transferWithoutComment && styles.checkboxChecked]}>
                      {transferWithoutComment && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>Transferir sem registrar comentário automático no card</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isMobile && activeTab === 'comentarios' && <CommentsSection />}
            </ScrollView>

            {!isMobile && (
              <View style={styles.commentsSidebarDesktop}>
                <CommentsSection />
              </View>
            )}

          </View>

          <View style={[styles.footer, isMobile && styles.footerMobile]}>
            <TouchableOpacity style={[styles.cancelButton, isMobile && { flex: 1, alignItems: 'center' }]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
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
  modalWrapper: { width: '100%', maxWidth: 1150, height: '90%', backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 25px rgba(0,0,0,0.15)' } }) },
  modalWrapperMobile: { height: '100%', borderRadius: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerMobile: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  titleMobile: { fontSize: 18 },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  closeButton: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 8 },
  closeButtonText: { fontSize: 16, color: '#64748b', fontWeight: 'bold' },
  body: { flex: 1, flexDirection: 'row' },
  bodyMobile: { flexDirection: 'column' }, 
  sidebar: { width: 220, backgroundColor: '#f8fafc', padding: 16, borderRightWidth: 1, borderRightColor: '#f1f5f9' },
  tabButton: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4 },
  tabButtonActive: { backgroundColor: '#eff6ff' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#2563eb' },
  sidebarMobileContainer: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  sidebarMobile: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row' },
  tabButtonMobile: { marginRight: 8, marginBottom: 0, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#e2e8f0', borderRadius: 20 },
  tabButtonMobileActive: { backgroundColor: '#2563eb' },
  tabTextMobile: { fontSize: 13, color: '#475569' },
  tabTextMobileActive: { color: '#ffffff', fontWeight: '700' },
  contentArea: { flex: 1, padding: 24, backgroundColor: '#ffffff' },
  contentAreaMobile: { padding: 16 },
  formSection: { paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
  row: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  rowMobile: { flexDirection: 'column', gap: 0, marginBottom: 0 }, 
  inputGroup: { flex: 1, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 14, color: '#0f172a', ...Platform.select({ web: { outlineStyle: 'none' } }) },
  inputSmall: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 13, color: '#0f172a', ...Platform.select({ web: { outlineStyle: 'none' } }) },

  splitContainer: { flexDirection: 'row', width: '100%', gap: 24 },
  splitContainerMobile: { flexDirection: 'column', width: '100%' },
  splitLeft: { flex: 1.6 },
  splitLeftMobile: { width: '100%', marginBottom: 28 }, 
  splitRight: { flex: 1, borderLeftWidth: 1, borderColor: '#e2e8f0', paddingLeft: 24 },
  splitRightMobile: { width: '100%', borderLeftWidth: 0, paddingLeft: 0, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 20, marginTop: 35 },
  
  apptTypeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  apptTypeBtn: { backgroundColor: '#f1f5f9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  apptTypeBtnActive: { backgroundColor: '#e0e7ff', borderColor: '#4f46e5' },
  apptTypeText: { color: '#64748b', fontWeight: '600', fontSize: 12 },
  apptTypeTextActive: { color: '#4f46e5' },
  saveApptBtn: { backgroundColor: '#f59e0b', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 12, marginBottom: 8 },
  saveApptBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  deleteApptBtn: { padding: 4, backgroundColor: '#fee2e2', borderRadius: 6 },

  scheduledSection: { marginTop: 35, borderTopWidth: 1, borderColor: '#e2e8f0', paddingTop: 24 },
  scheduledCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: '#f59e0b', borderRadius: 8, padding: 12, marginBottom: 10, ...Platform.select({ web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.03)' } }) },
  scheduledCardDone: { opacity: 0.5, borderLeftColor: '#cbd5e1', backgroundColor: '#f8fafc' },
  scheduledCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  scheduledCardReminder: { fontSize: 10, fontWeight: '700', color: '#f59e0b', backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  scheduledCardDate: { fontSize: 12, color: '#475569', marginTop: 4, fontWeight: '500' },
  scheduledCardStatus: { fontSize: 10, color: '#10b981', marginTop: 8, fontWeight: 'bold' },

  uploadButton: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 8, padding: 16, alignItems: 'center' },
  uploadButtonText: { color: '#475569', fontWeight: '600', fontSize: 14 },
  viewDocButton: { backgroundColor: '#eff6ff', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#bfdbfe' },
  viewDocText: { color: '#2563eb', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  
  commentsSidebarDesktop: { width: 340, backgroundColor: '#f8fafc', borderLeftWidth: 1, borderLeftColor: '#e2e8f0', padding: 16, paddingBottom: 0 },
  commentsContainer: { flex: 1 },
  commentsContainerMobile: { paddingBottom: 20 },
  commentsTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  commentInputContainer: { backgroundColor: '#ffffff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
  commentInput: { height: 60, textAlignVertical: 'top', fontSize: 13, color: '#0f172a', marginBottom: 12, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  addCommentBtn: { alignSelf: 'flex-end', backgroundColor: '#10b981', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 6 },
  addCommentBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 12 },
  commentsList: { flex: 1 },
  noCommentsText: { color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginTop: 20, fontSize: 13 },
  commentCard: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  commentDate: { fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: '600' },
  commentCardManual: { backgroundColor: '#ffffff', borderColor: '#bfdbfe', borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  commentTextManual: { fontSize: 13, color: '#1e293b', lineHeight: 18, fontWeight: '500' },
  commentCardAuto: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  commentTextAuto: { fontSize: 13, color: '#64748b', lineHeight: 18, fontStyle: 'italic' },

  footer: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#ffffff', gap: 12 },
  footerMobile: { padding: 16 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#475569', fontWeight: '600', fontSize: 14 },
  saveButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, backgroundColor: '#2563eb' },
  saveButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },

  successAlertOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  successAlertBox: { backgroundColor: '#ffffff', padding: 24, borderRadius: 16, alignItems: 'center', width: 320, ...Platform.select({ web: { boxShadow: '0px 10px 25px rgba(0,0,0,0.2)' } }) },
  successAlertIcon: { fontSize: 48, marginBottom: 12 },
  successAlertTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  successAlertMessage: { fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  successAlertBtn: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 8, width: '100%', alignItems: 'center' },
  successAlertBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },

  // NOVOS ESTILOS PARA TRANSFERÊNCIA DE LEAD
  userListContainer: { maxHeight: 180, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, backgroundColor: '#f8fafc', marginBottom: 20 },
  userOption: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  userOptionSelected: { backgroundColor: '#e0e7ff' },
  userOptionText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  userOptionTextSelected: { color: '#4f46e5', fontWeight: 'bold' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, marginRight: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkmark: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  checkboxLabel: { fontSize: 13, color: '#475569', flex: 1, flexWrap: 'wrap' }
});