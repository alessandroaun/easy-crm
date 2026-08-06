import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';

const LIGHT_COLORS = [
  '#f1f5f9', '#e0f2fe', '#dcfce7', '#fef9c3', '#ffedd5', '#fee2e2', '#f3e8ff',
];

export default function EditPhaseModal({ visible, onClose, phase, allPhases, onSave, onDelete }) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#f1f5f9');
  const [selectedOrder, setSelectedOrder] = useState('1');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Calcula o total de colunas para exibir na lista de opções
  const totalColumns = allPhases && allPhases.length > 0 ? allPhases.length : 1;

  useEffect(() => {
    if (phase) {
      setTitle(phase.title);
      setColor(phase.color || '#f1f5f9');
      setIsConfirmingDelete(false);
      
      // Define a ordem atual da fase como padrão no campo
      const currentOrder = phase.order !== undefined && phase.order !== null ? phase.order : 1;
      setSelectedOrder(String(currentOrder));
    }
  }, [phase]);

  const handleClose = () => {
    setIsConfirmingDelete(false);
    onClose();
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('O nome da fase não pode ficar vazio.');
      return;
    }

    const numericOrder = parseInt(selectedOrder, 10) || 1;

    // Reorganiza a fila enviando a nova ordem informada
    const updatedPhases = (allPhases || []).map(p => {
      if (p.id === phase.id) {
        return { ...p, title, color, order: numericOrder };
      }
      return p;
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
                <Text style={styles.title}>Editar Fase</Text>
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
                />

                <Text style={styles.label}>Cor da Coluna</Text>
                <View style={styles.colorPicker}>
                  {LIGHT_COLORS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchSelected]}
                      onPress={() => setColor(c)}
                    />
                  ))}
                </View>

                {/* SISTEMA DE LISTA NUMÉRICA PARA POSICIONAMENTO */}
                <Text style={[styles.label, { marginTop: 20 }]}>Posição / Ordem no Quadro (1 a {totalColumns})</Text>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.numberListContainer}>
                  {Array.from({ length: totalColumns }, (_, index) => {
                    const pos = index + 1;
                    const isSelected = parseInt(selectedOrder, 10) === pos;
                    
                    return (
                      <TouchableOpacity
                        key={pos}
                        style={[styles.numberCard, isSelected && styles.numberCardSelected]}
                        onPress={() => setSelectedOrder(String(pos))}
                      >
                        <Text style={[styles.numberCardText, isSelected && styles.numberCardTextSelected]}>
                          {pos}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <Text style={styles.helpText}>Toque no número correspondente à posição desejada para esta coluna da esquerda para a direita.</Text>

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
                    <Text style={styles.saveButtonText}>Salvar</Text>
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
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: {
    width: '100%', maxWidth: 450, backgroundColor: '#ffffff', borderRadius: 16, padding: 24,
    ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 20px rgba(0,0,0,0.1)' } })
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  closeButton: { padding: 4 },
  closeButtonText: { fontSize: 20, color: '#64748b', fontWeight: 'bold' },
  form: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a',
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
  colorPicker: { flexDirection: 'row', gap: 10, marginTop: 8 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0' },
  colorSwatchSelected: { borderColor: '#3b82f6', transform: [{ scale: 1.1 }] },
  
  // Estilos da Lista Numérica Horizontal
  numberListContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  numberCard: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } })
  },
  numberCardSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  numberCardText: { fontSize: 16, fontWeight: '700', color: '#475569' },
  numberCardTextSelected: { color: '#ffffff' },

  helpText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: 8 },

  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deletePhaseButton: { padding: 10 },
  deletePhaseText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#475569', fontWeight: '600', fontSize: 14 },
  saveButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#2563eb' },
  saveButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  
  confirmContainer: { alignItems: 'center', paddingTop: 10 },
  confirmTitle: { fontSize: 22, fontWeight: 'bold', color: '#ef4444', marginBottom: 12 },
  confirmMessage: { fontSize: 16, color: '#1e293b', textAlign: 'center', marginBottom: 12 },
  confirmSubMessage: { fontSize: 14, color: '#64748b', textAlign: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
});