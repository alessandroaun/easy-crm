import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, useWindowDimensions } from 'react-native';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function NotificationModal({ 
  visible, onClose, notifications, historyNotifications = [], onDismiss, onDismissSystem, 
  onApproveReset, onRejectReset, onApproveNameChange, onRejectNameChange,
  onDismissNameChangeAlert, onClearHistory
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 850;
  
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const totalItems = notifications.length + historyNotifications.length;

  // Traduz o 'type' da notificação em um texto descritivo para o Histórico
  const getHistoryText = (hist) => {
    if (hist.text || hist.title) return hist.text || hist.title;
    
    switch (hist.type) {
      case 'NameChangeApproved': return 'Alteração de Nome Autorizada pelo Administrador.';
      case 'NameChangeAlert': return 'Alerta: Identidade de consultor atualizada.';
      case 'NameChangeRequest': return 'Solicitação de Alteração de Nome processada.';
      case 'ResetRequest': return 'Solicitação de Nova Senha processada.';
      default: 
        if (hist.appt) return `Agendamento Concluído: ${hist.appt.type}`;
        return 'Notificação de Sistema';
    }
  };

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={[styles.overlay, isMobile ? styles.overlayMobile : styles.overlayDesktop]}>
        <View style={[styles.modalContainer, isMobile ? styles.modalContainerMobile : styles.modalContainerDesktop]}>
          
          <View style={styles.header}>
            <Text style={styles.title}>Central de Notificações</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {historyNotifications.length > 0 && (
                <TouchableOpacity onPress={onClearHistory} style={styles.clearHistoryButton}>
                  <Text style={styles.clearHistoryButtonText}>Limpar Histórico</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.listArea} showsVerticalScrollIndicator={false}>
            {totalItems === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Sem notificações ou histórico no momento.</Text>
              </View>
            ) : (
              <>
                {/* 1. NOTIFICAÇÕES ATIVAS / PENDENTES */}
                {notifications.map((item) => {
                  
                  if (item.type === 'NameChangeRequest') {
                    return (
                      <View key={item.id} style={[styles.notificationCard, { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }]}>
                        <Text style={{ fontFamily: MODERN_FONT, fontWeight: '800', color: '#1e293b', marginBottom: 5 }}>Solicitação de Alteração de Nome</Text>
                        <Text style={{ fontFamily: MODERN_FONT, fontSize: 13, color: '#475569', marginBottom: 3 }}>
                          Usuário: <Text style={{fontWeight: 'bold'}}>{item.currentName || 'N/A'}</Text>
                        </Text>
                        <Text style={{ fontFamily: MODERN_FONT, fontSize: 13, color: '#475569', marginBottom: 12 }}>
                          E-mail: {item.userEmail}
                        </Text>
                        <Text style={{ fontFamily: MODERN_FONT, fontSize: 11, color: '#64748b', marginBottom: 12 }}>O consultor solicitou permissão para editar o nome de exibição no CRM.</Text>
                        
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity 
                            style={[styles.dismissButton, { flex: 1, backgroundColor: '#2563eb' }]} 
                            onPress={() => onApproveNameChange(item.userId, item.id)}
                          >
                            <Text style={styles.dismissButtonText}>Autorizar Alteração</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.dismissButton, { flex: 1, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' }]} 
                            onPress={() => onRejectNameChange(item.userId, item.id)}
                          >
                            <Text style={[styles.dismissButtonText, { color: '#475569' }]}>Recusar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }

                  if (item.type === 'NameChangeAlert') {
                    return (
                      <View key={item.id} style={[styles.notificationCard, { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }]}>
                        <Text style={{ fontFamily: MODERN_FONT, fontWeight: '800', color: '#166534', marginBottom: 5 }}>Identidade Atualizada</Text>
                        <Text style={{ fontFamily: MODERN_FONT, fontSize: 13, color: '#15803d', marginBottom: 8, lineHeight: 18 }}>
                          O usuário <Text style={{fontWeight: 'bold'}}>{item.userEmail}</Text> concluiu a alteração de identidade.{'\n'}
                          De: <Text style={{fontWeight: 'bold', color: '#dc2626'}}>{item.oldName}</Text>{'\n'}
                          Para: <Text style={{fontWeight: 'bold', color: '#16a34a'}}>{item.newName}</Text>
                        </Text>
                        <TouchableOpacity 
                          style={[styles.dismissButton, { backgroundColor: '#16a34a' }]} 
                          onPress={() => {
                            if (onDismissNameChangeAlert) {
                              onDismissNameChangeAlert(item.userId, item.id);
                            } else {
                              onDismissSystem(item.id);
                            }
                          }}
                        >
                          <Text style={styles.dismissButtonText}>Ocultar Aviso</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  if (item.type === 'NameChangeApproved') {
                    return (
                      <View key={item.id} style={[styles.notificationCard, { borderColor: '#86efac', backgroundColor: '#dcfce7' }]}>
                        <Text style={{ fontFamily: MODERN_FONT, fontWeight: '800', color: '#166534', marginBottom: 5 }}>Alteração de Nome Autorizada!</Text>
                        <Text style={{ fontFamily: MODERN_FONT, fontSize: 13, color: '#15803d', marginBottom: 12, lineHeight: 18 }}>
                          O administrador concedeu permissão para você editar o seu nome de exibição.
                        </Text>
                        <Text style={{ fontFamily: MODERN_FONT, fontSize: 11, color: '#166534', marginBottom: 12 }}>
                          Acesse as Configurações do Sistema para atualizar seus dados.
                        </Text>
                        <TouchableOpacity style={[styles.dismissButton, { backgroundColor: '#16a34a' }]} onPress={() => onDismissSystem(item.id)}>
                          <Text style={styles.dismissButtonText}>Ocultar Aviso</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  if (item.type === 'ResetRequest') {
                    return (
                      <View key={item.id} style={[styles.notificationCard, { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]}>
                        <Text style={{ fontFamily: MODERN_FONT, fontWeight: '800', color: '#991b1b', marginBottom: 5 }}>Solicitação de Nova Senha</Text>
                        {item.name && (
                          <Text style={{ fontFamily: MODERN_FONT, fontSize: 13, color: '#7f1d1d', marginBottom: 3 }}>Nome: <Text style={{fontWeight: 'bold'}}>{item.name}</Text></Text>
                        )}
                        <Text style={{ fontFamily: MODERN_FONT, fontSize: 13, color: '#7f1d1d', marginBottom: 5 }}>E-mail: <Text style={{fontWeight: 'bold'}}>{item.email}</Text></Text>
                        <Text style={{ fontFamily: MODERN_FONT, fontSize: 11, color: '#b91c1c', marginBottom: 12 }}>Autorize o reset para a senha padrão (Senha123!).</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity style={[styles.dismissButton, { flex: 1, backgroundColor: '#ef4444' }]} onPress={() => onApproveReset(item.userId, item.email)}>
                            <Text style={styles.dismissButtonText}>Resetar (Senha123!)</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.dismissButton, { flex: 1, backgroundColor: '#f87171' }]} onPress={() => onRejectReset(item.userId)}>
                            <Text style={styles.dismissButtonText}>Recusar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }

                  if (item.type === 'Sistema') {
                    return (
                      <View key={item.id} style={[styles.notificationCard, { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }]}>
                        <Text style={{ fontFamily: MODERN_FONT, fontWeight: '800', color: '#1e40af', marginBottom: 5 }}>{item.text}</Text>
                        <Text style={{ fontFamily: MODERN_FONT, fontSize: 11, color: '#1d4ed8', marginBottom: 10 }}>{formatTime(item.date)}</Text>
                        <TouchableOpacity style={[styles.dismissButton, { backgroundColor: '#2563eb' }]} onPress={() => onDismissSystem(item.id)}>
                          <Text style={styles.dismissButtonText}>Compreendido</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  if (item.appt) {
                    const { client, appt, phaseId } = item;
                    return (
                      <View key={appt.id} style={styles.notificationCard}>
                        <View style={styles.notifHeader}>
                          <Text style={styles.notifType}>Ação Requerida: {appt.type}</Text>
                          <Text style={styles.notifTime}>{formatTime(appt.dateTime)}</Text>
                        </View>
                        <Text style={styles.notifClient}>Cliente: <Text style={{fontWeight: '800'}}>{client.name}</Text></Text>
                        <TouchableOpacity style={[styles.dismissButton, { backgroundColor: '#f59e0b' }]} onPress={() => onDismiss(client.id, phaseId, appt.id)}>
                          <Text style={styles.dismissButtonText}>Marcar como Concluído</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  return null;
                })}

                {/* 2. HISTÓRICO DE NOTIFICAÇÕES ANTERIORES */}
                {historyNotifications.length > 0 && (
                  <>
                    <View style={styles.historyDivider}>
                      <Text style={styles.historyDividerText}>Histórico Recente</Text>
                    </View>
                    {historyNotifications.map((hist) => (
                      <View key={hist.id} style={[styles.notificationCard, { borderColor: '#e2e8f0', backgroundColor: '#f8fafc', opacity: 0.85 }]}>
                        <Text style={{ fontFamily: MODERN_FONT, fontWeight: '700', color: '#334155', marginBottom: 4, fontSize: 12 }}>
                          {getHistoryText(hist)}
                        </Text>
                        <Text style={{ fontFamily: MODERN_FONT, fontSize: 10, color: '#64748b' }}>{formatTime(hist.date)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </>
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
  modalContainerDesktop: { marginTop: 80, marginRight: 24 },
  modalContainerMobile: { marginTop: 0, marginRight: 0 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 },
  title: { fontFamily: MODERN_FONT, fontSize: 16, fontWeight: '800', color: '#0f172a' },
  
  clearHistoryButton: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  clearHistoryButtonText: { fontFamily: MODERN_FONT, fontSize: 11, fontWeight: '700', color: '#475569' },

  closeButton: { padding: 4, backgroundColor: '#f8fafc', borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 13, color: '#64748b', fontWeight: 'bold' },
  listArea: { flex: 1 },
  emptyState: { padding: 20, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  emptyText: { fontFamily: MODERN_FONT, color: '#64748b', textAlign: 'center', fontSize: 13, fontWeight: '600' },
  
  notificationCard: { backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fef08a', borderRadius: 10, padding: 16, marginBottom: 12 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  notifType: { fontFamily: MODERN_FONT, fontWeight: '800', color: '#ca8a04', fontSize: 13 },
  notifTime: { fontFamily: MODERN_FONT, color: '#a16207', fontSize: 11, fontWeight: '600' },
  notifClient: { fontFamily: MODERN_FONT, color: '#3f6212', fontSize: 13, marginBottom: 12 },
  dismissButton: { paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  dismissButtonText: { fontFamily: MODERN_FONT, color: '#ffffff', fontWeight: '700', fontSize: 12 },

  historyDivider: { marginVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 4 },
  historyDividerText: { fontFamily: MODERN_FONT, fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }
});