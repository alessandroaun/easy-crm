import React from 'react';
import { 
  Modal, View, Text, TouchableOpacity, StyleSheet, Platform 
} from 'react-native';

export default function FilterModal({ visible, onClose, activeFilter, onSelectFilter }) {
  
  const handleSelect = (filterType) => {
    onSelectFilter(filterType);
    onClose();
  };

  const FilterOption = ({ value, label }) => {
    const isActive = activeFilter === value;
    return (
      <TouchableOpacity 
        style={[styles.filterOption, isActive && styles.activeOption]}
        onPress={() => handleSelect(value)}
      >
        <Text style={[styles.optionText, isActive && styles.activeOptionText]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        
        <TouchableOpacity activeOpacity={1} style={styles.dropdownMenu}>
          <FilterOption value="TODOS" label="Todos os Leads" />
          <FilterOption value="AUTO" label="Auto" />
          <FilterOption value="IMOVEL" label="Imóvel" />
          <FilterOption value="INVESTIMENTO" label="Investimento" />
          <FilterOption value="INSTAGRAM" label="Instagram" />
          <FilterOption value="FACEBOOK" label="Facebook" />
          <FilterOption value="COM_WA" label="Possui WhatsApp" />
          <FilterOption value="SEM_WA" label="Sem WhatsApp" />
        </TouchableOpacity>

      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, 
    backgroundColor: 'transparent', 
    // Posiciona exatamente embaixo da barra superior onde fica o botão de filtro
    justifyContent: 'flex-start', 
    alignItems: 'flex-start',
    paddingTop: 56, 
    paddingLeft: 180, // Ajuste fino horizontal para alinhar diretamente abaixo do botão "Filtro"
  },
  dropdownMenu: {
    backgroundColor: '#ffffff', 
    borderRadius: 8, 
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 4,
    minWidth: 140, // Largura compacta ajustada ao texto
    ...Platform.select({ 
      web: { outlineStyle: 'none', boxShadow: '0px 10px 25px rgba(0,0,0,0.12)' },
      default: { elevation: 5 }
    })
  },
  filterOption: {
    paddingVertical: 7, 
    paddingHorizontal: 10, 
    borderRadius: 6, 
    backgroundColor: 'transparent',
  },
  activeOption: {
    backgroundColor: '#eff6ff', 
  },
  optionText: {
    fontSize: 13, 
    color: '#475569', 
    fontWeight: '600',
  },
  activeOptionText: {
    color: '#2563eb',
    fontWeight: '700'
  }
});