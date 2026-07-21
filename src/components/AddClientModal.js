import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet,
  Platform
} from 'react-native';

export default function AddClientModal({ visible, onClose, onSave }) {
  // Estados para os campos do formulário
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialInfo, setInitialInfo] = useState('');

  // Função para limpar e fechar
  const handleClose = () => {
    setName('');
    setPhone('');
    setInitialInfo('');
    onClose();
  };

  // Função para salvar
  const handleSave = () => {
    if (!name.trim()) {
      alert('O nome do cliente é obrigatório!');
      return;
    }

    const newClient = {
      id: `client_${Date.now()}`, // ID temporário baseado no timestamp
      name,
      phone,
      initialInfo,
    };

    onSave(newClient);
    handleClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      {/* Fundo escuro translúcido */}
      <View style={styles.overlay}>
        
        {/* Container principal do Modal */}
        <View style={styles.modalContainer}>
          
          <View style={styles.header}>
            <Text style={styles.title}>Novo Cliente</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Nome do Cliente *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: João da Silva"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Número de Telefone/WhatsApp</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: (11) 99999-9999"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={styles.label}>Informações Iniciais</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Como esse cliente chegou? Qual o interesse?"
              placeholderTextColor="#94a3b8"
              multiline={true}
              numberOfLines={4}
              value={initialInfo}
              onChangeText={setInitialInfo}
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Salvar Cliente</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', // Azul escuro translúcido moderno
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500, // Limita o tamanho na web
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
    ...Platform.select({
      web: { outlineStyle: 'none' }
    })
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: 'bold',
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#0f172a',
    ...Platform.select({
      web: { outlineStyle: 'none', transition: 'border-color 0.2s' }
    })
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top', // Necessário para alinhar texto ao topo no multiline
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12, // Gap funciona bem na web e nas versões mais recentes do RN
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 15,
  },
  saveButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});