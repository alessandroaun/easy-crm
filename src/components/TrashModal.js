import React from 'react';
import { 
  Modal, View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView 
} from 'react-native';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function TrashModal({ visible, onClose, trashClients, onPermanentDelete, onRestore, isDarkMode }) {
  const themeStyles = isDarkMode ? darkStyles : lightStyles;

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, themeStyles.modalContainer]}>
          
          <View style={[styles.header, themeStyles.header]}>
            <Text style={[styles.title, themeStyles.title]}>Lixeira de Clientes</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, themeStyles.closeButtonText]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContentContainer} showsVerticalScrollIndicator={true}>
            {trashClients && trashClients.length > 0 ? (
              trashClients.map(client => (
                <View key={client.id} style={[styles.trashCard, themeStyles.trashCard]}>
                  <View style={styles.clientInfo}>
                    <Text style={[styles.clientName, themeStyles.clientName]} numberOfLines={1}>{client.name}</Text>
                    <Text style={[styles.clientPhone, themeStyles.clientPhone]} numberOfLines={1}>{client.phone}</Text>
                  </View>
                  
                  {/* Container para agrupar os botões */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={styles.restoreButton} 
                      onPress={() => onRestore(client.id)}
                    >
                      <Text style={styles.restoreButtonText}>Restaurar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.deleteButton} 
                      onPress={() => onPermanentDelete(client.id)}
                    >
                      <Text style={styles.deleteButtonText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>

                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, themeStyles.emptyText]}>A lixeira está vazia.</Text>
              </View>
            )}
          </ScrollView>

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
    width: '100%', 
    maxWidth: 550, 
    height: 520, // Tamanho fixo garantido, impedindo redimensionamento dinâmico
    borderRadius: 16, 
    padding: 24,
    ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 25px rgba(0,0,0,0.15)' } })
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', fontFamily: MODERN_FONT },
  closeButton: { padding: 8 },
  closeButtonText: { fontSize: 20, fontWeight: 'bold' },
  
  listContainer: { flex: 1 },
  listContentContainer: { paddingBottom: 16 },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 250 },
  emptyText: { textAlign: 'center', fontFamily: MODERN_FONT, fontSize: 14 },
  
  trashCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderRadius: 8, marginBottom: 8,
    borderWidth: 1
  },
  clientInfo: {
    flex: 1, // Faz a área de texto ocupar o espaço disponível e não empurrar os botões
    paddingRight: 10,
  },
  clientName: { fontSize: 15, fontWeight: '600', fontFamily: MODERN_FONT },
  clientPhone: { fontSize: 13, fontFamily: MODERN_FONT },
  actionButtons: {
    flexDirection: 'row',
    gap: 8, // Espaçamento entre os dois botões (suportado na web nativamente)
  },
  restoreButton: { 
    backgroundColor: '#3b82f6', // Azul para restauração
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 6 
  },
  restoreButtonText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', fontFamily: MODERN_FONT },
  deleteButton: { 
    backgroundColor: '#ef4444', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 6 
  },
  deleteButtonText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', fontFamily: MODERN_FONT },
});

/* Estilos de Tema Claro */
const lightStyles = StyleSheet.create({
  modalContainer: { backgroundColor: '#ffffff' },
  header: { borderBottomColor: '#f1f5f9' },
  title: { color: '#1e293b' },
  closeButtonText: { color: '#64748b' },
  emptyText: { color: '#64748b' },
  trashCard: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  clientName: { color: '#0f172a' },
  clientPhone: { color: '#64748b' }
});

/* Estilos de Tema Escuro */
const darkStyles = StyleSheet.create({
  modalContainer: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 },
  header: { borderBottomColor: '#334155' },
  title: { color: '#f8fafc' },
  closeButtonText: { color: '#94a3b8' },
  emptyText: { color: '#94a3b8' },
  trashCard: { backgroundColor: '#0f172a', borderColor: '#334155' },
  clientName: { color: '#f8fafc' },
  clientPhone: { color: '#94a3b8' }
});