import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Platform, useWindowDimensions } from 'react-native';
import KanbanColumn from '../components/KanbanColumn';
import AddClientModal from '../components/AddClientModal';
import AddPhaseModal from '../components/AddPhaseModal';
import TrashModal from '../components/TrashModal';
import ClientDetailsModal from '../components/ClientDetailsModal';
import FilterModal from '../components/FilterModal';
import ImportLeadsModal from '../components/ImportLeadsModal';
import EditPhaseModal from '../components/EditPhaseModal';
import { supabase } from '../services/supabaseClient';

// Fonte moderna injetada nativamente no Web
const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function DashboardScreen() {
  // Hook de Responsividade
  const { width } = useWindowDimensions();
  const isMobile = width < 850; // Se a tela for menor que 850px, ativa o modo responsivo/mobile

  const [boardData, setBoardData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isClientModalVisible, setIsClientModalVisible] = useState(false);
  const [isPhaseModalVisible, setIsPhaseModalVisible] = useState(false);
  const [isTrashModalVisible, setIsTrashModalVisible] = useState(false);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  
  const [selectedClient, setSelectedClient] = useState(null);
  const [editingPhase, setEditingPhase] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('TODOS');

  // Referência para o ScrollView do Kanban
  const boardScrollRef = useRef(null);

  // Efeito para converter rolagem vertical do mouse em rolagem horizontal no Web
  useEffect(() => {
    if (Platform.OS === 'web' && boardScrollRef.current) {
      // O React Native Web possui o método getScrollableNode()
      const node = boardScrollRef.current.getScrollableNode 
        ? boardScrollRef.current.getScrollableNode() 
        : boardScrollRef.current;

      const handleWheel = (e) => {
        // Se a rolagem for vertical (deltaY), convertemos para horizontal (scrollLeft)
        if (e.deltaY !== 0) {
          e.preventDefault();
          node.scrollLeft += e.deltaY;
        }
      };

      node.addEventListener('wheel', handleWheel, { passive: false });
      return () => node.removeEventListener('wheel', handleWheel);
    }
  }, []);

  useEffect(() => {
    fetchBoardData();
  }, []);

  const fetchBoardData = async () => {
    try {
      const { data, error } = await supabase.from('crm_boards').select('data_payload').eq('id', 'crm_principal').maybeSingle();
      if (error) throw error;

      if (data) {
        setBoardData(data.data_payload);
      } else {
        const defaultData = { boardId: "crm_principal", phases: [{ id: "phase_1", title: "Novo Cliente", clients: [] }] };
        setBoardData(defaultData);
        await supabase.from('crm_boards').insert([{ id: 'crm_principal', data_payload: defaultData }]);
      }
    } catch (error) {
      console.error("Erro ao buscar dados:", error.message);
      alert("Erro ao carregar o CRM.");
    } finally {
      setLoading(false);
    }
  };

  const syncBoardToDatabase = async (updatedBoard) => {
    try {
      const { data, error } = await supabase.from('crm_boards').update({ data_payload: updatedBoard }).eq('id', 'crm_principal').select();
      if (error) throw error;
      if (!data || data.length === 0) console.error("Falha silenciosa no RLS.");
    } catch (error) {
      console.error("Erro ao salvar:", error.message);
    }
  };

  const handleSaveNewClient = (newClient) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    newClient.createdAt = new Date().toISOString();
    
    // Novo padrão: +55 (xx) xxxxxxxxx (sem hífen)
    if (newClient.phone) {
      let cl = newClient.phone.replace(/\D/g, '');
      if (!cl.startsWith('55') && cl.length <= 11) cl = '55' + cl;
      const match = cl.match(/^(\d{2})(\d{2})(\d+)$/);
      newClient.phone = match ? `+${match[1]} (${match[2]}) ${match[3]}` : newClient.phone;
    }

    if (updatedBoard.phases.length > 0) {
      updatedBoard.phases[0].clients.push(newClient);
      setBoardData(updatedBoard); 
      syncBoardToDatabase(updatedBoard); 
    } else {
      alert("Crie pelo menos uma fase.");
    }
  };

  const handleSaveNewPhase = (phaseTitle) => {
    if (!boardData) return;
    const newPhase = { id: `phase_${Date.now()}`, title: phaseTitle, clients: [], color: '#f1f5f9' };
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    updatedBoard.phases.push(newPhase);
    setBoardData(updatedBoard); 
    syncBoardToDatabase(updatedBoard); 
  };

  const handleDropClient = (clientId, sourcePhaseId, targetPhaseId) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    const sourcePhaseIndex = updatedBoard.phases.findIndex(p => p.id === sourcePhaseId);
    const targetPhaseIndex = updatedBoard.phases.findIndex(p => p.id === targetPhaseId);
    if (sourcePhaseIndex === -1 || targetPhaseIndex === -1) return;
    const clientIndex = updatedBoard.phases[sourcePhaseIndex].clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return;
    const [movedClient] = updatedBoard.phases[sourcePhaseIndex].clients.splice(clientIndex, 1);
    movedClient.updatedAt = new Date().toISOString();
    updatedBoard.phases[targetPhaseIndex].clients.push(movedClient);
    setBoardData(updatedBoard);
    syncBoardToDatabase(updatedBoard);
  };

  // Função que injeta comentários automáticos via ações rápidas no Card
  const handleAddCommentToClient = (clientId, phaseId, commentText) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    
    const phaseIndex = updatedBoard.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex !== -1) {
      const clientIndex = updatedBoard.phases[phaseIndex].clients.findIndex(c => c.id === clientId);
      if (clientIndex !== -1) {
        const client = updatedBoard.phases[phaseIndex].clients[clientIndex];
        const autoComment = {
          id: `auto_${Date.now()}`,
          text: commentText,
          date: new Date().toISOString()
        };
        client.comments = [autoComment, ...(client.comments || [])];
        
        setBoardData(updatedBoard);
        syncBoardToDatabase(updatedBoard);
      }
    }
  };

  const handleMoveToTrash = (clientId, phaseId) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    if (!updatedBoard.trash) updatedBoard.trash = [];
    const phaseIndex = updatedBoard.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex === -1) return;
    const clientIndex = updatedBoard.phases[phaseIndex].clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return;
    const [deletedClient] = updatedBoard.phases[phaseIndex].clients.splice(clientIndex, 1);
    deletedClient.originalPhaseId = phaseId;
    updatedBoard.trash.push(deletedClient);
    setBoardData(updatedBoard);
    syncBoardToDatabase(updatedBoard);
  };

  const handlePermanentDelete = (clientId) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    if (!updatedBoard.trash) return;
    updatedBoard.trash = updatedBoard.trash.filter(c => c.id !== clientId);
    setBoardData(updatedBoard);
    syncBoardToDatabase(updatedBoard);
  };

  const handleRestoreFromTrash = (clientId) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    if (!updatedBoard.trash) return;
    const trashIndex = updatedBoard.trash.findIndex(c => c.id === clientId);
    if (trashIndex === -1) return;
    const [restoredClient] = updatedBoard.trash.splice(trashIndex, 1);
    let targetPhase = updatedBoard.phases.find(p => p.id === restoredClient.originalPhaseId);
    if (!targetPhase && updatedBoard.phases.length > 0) targetPhase = updatedBoard.phases[0];
    if (targetPhase) {
      delete restoredClient.originalPhaseId;
      targetPhase.clients.push(restoredClient);
      setBoardData(updatedBoard);
      syncBoardToDatabase(updatedBoard);
    }
  };

  const handleOpenClientDetails = (client, phaseId) => {
    setSelectedClient({ ...client, currentPhaseId: phaseId });
    setIsDetailsModalVisible(true);
  };

  const handleUpdateClientDetails = (updatedClientData) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    const phaseId = updatedClientData.currentPhaseId;
    const phaseIndex = updatedBoard.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex !== -1) {
      const clientIndex = updatedBoard.phases[phaseIndex].clients.findIndex(c => c.id === updatedClientData.id);
      if (clientIndex !== -1) {
        delete updatedClientData.currentPhaseId;
        updatedBoard.phases[phaseIndex].clients[clientIndex] = updatedClientData;
        setBoardData(updatedBoard);
        syncBoardToDatabase(updatedBoard);
      }
    }
  };

  const handleUpdatePhase = (phaseId, newTitle, newColor) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    const phaseIndex = updatedBoard.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex !== -1) {
      updatedBoard.phases[phaseIndex].title = newTitle;
      updatedBoard.phases[phaseIndex].color = newColor;
      setBoardData(updatedBoard);
      syncBoardToDatabase(updatedBoard);
    }
  };

  const handleDeletePhase = (phaseId) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    const phaseIndex = updatedBoard.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex === -1) return;
    if (!updatedBoard.trash) updatedBoard.trash = [];
    const phaseToDelete = updatedBoard.phases[phaseIndex];
    phaseToDelete.clients.forEach(client => {
      client.originalPhaseId = phaseId;
      updatedBoard.trash.push(client);
    });
    updatedBoard.phases.splice(phaseIndex, 1);
    setBoardData(updatedBoard);
    syncBoardToDatabase(updatedBoard);
  };

  const handleReorderPhase = (sourcePhaseId, targetPhaseId) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    const sourceIndex = updatedBoard.phases.findIndex(p => p.id === sourcePhaseId);
    const targetIndex = updatedBoard.phases.findIndex(p => p.id === targetPhaseId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const [movedPhase] = updatedBoard.phases.splice(sourceIndex, 1);
    updatedBoard.phases.splice(targetIndex, 0, movedPhase);
    setBoardData(updatedBoard);
    syncBoardToDatabase(updatedBoard);
  };

  const handleImportLeads = (newClientsArray) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    if (updatedBoard.phases.length > 0) {
      updatedBoard.phases[0].clients.unshift(...newClientsArray);
      setBoardData(updatedBoard);
      syncBoardToDatabase(updatedBoard);
    }
  };

  const getFilteredBoard = () => {
    if (!boardData) return null;
    const query = searchQuery.toLowerCase();
    const filteredPhases = boardData.phases.map(phase => {
      const filteredClients = phase.clients.filter(client => {
        const matchesText = !query || (client.name?.toLowerCase().includes(query)) || (client.phone?.toLowerCase().includes(query)) || (client.initialInfo?.toLowerCase().includes(query));
        let matchesTag = true;
        if (activeFilter === 'QUENTE') matchesTag = client.leadTemp?.toLowerCase().includes('quente');
        else if (activeFilter === 'COM_LANCE') matchesTag = !!(client.bidAmount && client.bidAmount.trim() !== '' && client.bidAmount.trim() !== '0' && client.bidAmount.trim().toLowerCase() !== 'não');
        else if (activeFilter === 'ALTA_PROB') {
          const prob = parseInt(client.winProbability?.replace(/\D/g, '') || '0');
          matchesTag = prob >= 50;
        }
        return matchesText && matchesTag;
      });
      return { ...phase, clients: filteredClients };
    });
    return { ...boardData, phases: filteredPhases };
  };

  const filteredBoardData = getFilteredBoard();

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* CABEÇALHO RESPONSIVO */}
      <View style={styles.headerContainer}>
        <View style={[styles.headerTop, isMobile && styles.headerTopMobile]}>
          
          <Text style={[styles.logo, isMobile && styles.logoMobile]}>Easy CRM - Alessandro Uchoa</Text>
          
          {/* Grupo de Busca - Expande no Desktop, quebra linha no Mobile */}
          <View style={[styles.searchGroup, isMobile && styles.searchGroupMobile]}>
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Buscar lead..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity 
              style={[styles.btnFilter, activeFilter !== 'TODOS' && styles.btnFilterActive]} 
              onPress={() => setIsFilterModalVisible(true)}
            >
              <Text style={[styles.btnFilterText, activeFilter !== 'TODOS' && styles.btnFilterTextActive]}>
                ⚙️ {isMobile ? '' : (activeFilter !== 'TODOS' ? 'Ativo' : 'Filtros')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Botões de Ação - Adapta o texto dependendo do espaço */}
          <View style={[styles.headerActions, isMobile && styles.headerActionsMobile]}>
            <TouchableOpacity style={[styles.btnBase, styles.btnSecondary]} onPress={() => setIsTrashModalVisible(true)}>
              <Text style={styles.btnSecondaryText}>🗑️ {!isMobile && 'Lixeira'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.btnBase, styles.btnSuccess]} onPress={() => setIsImportModalVisible(true)}>
              <Text style={styles.btnSuccessText}>📥 {!isMobile && 'Importar'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btnBase, styles.btnPrimary]} onPress={() => setIsClientModalVisible(true)}>
              <Text style={styles.btnPrimaryText}>➕ {!isMobile && 'Novo'}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
      {/* ---------------------------------- */}

      {/* ÁREA DO KANBAN COM ESPAÇO OTIMIZADO */}
      <ScrollView ref={boardScrollRef} horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'} style={styles.boardContainer}>
        {filteredBoardData?.phases?.map((phase) => (
          <KanbanColumn 
            key={phase.id} 
            phase={phase} 
            onDropClient={handleDropClient} 
            onDeleteClient={handleMoveToTrash}
            onOpenClient={handleOpenClientDetails}
            onEditPhase={(p) => setEditingPhase(p)}
            onReorderPhase={handleReorderPhase}
            onAddComment={handleAddCommentToClient}
          />
        ))}
        
        <TouchableOpacity style={styles.addPhaseButton} onPress={() => setIsPhaseModalVisible(true)}>
          <Text style={styles.addPhaseText}>+ Adicionar Fase</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAIS */}
      <AddClientModal visible={isClientModalVisible} onClose={() => setIsClientModalVisible(false)} onSave={handleSaveNewClient} />
      <AddPhaseModal visible={isPhaseModalVisible} onClose={() => setIsPhaseModalVisible(false)} onSave={handleSaveNewPhase} />
      <TrashModal visible={isTrashModalVisible} onClose={() => setIsTrashModalVisible(false)} trashClients={boardData?.trash || []} onPermanentDelete={handlePermanentDelete} onRestore={handleRestoreFromTrash} />
      <FilterModal visible={isFilterModalVisible} onClose={() => setIsFilterModalVisible(false)} activeFilter={activeFilter} onSelectFilter={setActiveFilter} />
      <ImportLeadsModal visible={isImportModalVisible} onClose={() => setIsImportModalVisible(false)} onImport={handleImportLeads} />
      <EditPhaseModal visible={!!editingPhase} onClose={() => setEditingPhase(null)} phase={editingPhase} onSave={handleUpdatePhase} onDelete={handleDeletePhase} />
      <ClientDetailsModal visible={isDetailsModalVisible} onClose={() => { setIsDetailsModalVisible(false); setSelectedClient(null); }} clientData={selectedClient} onSave={handleUpdateClientDetails} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Fundo cinza ultraclaro super moderno
  },
  
  /* --- ESTILOS DO CABEÇALHO --- */
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16, // Espaço reduzido
    zIndex: 10,
    ...Platform.select({ web: { boxShadow: '0px 1px 3px rgba(0,0,0,0.05)' } })
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerTopMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  logo: {
    fontFamily: MODERN_FONT,
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  logoMobile: {
    textAlign: 'center',
  },

  /* --- BUSCA E FILTROS --- */
  searchGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 600,
  },
  searchGroupMobile: {
    maxWidth: '100%',
  },
  searchInput: {
    flex: 1,
    fontFamily: MODERN_FONT,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
  btnFilter: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  btnFilterActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  btnFilterText: {
    fontFamily: MODERN_FONT,
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 14,
  },
  btnFilterTextActive: { color: '#2563EB' },

  /* --- BOTÕES DE AÇÃO --- */
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActionsMobile: {
    justifyContent: 'center', // Centraliza no celular
  },
  btnBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  btnSecondaryText: { fontFamily: MODERN_FONT, color: '#4B5563', fontWeight: '600', fontSize: 14 },
  
  btnSuccess: { backgroundColor: '#10B981' }, // Verde esmeralda moderno
  btnSuccessText: { fontFamily: MODERN_FONT, color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  
  btnPrimary: { backgroundColor: '#2563EB' }, // Azul vibrante
  btnPrimaryText: { fontFamily: MODERN_FONT, color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  /* --- ÁREA DO KANBAN --- */
  boardContainer: {
    flex: 1,
    paddingTop: 16, // Removeu o abismo em branco acima das colunas
    paddingHorizontal: 16,
  },
  addPhaseButton: {
    width: 300,
    backgroundColor: 'rgba(226, 232, 240, 0.5)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    maxHeight: 52,
    marginRight: 24,
  },
  addPhaseText: {
    fontFamily: MODERN_FONT,
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
});