import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';

// Função auxiliar para padronizar o telefone
const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  // Adiciona o 55 caso não tenha vindo
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  // Tenta formatar como +55 (XX) XXXXX-XXXX
  const match = cleaned.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  if (match) {
    return `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}`;
  }
  return phone;
};

export default function ImportLeadsModal({ visible, onClose, onImport }) {
  const [rawText, setRawText] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleProcessText = () => {
    if (!rawText.trim()) {
      alert("Cole o texto dos leads antes de processar.");
      return;
    }
    setProcessing(true);

    try {
      const leadChunks = rawText.split(/(?=NOVO LEAD GERADO)/i).filter(chunk => chunk.trim().length > 10);
      const newClients = [];

      const extract = (text, regex) => {
        const match = text.match(regex);
        return match ? match[1].trim() : '';
      };

      leadChunks.forEach(chunk => {
        const name = extract(chunk, /NOME:\s*([^\n]+)/i);
        const rawPhone = extract(chunk, /TELEFONE:\s*([^\n]+)/i);
        const email = extract(chunk, /EMAIL:\s*([^\n]+)/i);
        
        // Tratamento da Plataforma (ig -> Instagram, fb -> Facebook)
        const rawPlatform = extract(chunk, /PLATAFORMA:\s*([^\n]+)/i).toLowerCase();
        let platform = rawPlatform;
        if (rawPlatform.includes('ig') || rawPlatform.includes('instagram')) platform = 'Instagram';
        else if (rawPlatform.includes('fb') || rawPlatform.includes('facebook')) platform = 'Facebook';

        const category = extract(chunk, /QUAL BEM\?\s*([^\n]+)/i);
        const desiredCredit = extract(chunk, /QUAL VALOR DO BEM.*?\?\s*([^\n]+)/i);
        const idealInstallment = extract(chunk, /MÉDIA DE PARCELA.*?\?\s*([^\n]+)/i);
        const urgency = extract(chunk, /EM QUAL MOMENTO.*?\?\s*([^\n]+)/i);
        
        // Mapeia o Lance corretamente para preencher no modal depois
        const bidAmount = extract(chunk, /(?:POSSUI VALOR PARA LANCE|OFERTAR LANCE)\?\s*([^\n]+)/i);

        if (name || rawPhone) {
          const initialInfo = `🎯 Meta: ${desiredCredit || 'N/A'}\n💰 Parcela: ${idealInstallment || 'N/A'}`;
          const historyRaw = `DADOS BRUTOS:\n${chunk.trim()}`;
          const formattedPhone = formatPhoneNumber(rawPhone);

          newClients.push({
            id: `client_imp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            createdAt: new Date().toISOString(), // Data e Hora da criação
            name: name || 'Lead Sem Nome',
            phone: formattedPhone,
            email: email || '',
            platform: platform, // Adicionado
            category: category,
            desiredCredit: desiredCredit,
            idealInstallment: idealInstallment,
            urgency: urgency,
            bidAmount: bidAmount, // Adicionado corretamente
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
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>📥 Importação em Massa (Tráfego)</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.instructions}>
            Copie as mensagens e cole na caixa abaixo. Nomes, telefones, plataforma e lances serão extraídos.
          </Text>
          <TextInput
            style={styles.textArea}
            multiline={true}
            placeholder="Ex: NOVO LEAD GERADO GT CONSÓRCIO..."
            placeholderTextColor="#94a3b8"
            value={rawText}
            onChangeText={setRawText}
          />
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={processing}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleProcessText} disabled={processing}>
              <Text style={styles.saveButtonText}>{processing ? 'Processando...' : 'Processar e Importar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '100%', maxWidth: 650, backgroundColor: '#ffffff', borderRadius: 16, padding: 24, ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 15px rgba(0,0,0,0.1)' } }) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  closeButton: { padding: 4 },
  closeButtonText: { fontSize: 20, color: '#64748b', fontWeight: 'bold' },
  instructions: { fontSize: 14, color: '#475569', marginBottom: 16 },
  textArea: { height: 300, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 16, fontSize: 14, color: '#0f172a', textAlignVertical: 'top', ...Platform.select({ web: { outlineStyle: 'none' } }) },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#475569', fontWeight: '600', fontSize: 15 },
  saveButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#10b981' },
  saveButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
});