import React from 'react';
import { 
  Modal, View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView 
} from 'react-native';

export default function TrashModal({ visible, onClose, trashClients, onPermanentDelete, onRestore }) {
  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          <View style={styles.header}>
            <Text style={styles.title}>Lixeira de Clientes</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.listContainer}>
            {trashClients && trashClients.length > 0 ? (
              trashClients.map(client => (
                <View key={client.id} style={styles.trashCard}>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{client.name}</Text>
                    <Text style={styles.clientPhone}>{client.phone}</Text>
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
              <Text style={styles.emptyText}>A lixeira está vazia.</Text>
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
    width: '100%', maxWidth: 550, maxHeight: '80%', backgroundColor: '#ffffff', borderRadius: 16, padding: 24,
    ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 15px rgba(0,0,0,0.1)' } })
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  closeButton: { padding: 8 },
  closeButtonText: { fontSize: 20, color: '#64748b', fontWeight: 'bold' },
  listContainer: { flexGrow: 0 },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 20 },
  trashCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 8,
    borderWidth: 1, borderColor: '#e2e8f0'
  },
  clientInfo: {
    flex: 1, // Faz a área de texto ocupar o espaço disponível e não empurrar os botões
    paddingRight: 10,
  },
  clientName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  clientPhone: { fontSize: 13, color: '#64748b' },
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
  restoreButtonText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  deleteButton: { 
    backgroundColor: '#ef4444', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 6 
  },
  deleteButtonText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
});