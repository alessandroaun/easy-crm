import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  KeyboardAvoidingView, 
  ScrollView 
} from 'react-native';

// Função auxiliar para padronizar o telefone
const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  const match = cleaned.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  if (match) {
    return `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}`;
  }
  return phone;
};

export default function ImportLeadsModal({ visible, onClose, onImport }) {
  const [rawText, setRawText] = useState('');
  const [processing, setProcessing] = useState(false);
  // Novo estado para o Checkbox
  const [removeFormatting, setRemoveFormatting] = useState(true);

  const handleProcessText = () => {
    if (!rawText.trim()) {
      alert("Cole o texto dos leads antes de processar.");
      return;
    }
    setProcessing(true);

    try {
      // Limpeza de caracteres especiais caso o checkbox esteja marcado
      let textToProcess = rawText;
      if (removeFormatting) {
        textToProcess = textToProcess.replace(/[*_]/g, '');
      }

      const leadChunks = textToProcess.split(/(?=NOVO LEAD GERADO)/i).filter(chunk => chunk.trim().length > 10);
      const newClients = [];

      const extract = (text, regex) => {
        const match = text.match(regex);
        return match ? match[1].trim() : '';
      };

      leadChunks.forEach(chunk => {
        const name = extract(chunk, /NOME:\s*([^\n]+)/i);
        const rawPhone = extract(chunk, /TELEFONE:\s*([^\n]+)/i);
        const email = extract(chunk, /EMAIL:\s*([^\n]+)/i);
        
        const rawPlatform = extract(chunk, /PLATAFORMA:\s*([^\n]+)/i).toLowerCase();
        let platform = rawPlatform;
        if (rawPlatform.includes('ig') || rawPlatform.includes('instagram')) platform = 'Instagram';
        else if (rawPlatform.includes('fb') || rawPlatform.includes('facebook')) platform = 'Facebook';

        const category = extract(chunk, /QUAL BEM\?\s*([^\n]+)/i);
        const desiredCredit = extract(chunk, /QUAL VALOR DO BEM.*?\?\s*([^\n]+)/i);
        const idealInstallment = extract(chunk, /MÉDIA DE PARCELA.*?\?\s*([^\n]+)/i);
        const urgency = extract(chunk, /EM QUAL MOMENTO.*?\?\s*([^\n]+)/i);
        const bidAmount = extract(chunk, /(?:POSSUI VALOR PARA LANCE|OFERTAR LANCE)\?\s*([^\n]+)/i);

        if (name || rawPhone) {
          const initialInfo = `🎯 Meta: ${desiredCredit || 'N/A'}\n💰 Parcela: ${idealInstallment || 'N/A'}`;
          const historyRaw = `DADOS BRUTOS:\n${chunk.trim()}`;
          const formattedPhone = formatPhoneNumber(rawPhone);

          newClients.push({
            id: `client_imp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            createdAt: new Date().toISOString(),
            name: name || 'Lead Sem Nome',
            phone: formattedPhone,
            email: email || '',
            platform: platform,
            category: category,
            desiredCredit: desiredCredit,
            idealInstallment: idealInstallment,
            urgency: urgency,
            bidAmount: bidAmount,
            leadTemp: 'Morno',
            initialInfo: initialInfo,
            history: historyRaw
          });
        }
      });

      if (newClients.length === 0) {
        alert("Não foi possível identificar nenhum lead no formato esperado.");
        setProcessing(false);
        return;
      }

      onImport(newClients);
      alert(`${newClients.length} Lead(s) importado(s) com sucesso!`);
      setRawText('');
      onClose();

    } catch (error) {
      console.error("Erro ao importar:", error);
      alert("Ocorreu um erro ao processar o texto.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={styles.overlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContainer}>
          
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>📥 Importação de Leads</Text>
              <Text style={styles.subtitle}>Cole os dados gerados pelas campanhas de tráfego</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Checkbox de Limpeza */}
            <TouchableOpacity 
              style={styles.checkboxContainer} 
              activeOpacity={0.7}
              onPress={() => setRemoveFormatting(!removeFormatting)}
            >
              <View style={[styles.checkbox, removeFormatting && styles.checkboxChecked]}>
                {removeFormatting && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                Limpar formatação do WhatsApp <Text style={{ color: '#94a3b8' }}>(remover * e _)</Text>
              </Text>
            </TouchableOpacity>

            <TextInput
              style={styles.textArea}
              multiline={true}
              placeholder="Cole os dados aqui...&#10;&#10;Ex:&#10;NOVO LEAD GERADO GT CONSÓRCIO&#10;NOME: João Silva&#10;TELEFONE: 85999999999"
              placeholderTextColor="#94a3b8"
              value={rawText}
              onChangeText={setRawText}
            />

          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={processing}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleProcessText} disabled={processing}>
              <Text style={styles.saveButtonText}>{processing ? 'Processando...' : 'Processar e Importar'}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.65)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 16
  },
  modalContainer: { 
    width: '100%', 
    maxWidth: 600, 
    backgroundColor: '#ffffff', 
    borderRadius: 20, 
    maxHeight: '90%',
    overflow: 'hidden',
    ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 20px 40px rgba(0,0,0,0.15)' } }) 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff'
  },
  title: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#0f172a' 
  },
  subtitle: { 
    fontSize: 13, 
    color: '#64748b', 
    marginTop: 4 
  },
  closeButton: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#f1f5f9', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  closeButtonText: { 
    fontSize: 16, 
    color: '#475569', 
    fontWeight: 'bold' 
  },
  scrollContent: {
    padding: 24,
  },
  
  // Estilos do Checkbox Customizado
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#ffffff'
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
    flex: 1
  },

  textArea: { 
    height: 320, 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderRadius: 12, 
    padding: 16, 
    fontSize: 14, 
    color: '#0f172a', 
    textAlignVertical: 'top',
    lineHeight: 22,
    ...Platform.select({ web: { outlineStyle: 'none' } }) 
  },
  footer: { 
    flexDirection: 'row', 
    padding: 20,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    justifyContent: 'space-between',
    gap: 12
  },
  cancelButton: { 
    flex: 1,
    paddingVertical: 14, 
    alignItems: 'center',
    borderRadius: 10, 
    backgroundColor: '#e2e8f0' 
  },
  cancelButtonText: { 
    color: '#475569', 
    fontWeight: '700', 
    fontSize: 15 
  },
  saveButton: { 
    flex: 1,
    paddingVertical: 14, 
    alignItems: 'center',
    borderRadius: 10, 
    backgroundColor: '#2563eb',
    ...Platform.select({ web: { boxShadow: '0px 4px 6px rgba(37, 99, 235, 0.2)' } })
  },
  saveButtonText: { 
    color: '#ffffff', 
    fontWeight: '700', 
    fontSize: 15 
  },
});