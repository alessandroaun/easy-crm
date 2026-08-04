import React, { useState, useEffect } from 'react';
import { 
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView, ActivityIndicator, Linking, useWindowDimensions 
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../services/supabaseClient';

export default function ClientDetailsModal({ visible, onClose, clientData, onSave }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 850;

  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState({}); 
  const [activeTab, setActiveTab] = useState('informacoes');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  useEffect(() => {
    if (clientData) {
      let mergedInfo = clientData.initialInfo || '';
      if (clientData.history) {
        mergedInfo = mergedInfo 
          ? `${mergedInfo}\n\n=== DADOS DA IMPORTAÇÃO ===\n${clientData.history}` 
          : clientData.history;
      }

      const dataToSet = { ...clientData, initialInfo: mergedInfo };
      delete dataToSet.history; 

      setFormData(dataToSet);
      setOriginalData(JSON.parse(JSON.stringify(dataToSet))); 
      setActiveTab('informacoes');
      setNewCommentText('');
    }
  }, [clientData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    let updatedData = { ...formData };
    
    if (updatedData.phone && updatedData.phone !== originalData.phone) {
      let cl = updatedData.phone.replace(/\D/g, '');
      if (!cl.startsWith('55') && cl.length <= 11) cl = '55' + cl;
      const match = cl.match(/^(\d{2})(\d{2})(\d+)$/);
      if (match) {
        // Formato: +55 (XX) XXXXX-XXXX
        const numero = match[3];
        const numeroFormatado = numero.length > 4 ? `${numero.slice(0, -4)}-${numero.slice(-4)}` : numero;
        updatedData.phone = `+${match[1]} (${match[2]}) ${numeroFormatado}`;
      }
    }

    const fieldsToTrack = {
      name: 'Nome', phone: 'Telefone', email: 'E-mail', profession: 'Profissão',
      monthlyIncome: 'Renda', category: 'Categoria', desiredCredit: 'Crédito Desejado',
      idealInstallment: 'Parcela', urgency: 'Urgência', platform: 'Origem',
      bidAmount: 'Lance', hasFinancing: 'Financiamento', leadTemp: 'Temperatura', winProbability: 'Probabilidade'
    };

    let changes = [];
    for (let key in fieldsToTrack) {
      if ((updatedData[key] || '') !== (originalData[key] || '')) {
        const oldVal = originalData[key] ? originalData[key] : 'vazio';
        const newVal = updatedData[key] ? updatedData[key] : 'vazio';
        changes.push(`- ${fieldsToTrack[key]}: de "${oldVal}" para "${newVal}"`);
      }
    }

    if (changes.length > 0) {
      const summaryText = `⚙️ Sistema: Perfil atualizado\n${changes.join('\n')}`;
      const autoComment = {
        id: `sys_${Date.now()}`,
        text: summaryText,
        date: new Date().toISOString()
      };
      updatedData.comments = [autoComment, ...(updatedData.comments || [])];
    }

    onSave(updatedData);
    onClose();
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    
    const comment = {
      id: Date.now().toString(),
      text: newCommentText,
      date: new Date().toISOString(),
    };

    setFormData(prev => ({
      ...prev,
      comments: [comment, ...(prev.comments || [])]
    }));
    setNewCommentText('');
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
      alert('Upload concluído com sucesso!');
    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Erro ao fazer o upload do documento.");
    } finally {
      setUploadingDoc(false);
    }
  };

  if (!clientData) return null;

  const TabButton = ({ id, label }) => (
    <TouchableOpacity 
      style={[
        styles.tabButton, 
        isMobile && styles.tabButtonMobile, 
        activeTab === id && styles.tabButtonActive,
        isMobile && activeTab === id && styles.tabButtonMobileActive
      ]} 
      onPress={() => setActiveTab(id)}
    >
      <Text style={[
        styles.tabText, 
        isMobile && styles.tabTextMobile,
        activeTab === id && styles.tabTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const CommentsSection = () => (
    <View style={[styles.commentsContainer, isMobile && styles.commentsContainerMobile]}>
      <Text style={styles.commentsTitle}>Atividades e Comentários</Text>
      
      <View style={styles.commentInputContainer}>
        <TextInput 
          style={styles.commentInput} 
          placeholder="Registre uma ação ou contato..."
          multiline={true}
          value={newCommentText}
          onChangeText={setNewCommentText}
        />
        <TouchableOpacity style={styles.addCommentBtn} onPress={handleAddComment}>
          <Text style={styles.addCommentBtnText}>Salvar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.commentsList} showsVerticalScrollIndicator={false}>
        {(!formData.comments || formData.comments.length === 0) ? (
          <Text style={styles.noCommentsText}>Nenhuma interação registrada.</Text>
        ) : (
          formData.comments.map(comment => {
            // Verifica se é comentário gerado pelo sistema
            const isSystem = comment.text.includes('Sistema:');
            
            return (
              <View key={comment.id} style={[styles.commentCard, isSystem ? styles.commentCardAuto : styles.commentCardManual]}>
                <Text style={styles.commentDate}>
                  {new Date(comment.date).toLocaleDateString('pt-BR')} às {new Date(comment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={[styles.commentText, isSystem ? styles.commentTextAuto : styles.commentTextManual]}>
                  {comment.text}
                </Text>
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
        <View style={[styles.modalWrapper, isMobile && styles.modalWrapperMobile]}>
          
          <View style={[styles.header, isMobile && styles.headerMobile]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1}>
                {formData.name || 'Detalhes do Lead'}
              </Text>
              {formData.createdAt && (
                <Text style={styles.subtitle}>
                  Cadastrado em: {new Date(formData.createdAt).toLocaleDateString('pt-BR')} às {new Date(formData.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.body, isMobile && styles.bodyMobile]}>
            
            {isMobile ? (
              <View style={styles.sidebarMobileContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sidebarMobile}>
                  <TabButton id="informacoes" label="Informações" />
                  <TabButton id="comentarios" label="Comentários" />
                  <TabButton id="dados" label="Dados Pessoais" />
                  <TabButton id="consorcio" label="Interesse" />
                  <TabButton id="financeiro" label="Financeiro" />
                  <TabButton id="docs" label="Documentos" />
                  <TabButton id="kpis" label="Inteligência" />
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
                      {/* MAXLENGTH APLICADO AO TELEFONE */}
                      <TextInput 
                        style={styles.input} 
                        value={formData.phone || ''} 
                        onChangeText={t => handleChange('phone', t)}
                        maxLength={19}
                        keyboardType="phone-pad" 
                      />
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

              {isMobile && activeTab === 'comentarios' && (
                <CommentsSection />
              )}
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
              <Text style={styles.saveButtonText}>Salvar Alterações</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalWrapper: {
    width: '100%', maxWidth: 1150, height: '90%', backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden',
    ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 25px rgba(0,0,0,0.15)' } })
  },
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
  tabButtonMobile: { marginRight: 8, marginBottom: 0, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#e2e8f0' },
  tabButtonMobileActive: { backgroundColor: '#2563eb' },
  tabTextMobile: { fontSize: 13, color: '#475569' },
  contentArea: { flex: 1, padding: 24, backgroundColor: '#ffffff' },
  contentAreaMobile: { padding: 16 },
  formSection: { paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
  row: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  rowMobile: { flexDirection: 'column', gap: 0, marginBottom: 0 }, 
  inputGroup: { flex: 1, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 14, color: '#0f172a',
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
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
  
  // Estilos da Lista de Comentários (Base)
  commentCard: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  commentDate: { fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: '600' },
  
  // Variação: Comentário Manual (Destaque principal)
  commentCardManual: { backgroundColor: '#ffffff', borderColor: '#bfdbfe', borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  commentTextManual: { fontSize: 13, color: '#1e293b', lineHeight: 18, fontWeight: '500' },
  
  // Variação: Comentário Automático do Sistema (Discreto)
  commentCardAuto: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  commentTextAuto: { fontSize: 13, color: '#64748b', lineHeight: 18, fontStyle: 'italic' },

  footer: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#ffffff', gap: 12 },
  footerMobile: { padding: 16 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#475569', fontWeight: '600', fontSize: 14 },
  saveButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, backgroundColor: '#2563eb' },
  saveButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
});