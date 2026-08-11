import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, useWindowDimensions } from 'react-native';

export default function NotificationModal({ visible, onClose, notifications, onDismiss, onDismissSystem }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 850;
  
  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={[styles.overlay, isMobile ? styles.overlayMobile : styles.overlayDesktop]}>
        <View style={[styles.modalContainer, isMobile ? styles.modalContainerMobile : styles.modalContainerDesktop]}>
          
          <View style={styles.header}>
            <Text style={styles.title}>🔔 Central de Notificações</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.listArea} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Sem notificações no momento. 🎉</Text>
              </View>
            ) : (
              notifications.map((item) => {
                if (item.type === 'Sistema') {
                  return (
                    <View key={item.id} style={[styles.notificationCard, { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }]}>
                      <Text style={{ fontWeight: 'bold', color: '#166534', marginBottom: 5 }}>{item.text}</Text>
                      <Text style={{ fontSize: 11, color: '#15803d', marginBottom: 10 }}>{formatTime(item.date)}</Text>
                      <TouchableOpacity 
                        style={[styles.dismissButton, { backgroundColor: '#16a34a' }]} 
                        onPress={onDismissSystem}
                      >
                        <Text style={styles.dismissButtonText}>Entendido</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                const { client, appt, phaseId } = item;
                return (
                  <View key={appt.id} style={styles.notificationCard}>
                    <View style={styles.notifHeader}>
                      <Text style={styles.notifType}>🗓️ Ação: {appt.type}</Text>
                      <Text style={styles.notifTime}>{formatTime(appt.dateTime)}</Text>
                    </View>
                    <Text style={styles.notifClient}>👤 Cliente: <Text style={{fontWeight: 'bold'}}>{client.name}</Text></Text>
                    <TouchableOpacity 
                      style={styles.dismissButton} 
                      onPress={() => onDismiss(client.id, phaseId, appt.id)}
                    >
                      <Text style={styles.dismissButtonText}>✓ Marcar como Concluído</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)' },
  overlayDesktop: { justifyContent: 'flex-start', alignItems: 'flex-end' },
  overlayMobile: { justifyContent: 'center', alignItems: 'center', padding: 16 },

  modalContainer: {
    width: '100%', 
    maxWidth: 400, 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    padding: 24,
    maxHeight: '80%',
    ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 25px rgba(0,0,0,0.15)' } })
  },
  modalContainerDesktop: {
    marginTop: 80, 
    marginRight: 24,
  },
  modalContainerMobile: {
    marginTop: 0,
    marginRight: 0,
  },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  closeButton: { padding: 4 },
  closeButtonText: { fontSize: 18, color: '#64748b', fontWeight: 'bold' },
  listArea: { flex: 1 },
  emptyState: { padding: 20, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8 },
  emptyText: { color: '#64748b', textAlign: 'center', fontSize: 14, lineHeight: 20 },
  
  notificationCard: { backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fef08a', borderRadius: 8, padding: 16, marginBottom: 12 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  notifType: { fontWeight: '700', color: '#ca8a04', fontSize: 13 },
  notifTime: { color: '#a16207', fontSize: 11, fontWeight: '600' },
  notifClient: { color: '#3f6212', fontSize: 14, marginBottom: 12 },
  dismissButton: { backgroundColor: '#eab308', paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  dismissButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 12 }
});