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

  useEffect(() => {
    if (phase) {
      setTitle(phase.title || '');
      setColor(phase.color || '#f1f5f9');
      setIsConfirmingDelete(false);
      
      // BLINDAGEM: Se allPhases for indefinido ou vazio, usa um array contendo só a fase atual
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
      alert('O nome da fase não pode ficar vazio.');
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

              <View style={styles.form}>
                <Text style={styles.label}>Nome da Fase</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ex: Em Negociação"
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
                  <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
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

              <View style={styles.footer}>
                <TouchableOpacity style={styles.deletePhaseButton} onPress={() => setIsConfirmingDelete(true)}>
                  <Text style={styles.deletePhaseText}>🗑️ Excluir Fase</Text>
                </TouchableOpacity>
                
                <View style={{ flexDirection: 'row', gap: 10 }}>
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

              <View style={[styles.footer, { justifyContent: 'flex-end', marginTop: 20 }]}>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: {
    width: '95%', maxWidth: 480, backgroundColor: '#ffffff', borderRadius: 16, padding: 24,
    ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 25px rgba(0,0,0,0.15)' } })
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  closeButton: { padding: 4, backgroundColor: '#f1f5f9', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 16, color: '#64748b', fontWeight: 'bold' },
  form: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 14, fontSize: 15, color: '#0f172a',
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
  colorPicker: { flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#e2e8f0' },
  colorSwatchSelected: { borderColor: '#2563eb', transform: [{ scale: 1.1 }] },
  
  kanbanOrgHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderingContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 80, // Garante que a caixa nunca suma
    maxHeight: 220,
    padding: 8,
    marginTop: 4,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 10,
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
  phaseRowHeader: { flexDirection: 'row', alignItems: 'center', flex: 1, overflow: 'hidden', paddingRight: 10 },
  positionBadge: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  positionBadgeText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  positionBadgeTextEditing: { color: '#2563eb', backgroundColor: '#dbeafe', width: '100%', height: '100%', textAlign: 'center', lineHeight: 24, borderRadius: 6 },
  colorIndicator: { width: 14, height: 14, borderRadius: 4, marginRight: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  phaseRowTitle: { fontSize: 14, fontWeight: '600', color: '#334155', flexShrink: 1 },
  phaseRowTitleEditing: { color: '#1e40af', fontWeight: '700' },
  
  phaseRowControls: { flexDirection: 'row', gap: 6 },
  moveBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#ffffff', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', ...Platform.select({ web: { cursor: 'pointer' } }) },
  moveBtnDisabled: { opacity: 0.3, backgroundColor: '#f8fafc' },
  moveBtnText: { fontSize: 12, color: '#334155', fontWeight: 'bold' },

  helpText: { fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 8, textAlign: 'center' },

  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  deletePhaseButton: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 8 },
  deletePhaseText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#475569', fontWeight: '700', fontSize: 14 },
  saveButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#2563eb' },
  saveButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  
  confirmContainer: { alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  confirmTitle: { fontSize: 24, fontWeight: '900', color: '#ef4444', marginBottom: 16 },
  confirmMessage: { fontSize: 16, color: '#1e293b', textAlign: 'center', marginBottom: 16, lineHeight: 24 },
  confirmSubMessage: { fontSize: 13, color: '#64748b', textAlign: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
});