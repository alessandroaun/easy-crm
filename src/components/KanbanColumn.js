import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity, Pressable } from 'react-native';
import ClientCard from './ClientCard';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function KanbanColumn({ phase, onDropClient, onDeleteClient, onOpenClient, onEditPhase, onReorderPhase, onAddComment, isBulkSelecting, selectedLeadIds, onToggleSelectLead, onSelectAllInPhase, onDeselectAllInPhase }) {
  const columnRef = useRef(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && columnRef.current) {
      const node = columnRef.current;
      
      const handleDragOver = (e) => e.preventDefault();
      
      const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const dragType = e.dataTransfer.getData('dragType');
        
        if (dragType === 'client') {
          const clientId = e.dataTransfer.getData('clientId');
          const sourcePhaseId = e.dataTransfer.getData('sourcePhaseId');
          
          const targetNode = e.target.closest('[data-clientid]');
          const targetClientId = targetNode ? targetNode.getAttribute('data-clientid') : null;

          if (clientId && sourcePhaseId) {
            onDropClient(clientId, sourcePhaseId, phase.id, targetClientId);
          }
        }
      };

      node.addEventListener('dragover', handleDragOver);
      node.addEventListener('drop', handleDrop);
      
      return () => {
        node.removeEventListener('dragover', handleDragOver);
        node.removeEventListener('drop', handleDrop);
      };
    }
  }, [phase.id, onDropClient]);

  const handleSortClients = (criteria) => {
    setShowSortMenu(false);
    if (!phase.clients) return;

    let sorted = [...phase.clients];

    switch (criteria) {
      case 'alpha_asc': 
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'date_desc': 
        sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        break;
      case 'date_asc': 
        sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
      case 'comments_desc': 
        sorted.sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
        break;
      case 'appts_desc': 
        sorted.sort((a, b) => (b.appointments?.length || 0) - (a.appointments?.length || 0));
        break;
      case 'bid_first': 
        sorted.sort((a, b) => {
          const hasBidA = a.bidAmount && a.bidAmount.trim() !== '' && a.bidAmount.trim().toLowerCase() !== 'não' ? 1 : 0;
          const hasBidB = b.bidAmount && b.bidAmount.trim() !== '' && b.bidAmount.trim().toLowerCase() !== 'não' ? 1 : 0;
          return hasBidB - hasBidA;
        });
        break;
      default:
        break;
    }

    phase.clients = sorted;
  };

  // Verifica se todos os leads desta fase já estão selecionados
  // Verifica se todos os leads desta fase já estão selecionados
  const phaseClientIds = phase.clients.map(c => c.id);
  const isAllSelected = phaseClientIds.length > 0 && phaseClientIds.every(id => selectedLeadIds?.includes(id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      if (onDeselectAllInPhase) onDeselectAllInPhase(phaseClientIds);
    } else {
      if (onSelectAllInPhase) onSelectAllInPhase(phaseClientIds);
    }
  };

  return (
    <View 
      ref={columnRef} 
      dataSet={{ phaseid: phase.id }} 
      style={[styles.column, { backgroundColor: phase.color || '#F3F4F6' }]}
    >
      
      {showSortMenu && (
        <Pressable style={styles.backdropOverlay} onPress={() => setShowSortMenu(false)} />
      )}

      <View style={[styles.header, showSortMenu && { zIndex: 9999 }]}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{phase.title}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{phase.clients.length}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity style={styles.iconActionButton} onPress={() => setShowSortMenu(!showSortMenu)}>
            <Text style={styles.actionSymbol}>⇄</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconActionButton} onPress={() => onEditPhase(phase)}>
            <Text style={styles.actionSymbol}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {showSortMenu && (
          <View style={styles.sortMenuDropdown}>
            <Text style={styles.sortMenuTitle}>Ordenar Fases por:</Text>
            <TouchableOpacity style={styles.sortMenuItem} onPress={() => handleSortClients('alpha_asc')}>
              <Text style={styles.sortMenuText}>Ordem Alfabética (A-Z)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortMenuItem} onPress={() => handleSortClients('date_desc')}>
              <Text style={styles.sortMenuText}>Mais Antigos Primeiro</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortMenuItem} onPress={() => handleSortClients('date_asc')}>
              <Text style={styles.sortMenuText}>Mais Novos Primeiro</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortMenuItem} onPress={() => handleSortClients('comments_desc')}>
              <Text style={styles.sortMenuText}>Mais Comentários</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortMenuItem} onPress={() => handleSortClients('appts_desc')}>
              <Text style={styles.sortMenuText}>Mais Agendamentos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortMenuItem} onPress={() => handleSortClients('bid_first')}>
              <Text style={styles.sortMenuText}>Quem Possui Lance</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* CAIXINHA DE SELECIONAR TODOS DA FASE */}
      {isBulkSelecting && phase.clients.length > 0 && (
        <TouchableOpacity style={styles.selectAllContainer} onPress={handleToggleSelectAll}>
          <View style={[styles.checkbox, isAllSelected && styles.checkboxSelected]}>
            {isAllSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.selectAllText}>Selecionar Todos ({phase.clients.length})</Text>
        </TouchableOpacity>
      )}
      
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
        {phase.clients.map((client) => (
          <ClientCard 
            key={client.id} 
            client={client} 
            phaseId={phase.id} 
            onDelete={onDeleteClient} 
            onOpen={onOpenClient} 
            onAddComment={onAddComment} 
            onDropClient={onDropClient}
            isBulkSelecting={isBulkSelecting}
            isSelected={selectedLeadIds?.includes(client.id)}
            onToggleSelect={onToggleSelectLead}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { 
    width: 270,
    borderRadius: 12, 
    paddingHorizontal: 12, 
    paddingTop: 16,
    paddingBottom: 4,
    marginRight: 16,
    maxHeight: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    position: 'relative',
  },
  backdropOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingHorizontal: 4, position: 'relative', zIndex: 1 },
  titleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap', gap: 8 },
  title: { fontFamily: MODERN_FONT, fontSize: 16, fontWeight: '700', color: '#111827' },
  badge: { backgroundColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontFamily: MODERN_FONT, fontSize: 12, fontWeight: '700', color: '#4B5563' },
  iconActionButton: { 
    backgroundColor: 'rgba(0,0,0,0.04)', 
    width: 28, 
    height: 28, 
    borderRadius: 6, 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  actionSymbol: { fontSize: 14, fontWeight: '700', color: '#4b5563' },
  selectAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectAllText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
    fontFamily: MODERN_FONT,
  },
  sortMenuDropdown: {
    position: 'absolute', top: 35, right: 0, width: 200, backgroundColor: '#ffffff',
    borderRadius: 10, padding: 8, zIndex: 99999, borderWidth: 1, borderColor: '#e2e8f0',
    ...Platform.select({ web: { boxShadow: '0px 8px 24px rgba(0,0,0,0.15)' } })
  },
  sortMenuTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6, paddingHorizontal: 6 },
  sortMenuItem: { paddingVertical: 8, paddingHorizontal: 8, borderRadius: 6, marginBottom: 2 },
  sortMenuText: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  scrollArea: { flex: 1 },
});