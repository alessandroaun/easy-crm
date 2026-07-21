import React from 'react';
import { 
  Modal, View, Text, TouchableOpacity, StyleSheet, Platform 
} from 'react-native';

export default function FilterModal({ visible, onClose, activeFilter, onSelectFilter }) {
  
  // Função auxiliar para aplicar o filtro e já fechar o modal
  const handleSelect = (filterType) => {
    onSelectFilter(filterType);
    onClose();
  };

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          <View style={styles.header}>
            <Text style={styles.title}>Filtrar Leads</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.optionsContainer}>
            <TouchableOpacity 
              style={[styles.filterOption, activeFilter === 'TODOS' && styles.activeOption]}
              onPress={() => handleSelect('TODOS')}
            >
              <Text style={[styles.optionText, activeFilter === 'TODOS' && styles.activeOptionText]}>🏷️ Todos os Leads</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.filterOption, activeFilter === 'QUENTE' && styles.activeOption]}
              onPress={() => handleSelect('QUENTE')}
            >
              <Text style={[styles.optionText, activeFilter === 'QUENTE' && styles.activeOptionText]}>🔥 Leads Quentes</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterOption, activeFilter === 'COM_LANCE' && styles.activeOption]}
              onPress={() => handleSelect('COM_LANCE')}
            >
              <Text style={[styles.optionText, activeFilter === 'COM_LANCE' && styles.activeOptionText]}>💰 Com Lance Ofertado</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterOption, activeFilter === 'ALTA_PROB' && styles.activeOption]}
              onPress={() => handleSelect('ALTA_PROB')}
            >
              <Text style={[styles.optionText, activeFilter === 'ALTA_PROB' && styles.activeOptionText]}>🎯 Alta Probabilidade</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center',
  },
  modalContainer: {
    width: '100%', maxWidth: 350, backgroundColor: '#ffffff', borderRadius: 16, padding: 24,
    ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 15px rgba(0,0,0,0.1)' } })
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  closeButton: { padding: 4 },
  closeButtonText: { fontSize: 18, color: '#64748b', fontWeight: 'bold' },
  optionsContainer: { gap: 10 },
  filterOption: {
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  activeOption: {
    backgroundColor: '#eff6ff', borderColor: '#3b82f6',
  },
  optionText: {
    fontSize: 15, color: '#475569', fontWeight: '600',
  },
  activeOptionText: {
    color: '#2563eb',
  },
});