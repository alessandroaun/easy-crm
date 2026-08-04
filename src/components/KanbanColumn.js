import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import ClientCard from './ClientCard';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function KanbanColumn({ phase, onDropClient, onDeleteClient, onOpenClient, onEditPhase, onReorderPhase, onAddComment }) {
  const columnRef = useRef(null);

  useEffect(() => {
    if (Platform.OS === 'web' && columnRef.current) {
      const node = columnRef.current;
      const handleDragStart = (e) => {
        e.stopPropagation();
        e.dataTransfer.setData('dragType', 'phase');
        e.dataTransfer.setData('phaseId', phase.id);
      };
      const handleDragOver = (e) => e.preventDefault();
      const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dragType = e.dataTransfer.getData('dragType');
        if (dragType === 'phase') {
          const sourcePhaseId = e.dataTransfer.getData('phaseId');
          if (sourcePhaseId && sourcePhaseId !== phase.id) onReorderPhase(sourcePhaseId, phase.id);
        } else {
          const clientId = e.dataTransfer.getData('clientId');
          const sourcePhaseId = e.dataTransfer.getData('sourcePhaseId');
          if (clientId && sourcePhaseId && sourcePhaseId !== phase.id) onDropClient(clientId, sourcePhaseId, phase.id);
        }
      };

      node.setAttribute('draggable', 'true');
      node.addEventListener('dragstart', handleDragStart);
      node.addEventListener('dragover', handleDragOver);
      node.addEventListener('drop', handleDrop);
      return () => {
        node.removeEventListener('dragstart', handleDragStart);
        node.removeEventListener('dragover', handleDragOver);
        node.removeEventListener('drop', handleDrop);
      };
    }
  }, [phase.id, onDropClient, onReorderPhase]);

  return (
    <View ref={columnRef} style={[styles.column, { backgroundColor: phase.color || '#F3F4F6' }]}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{phase.title}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{phase.clients.length}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.editButton} onPress={() => onEditPhase(phase)}>
          <Text style={styles.editButtonText}>Editar</Text>
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
        {phase.clients.map((client) => (
          <ClientCard key={client.id} client={client} phaseId={phase.id} onDelete={onDeleteClient} onOpen={onOpenClient} onAddComment={onAddComment}/>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { 
    width: 320, 
    borderRadius: 12, 
    paddingHorizontal: 12, // Um pouco mais estreito internamente
    paddingTop: 16,
    paddingBottom: 4,
    marginRight: 20, 
    maxHeight: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)', // Borda sutil de modernidade
    ...Platform.select({ web: { cursor: 'grab' } })
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingHorizontal: 4 },
  titleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap', gap: 8 },
  title: { 
    fontFamily: MODERN_FONT, // Fonte aplicada
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111827' // Texto mais escuro e sólido
  },
  badge: { backgroundColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontFamily: MODERN_FONT, fontSize: 12, fontWeight: '700', color: '#4B5563' },
  editButton: { padding: 4, marginLeft: 8 },
  editButtonText: { fontFamily: MODERN_FONT, fontSize: 12, fontWeight: '600', color: '#3B82F6' },
  scrollArea: { flex: 1 },
});