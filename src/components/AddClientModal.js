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

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function AddClientModal({ visible, onClose, onSave, isDarkMode }) {
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

  const themeStyles = isDarkMode ? darkStyles : lightStyles;

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
        <View style={[styles.modalContainer, themeStyles.modalContainer]}>
          
          <View style={styles.header}>
            <Text style={[styles.title, themeStyles.title]}>Novo Cliente</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, themeStyles.closeButtonText]}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, themeStyles.label]}>Nome do Cliente *</Text>
            <TextInput
              style={[styles.input, themeStyles.input]}
              placeholder="Ex: João da Silva"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, themeStyles.label]}>Número de Telefone/WhatsApp</Text>
            <TextInput
              style={[styles.input, themeStyles.input]}
              placeholder="Ex: (11) 99999-9999"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={[styles.label, themeStyles.label]}>Informações Iniciais</Text>
            <TextInput
              style={[styles.input, themeStyles.input, styles.textArea]}
              placeholder="Como esse cliente chegou? Qual o interesse?"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
              multiline={true}
              numberOfLines={4}
              value={initialInfo}
              onChangeText={setInitialInfo}
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.cancelButton, themeStyles.cancelButton]} onPress={handleClose}>
              <Text style={[styles.cancelButtonText, themeStyles.cancelButtonText]}>Cancelar</Text>
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
    fontFamily: MODERN_FONT,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    fontFamily: MODERN_FONT,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    fontFamily: MODERN_FONT,
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
  },
  cancelButtonText: {
    fontWeight: '600',
    fontSize: 15,
    fontFamily: MODERN_FONT,
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
    fontFamily: MODERN_FONT,
  },
});

/* Estilos de Tema Claro */
const lightStyles = StyleSheet.create({
  modalContainer: {
    backgroundColor: '#ffffff',
  },
  title: {
    color: '#1e293b',
  },
  closeButtonText: {
    color: '#64748b',
  },
  label: {
    color: '#475569',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#0f172a',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    color: '#475569',
  },
});

/* Estilos de Tema Escuro */
const darkStyles = StyleSheet.create({
  modalContainer: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
  },
  title: {
    color: '#f8fafc',
  },
  closeButtonText: {
    color: '#94a3b8',
  },
  label: {
    color: '#94a3b8',
  },
  input: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    color: '#f8fafc',
  },
  cancelButton: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderWidth: 1,
  },
  cancelButtonText: {
    color: '#cbd5e1',
  },
});