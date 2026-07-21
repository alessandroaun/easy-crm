import React, { useState, useEffect } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../services/supabaseClient'; // Ajuste o caminho se necessário
import { ActivityIndicator, Linking } from 'react-native'; // Atualize as importações do react-native
import { 
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView 
} from 'react-native';

// Subcomponente para as seções expansíveis (Accordion)
const AccordionSection = ({ title, children, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.sectionContainer}>
      <TouchableOpacity 
        style={styles.sectionHeader} 
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionToggle}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
};

export default function ClientDetailsModal({ visible, onClose, clientData, onSave }) {
  const [formData, setFormData] = useState({});

  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Função genérica para upload (recebe o nome do campo JSON onde o link será salvo)
  const handleUpload = async (fieldKey) => {
    try {
      // 1. Abre a janela para o usuário escolher o arquivo (PDF ou Imagem)
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      
      setUploadingDoc(true);
      const asset = result.assets[0];

      // 2. Converte o arquivo para o formato Blob (necessário para o Supabase no React Native Web)
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      // 3. Monta um nome único para o arquivo usando o ID do cliente
      const fileExt = asset.name.split('.').pop();
      const fileName = `${clientData.id}_${fieldKey}_${Date.now()}.${fileExt}`;
      const filePath = `${clientData.id}/${fileName}`; // Cria uma pasta com o ID do cliente

      // 4. Faz o upload para o bucket 'crm_documents'
      const { error } = await supabase.storage
        .from('crm_documents')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      // 5. Recupera a URL pública do arquivo
      const { data: publicUrlData } = supabase.storage
        .from('crm_documents')
        .getPublicUrl(filePath);

      // 6. Atualiza o estado do formulário com a URL
      handleChange(fieldKey, publicUrlData.publicUrl);
      alert('Upload concluído com sucesso!');

    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Erro ao fazer o upload do documento.");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Atualiza o formulário sempre que um novo cliente for selecionado
  useEffect(() => {
    if (clientData) {
      setFormData(clientData);
    }
  }, [clientData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  if (!clientData) return null;

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          <View style={styles.header}>
            <Text style={styles.title}>Detalhes do Lead</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          {/* Exibe a Data de Criação no topo do Modal */}
          {formData.createdAt && (
            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              📅 Lead cadastrado em: {new Date(formData.createdAt).toLocaleDateString('pt-BR')} às {new Date(formData.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            
            {/* 1. Dados Pessoais */}
            <AccordionSection title="1. Dados Pessoais" defaultExpanded={true}>
              <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nome Completo *</Text>
                  <TextInput style={styles.input} value={formData.name || ''} onChangeText={t => handleChange('name', t)} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>CPF</Text>
                  <TextInput style={styles.input} value={formData.cpf || ''} onChangeText={t => handleChange('cpf', t)} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Telefone / WhatsApp *</Text>
                  <TextInput style={styles.input} value={formData.phone || ''} onChangeText={t => handleChange('phone', t)} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput style={styles.input} value={formData.email || ''} onChangeText={t => handleChange('email', t)} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Profissão</Text>
                  <TextInput style={styles.input} value={formData.profession || ''} onChangeText={t => handleChange('profession', t)} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Renda Mensal</Text>
                  <TextInput style={styles.input} value={formData.monthlyIncome || ''} onChangeText={t => handleChange('monthlyIncome', t)} />
                </View>
              </View>
            </AccordionSection>

            {/* 4. Interesse do Cliente & Extras de Consórcio */}
            <AccordionSection title="4. Interesse no Consórcio">
              <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Categoria (Auto, Imóvel, etc)</Text>
                  <TextInput style={styles.input} value={formData.category || ''} onChangeText={t => handleChange('category', t)} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Valor Desejado (Crédito)</Text>
                  <TextInput style={styles.input} value={formData.desiredCredit || ''} onChangeText={t => handleChange('desiredCredit', t)} />
                </View>
              </View>
              <View style={styles.inputGroup}>
                  <Text style={styles.label}>Origem do Lead</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Ex: Tráfego Pago, Indicação, Instagram"
                    value={formData.origin || ''} 
                    onChangeText={t => handleChange('origin', t)} 
                  />
                </View>
              <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Parcela Ideal</Text>
                  <TextInput style={styles.input} value={formData.idealInstallment || ''} onChangeText={t => handleChange('idealInstallment', t)} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Urgência de Contemplação</Text>
                  <TextInput style={styles.input} placeholder="Ex: Imediata, 6 meses..." value={formData.urgency || ''} onChangeText={t => handleChange('urgency', t)} />
                </View>
              </View>
            </AccordionSection>

            {/* 5. Perfil Financeiro e Lances */}
            <AccordionSection title="5. Perfil Financeiro e Lance">
              <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Valor Disponível p/ Lance</Text>
                  <TextInput style={styles.input} value={formData.bidAmount || ''} onChangeText={t => handleChange('bidAmount', t)} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Tipo de Lance Preferido</Text>
                  <TextInput style={styles.input} placeholder="Livre, Embutido, FGTS..." value={formData.bidType || ''} onChangeText={t => handleChange('bidType', t)} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Possui Financiamento Ativo?</Text>
                  <TextInput style={styles.input} value={formData.hasFinancing || ''} onChangeText={t => handleChange('hasFinancing', t)} />
                </View>
              </View>
            </AccordionSection>

            {/* 12. Histórico */}
            <AccordionSection title="12. Histórico e Observações">
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Informações Iniciais / Histórico</Text>
                <TextInput 
                  style={[styles.input, styles.textArea]} 
                  multiline={true} 
                  numberOfLines={6}
                  value={formData.initialInfo || ''} 
                  onChangeText={t => handleChange('initialInfo', t)} 
                />
              </View>
            </AccordionSection>

            {/* Campos Inteligentes */}
            <AccordionSection title="Campos Inteligentes (KPIs)">
               <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Temperatura do Lead</Text>
                  <TextInput style={styles.input} placeholder="Frio, Morno, Quente" value={formData.leadTemp || ''} onChangeText={t => handleChange('leadTemp', t)} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Probabilidade de Fechamento (%)</Text>
                  <TextInput style={styles.input} value={formData.winProbability || ''} onChangeText={t => handleChange('winProbability', t)} />
                </View>
              </View>
            </AccordionSection>

            {/* Seção de Documentos */}
            <AccordionSection title="Documentos Anexos (Upload)">
              <View style={styles.row}>
                
                {/* Documento Pessoal */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Documento Pessoal (RG/CNH)</Text>
                  
                  {formData.docPessoalUrl ? (
                    <TouchableOpacity 
                      style={styles.viewDocButton} 
                      onPress={() => Linking.openURL(formData.docPessoalUrl)}
                    >
                      <Text style={styles.viewDocText}>📄 Visualizar Documento Pessoal</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity 
                    style={styles.uploadButton} 
                    onPress={() => handleUpload('docPessoalUrl')} 
                    disabled={uploadingDoc}
                  >
                    {uploadingDoc ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <Text style={styles.uploadButtonText}>
                        {formData.docPessoalUrl ? 'Substituir Arquivo' : '📤 Fazer Upload'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Comprovante de Residência */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Comprovante de Residência</Text>
                  
                  {formData.docResidenciaUrl ? (
                    <TouchableOpacity 
                      style={styles.viewDocButton} 
                      onPress={() => Linking.openURL(formData.docResidenciaUrl)}
                    >
                      <Text style={styles.viewDocText}>📄 Visualizar Comprovante</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity 
                    style={styles.uploadButton} 
                    onPress={() => handleUpload('docResidenciaUrl')} 
                    disabled={uploadingDoc}
                  >
                    {uploadingDoc ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <Text style={styles.uploadButtonText}>
                        {formData.docResidenciaUrl ? 'Substituir Arquivo' : '📤 Fazer Upload'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

              </View>
            </AccordionSection>

          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Salvar Alterações</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center',
  },
  modalContainer: {
    width: '100%', maxWidth: 800, height: '90%', backgroundColor: '#ffffff', borderRadius: 16, padding: 24,
    ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 25px rgba(0,0,0,0.15)' } })
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  closeButton: { padding: 8 },
  closeButtonText: { fontSize: 20, color: '#64748b', fontWeight: 'bold' },
  scrollArea: { flex: 1, marginBottom: 20 },
  
  // Estilos do Accordion
  sectionContainer: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f1f5f9',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#334155' },
  sectionToggle: { fontSize: 16, color: '#64748b' },
  sectionContent: { padding: 16, backgroundColor: '#ffffff' },
  
  // Estilos do Formulário
  row: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  inputGroup: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 14, color: '#0f172a',
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  
  // Footer
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#475569', fontWeight: '600', fontSize: 15 },
  saveButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#2563eb' },
  saveButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },

  uploadButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  uploadButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  viewDocButton: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  viewDocText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 13,
  },
});
