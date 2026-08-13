import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';

const LIGHT_COLORS = [
  '#f1f5f9', '#e0f2fe', '#dcfce7', '#fef9c3', '#ffedd5', '#fee2e2', '#f3e8ff',
];

export default function EditPhaseModal({ visible, onClose, phase, allPhases, onSave, onDelete }) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#f1f5f9');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [localPhases, setLocalPhases] = useState([]);

  // Estados do Modal de Alerta Customizado
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (title, message) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setIsAlertModalVisible(true);
  };

  useEffect(() => {
    if (phase) {
      setTitle(phase.title || '');
      setColor(phase.color || '#f1f5f9');
      setIsConfirmingDelete(false);
      
      const safePhases = (Array.isArray(allPhases) && allPhases.length > 0) ? allPhases : [phase];
      const sorted = [...safePhases].sort((a, b) => (a.order || 0) - (b.order || 0));
      setLocalPhases(sorted);
    }
  }, [phase, allPhases]);

  const handleClose = () => {
    setIsConfirmingDelete(false);
    onClose();
  };

  const movePhase = (direction) => {
    const currentIndex = localPhases.findIndex(p => p.id === phase.id);
    if (currentIndex === -1) return;

    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= localPhases.length) return;

    const newList = [...localPhases];
    const temp = newList[currentIndex];
    newList[currentIndex] = newList[newIndex];
    newList[newIndex] = temp;

    setLocalPhases(newList);
  };

  const handleSave = () => {
    if (!title.trim()) {
      showAlert('Atenção', 'O nome da fase não pode ficar vazio.');
      return;
    }

    const updatedPhases = localPhases.map((p, index) => {
      if (p.id === phase.id) {
        return { ...p, title, color, order: index + 1 };
      }
      return { ...p, order: index + 1 };
    });

    onSave(phase.id, title, color, updatedPhases);
    handleClose();
  };

  if (!phase) return null;

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          {!isConfirmingDelete ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Configurar Fase</Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
                <View style={styles.form}>
                  <Text style={styles.label}>Nome da Fase</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Ex: Em Negociação"
                    placeholderTextColor="#94a3b8"
                  />

                  <Text style={styles.label}>Cor de Destaque da Coluna</Text>
                  <View style={styles.colorPicker}>
                    {LIGHT_COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchSelected]}
                        onPress={() => setColor(c)}
                      />
                    ))}
                  </View>

                  <View style={styles.kanbanOrgHeader}>
                    <Text style={styles.label}>Posição no Quadro (Esquerda p/ Direita)</Text>
                  </View>
                  
                  <View style={styles.orderingContainer}>
                    <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true} style={{maxHeight: 180}}>
                      {localPhases.map((p, index) => {
                        const isEditing = p.id === phase.id;
                        const displayTitle = isEditing ? (title || 'Fase sem nome') : p.title;
                        const displayColor = isEditing ? color : (p.color || '#f1f5f9');

                        return (
                          <View key={p.id || index} style={[styles.phaseRow, isEditing && styles.phaseRowEditing]}>
                            <View style={styles.phaseRowHeader}>
                              <View style={styles.positionBadge}>
                                <Text style={[styles.positionBadgeText, isEditing && styles.positionBadgeTextEditing]}>{index + 1}</Text>
                              </View>
                              <View style={[styles.colorIndicator, { backgroundColor: displayColor }]} />
                              <Text style={[styles.phaseRowTitle, isEditing && styles.phaseRowTitleEditing]} numberOfLines={1}>
                                {displayTitle}
                              </Text>
                            </View>

                            {isEditing && (
                              <View style={styles.phaseRowControls}>
                                <TouchableOpacity 
                                  onPress={() => movePhase(-1)} 
                                  disabled={index === 0} 
                                  style={[styles.moveBtn, index === 0 && styles.moveBtnDisabled]}
                                >
                                  <Text style={styles.moveBtnText}>▲</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                  onPress={() => movePhase(1)} 
                                  disabled={index === localPhases.length - 1} 
                                  style={[styles.moveBtn, index === localPhases.length - 1 && styles.moveBtnDisabled]}
                                >
                                  <Text style={styles.moveBtnText}>▼</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                  <Text style={styles.helpText}>Use as setas para reposicionar esta coluna no seu funil de vendas.</Text>
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity style={styles.deletePhaseButton} onPress={() => setIsConfirmingDelete(true)}>
                  <Text style={styles.deletePhaseText}>🗑️ Excluir Fase</Text>
                </TouchableOpacity>
                
                <View style={styles.footerActionsRight}>
                  <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Salvar Organização</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.confirmContainer}>
              <Text style={styles.confirmTitle}>⚠️ Atenção</Text>
              <Text style={styles.confirmMessage}>
                Você tem certeza que deseja excluir a fase <Text style={{fontWeight: 'bold'}}>"{phase.title}"</Text>?
              </Text>
              <Text style={styles.confirmSubMessage}>
                Todos os clientes que estão nesta coluna serão movidos para a Lixeira e poderão ser restaurados posteriormente para a coluna inicial.
              </Text>

              <View style={[styles.footer, { justifyContent: 'flex-end', marginTop: 20, width: '100%' }]}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setIsConfirmingDelete(false)}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#ef4444' }]} onPress={() => { onDelete(phase.id); handleClose(); }}>
                  <Text style={styles.saveButtonText}>Sim, Excluir Fase</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>
      </View>

      {/* MODAL DE ALERTA CUSTOMIZADO COM FADE */}
      <Modal animationType="fade" transparent={true} visible={isAlertModalVisible} onRequestClose={() => setIsAlertModalVisible(false)}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>{alertTitle}</Text>
            <Text style={styles.alertSubtitle}>{alertMessage}</Text>
            <TouchableOpacity style={styles.alertBtn} onPress={() => setIsAlertModalVisible(false)}>
              <Text style={styles.alertBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: {
    width: '100%', maxWidth: 480, maxHeight: '90%', backgroundColor: '#ffffff', borderRadius: 16, padding: 24,
    ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 25px rgba(0,0,0,0.15)' } })
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  closeButton: { padding: 4, backgroundColor: '#f1f5f9', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 16, color: '#64748b', fontWeight: 'bold' },
  
  scrollBody: { flexGrow: 0 },
  form: { marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a',
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
  colorPicker: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0' },
  colorSwatchSelected: { borderColor: '#2563eb', transform: [{ scale: 1.1 }] },
  
  kanbanOrgHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderingContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 70,
    maxHeight: 180,
    padding: 6,
    marginTop: 4,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  phaseRowEditing: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
  },
  phaseRowHeader: { flexDirection: 'row', alignItems: 'center', flex: 1, overflow: 'hidden', paddingRight: 8 },
  positionBadge: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  positionBadgeText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  positionBadgeTextEditing: { color: '#2563eb', backgroundColor: '#dbeafe', width: '100%', height: '100%', textAlign: 'center', lineHeight: 22, borderRadius: 6 },
  colorIndicator: { width: 12, height: 12, borderRadius: 4, marginRight: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  phaseRowTitle: { fontSize: 14, fontWeight: '600', color: '#334155', flexShrink: 1 },
  phaseRowTitleEditing: { color: '#1e40af', fontWeight: '700' },
  
  phaseRowControls: { flexDirection: 'row', gap: 4 },
  moveBtn: { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#ffffff', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', ...Platform.select({ web: { cursor: 'pointer' } }) },
  moveBtnDisabled: { opacity: 0.3, backgroundColor: '#f8fafc' },
  moveBtnText: { fontSize: 12, color: '#334155', fontWeight: 'bold' },

  helpText: { fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 6, textAlign: 'center' },

  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 14, flexWrap: 'wrap', gap: 8 },
  footerActionsRight: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  deletePhaseButton: { padding: 10, backgroundColor: '#fee2e2', borderRadius: 8 },
  deletePhaseText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  saveButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#2563eb' },
  saveButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  
  confirmContainer: { alignItems: 'center', paddingTop: 6, paddingBottom: 6 },
  confirmTitle: { fontSize: 22, fontWeight: '900', color: '#ef4444', marginBottom: 12 },
  confirmMessage: { fontSize: 15, color: '#1e293b', textAlign: 'center', marginBottom: 12, lineHeight: 22 },
  confirmSubMessage: { fontSize: 12, color: '#64748b', textAlign: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },

  // Estilos do Modal de Alerta Customizado
  alertOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  alertContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center', ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 20px rgba(0,0,0,0.15)' } }) },
  alertTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  alertSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  alertBtn: { width: '100%', backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  alertBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 }
});