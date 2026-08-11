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
import NotificationModal from '../components/NotificationModal';
import MinhaCentral from '../components/MinhaCentral';
import InformacoesGerais from '../components/InformacoesGerais';
import Configuracao from '../components/Configuracao';
import WhatsAppBulkModal from '../components/WhatsAppBulkModal';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function DashboardScreen() {
  const [activeView, setActiveView] = useState('kanban'); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Hook de Responsividade
  const { width } = useWindowDimensions();
  const isMobile = width < 850; 

  const [boardData, setBoardData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isClientModalVisible, setIsClientModalVisible] = useState(false);
  const [isPhaseModalVisible, setIsPhaseModalVisible] = useState(false);
  const [isTrashModalVisible, setIsTrashModalVisible] = useState(false);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [isWhatsAppModalVisible, setIsWhatsAppModalVisible] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState([]);
  
  const [selectedClient, setSelectedClient] = useState(null);
  const [editingPhase, setEditingPhase] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('TODOS');
  const [isNotifModalVisible, setIsNotifModalVisible] = useState(false);
  const [activeNotifications, setActiveNotifications] = useState([]);
  
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let scrollInterval = null;

    const handleDragOver = (e) => {
      const edgeSize = 100; 
      const scrollSpeed = 15; 
      let scrollDelta = 0;

      if (e.clientX < edgeSize) scrollDelta = -scrollSpeed;
      else if (e.clientX > window.innerWidth - edgeSize) scrollDelta = scrollSpeed;

      if (scrollDelta !== 0) {
        if (!scrollInterval) {
          scrollInterval = setInterval(() => {
            if (boardScrollRef.current) {
              const node = boardScrollRef.current.getScrollableNode 
                ? boardScrollRef.current.getScrollableNode() 
                : boardScrollRef.current;
              node.scrollLeft += scrollDelta;
            }
          }, 20); 
        }
      } else {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
    };

    const handleDragEnd = () => {
      clearInterval(scrollInterval);
      scrollInterval = null;
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('drop', handleDragEnd);
    document.addEventListener('touchend', handleDragEnd);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDragEnd);
      document.removeEventListener('touchend', handleDragEnd);
      clearInterval(scrollInterval);
    };
  }, []);

  useEffect(() => {
    const checkNotifications = () => {
      if (!boardData) return;
      
      const now = new Date();
      const notifs = [];

      boardData.phases.forEach(phase => {
        phase.clients.forEach(client => {
          if (client.appointments) {
            client.appointments.forEach(appt => {
              if (!appt.notified) {
                const eventTime = new Date(appt.dateTime);
                const notifyTime = new Date(eventTime.getTime() - appt.reminderMinutes * 60000);
                
                if (now >= notifyTime) {
                  notifs.push({ client, appt, phaseId: phase.id });
                }
              }
            });
          }
        });
      });
      setActiveNotifications(notifs);
    };

    checkNotifications(); 
    const timer = setInterval(checkNotifications, 60000); 
    
    return () => clearInterval(timer);
  }, [boardData]);

  const boardScrollRef = useRef(null);

  useEffect(() => {
    if (Platform.OS === 'web' && boardScrollRef.current) {
      const node = boardScrollRef.current.getScrollableNode 
        ? boardScrollRef.current.getScrollableNode() 
        : boardScrollRef.current;

      const handleWheel = (e) => {
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

    const boardSubscription = supabase
      .channel('realtime-board')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', 
          schema: 'public',
          table: 'crm_boards',
          filter: "id=eq.crm_principal" 
        },
        (payload) => {
          if (payload.new && payload.new.data_payload) {
            setBoardData(payload.new.data_payload);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(boardSubscription);
    };
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

  const addSystemNotification = (title, message) => {
    const newNotif = {
      id: `sys_${Date.now()}`,
      type: 'Sistema',
      text: message,
      date: new Date().toISOString()
    };
    setSystemNotifications(prev => [newNotif, ...prev]);
  };

  const handleSaveNewClient = (newClient) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    newClient.createdAt = new Date().toISOString();
    
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

  const handleDismissNotification = (clientId, phaseId, appointmentId) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    
    const phaseIndex = updatedBoard.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex !== -1) {
      const clientIndex = updatedBoard.phases[phaseIndex].clients.findIndex(c => c.id === clientId);
      if (clientIndex !== -1) {
        const client = updatedBoard.phases[phaseIndex].clients[clientIndex];
        const apptIndex = client.appointments.findIndex(a => a.id === appointmentId);
        
        if (apptIndex !== -1) {
          client.appointments[apptIndex].notified = true; 
          setBoardData(updatedBoard);
          syncBoardToDatabase(updatedBoard);
        }
      }
    }
  };

  const handleSaveNewPhase = (phaseTitle) => {
    if (!boardData) return;
    
    const nextOrder = boardData.phases.length > 0 
      ? Math.max(...boardData.phases.map(p => p.order || 0)) + 1 
      : 1;

    const newPhase = { 
      id: `phase_${Date.now()}`, 
      title: phaseTitle, 
      clients: [], 
      color: '#f1f5f9',
      order: nextOrder 
    };
    
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    updatedBoard.phases.push(newPhase);
    
    updatedBoard.phases.sort((a, b) => (a.order || 0) - (b.order || 0));

    setBoardData(updatedBoard); 
    syncBoardToDatabase(updatedBoard); 
  };

  const handleDropClient = (clientId, sourcePhaseId, targetPhaseId, targetClientId = null) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    const sourcePhaseIndex = updatedBoard.phases.findIndex(p => p.id === sourcePhaseId);
    const targetPhaseIndex = updatedBoard.phases.findIndex(p => p.id === targetPhaseId);
    if (sourcePhaseIndex === -1 || targetPhaseIndex === -1) return;
    
    const clientIndex = updatedBoard.phases[sourcePhaseIndex].clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return;
    
    const [movedClient] = updatedBoard.phases[sourcePhaseIndex].clients.splice(clientIndex, 1);
    
    movedClient.updatedAt = new Date().toISOString();

    if (sourcePhaseId !== targetPhaseId) {
      const sourcePhaseName = updatedBoard.phases[sourcePhaseIndex].title;
      const targetPhaseName = updatedBoard.phases[targetPhaseIndex].title;
      const phaseChangeComment = {
        id: `move_${Date.now()}`,
        text: `⚙️ Sistema: Lead movido da fase "${sourcePhaseName}" para "${targetPhaseName}".`,
        date: new Date().toISOString()
      };
      movedClient.comments = [phaseChangeComment, ...(movedClient.comments || [])];
    }

    if (targetClientId && targetClientId !== clientId) {
      const targetClientIndex = updatedBoard.phases[targetPhaseIndex].clients.findIndex(c => c.id === targetClientId);
      
      if (targetClientIndex !== -1) {
        updatedBoard.phases[targetPhaseIndex].clients.splice(targetClientIndex, 0, movedClient);
      } else {
        updatedBoard.phases[targetPhaseIndex].clients.push(movedClient);
      }
    } else if (sourcePhaseId === targetPhaseId) {
      updatedBoard.phases[targetPhaseIndex].clients.splice(clientIndex, 0, movedClient);
    } else {
      updatedBoard.phases[targetPhaseIndex].clients.push(movedClient);
    }

    setBoardData(updatedBoard);
    syncBoardToDatabase(updatedBoard);
  };

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

  const handleUpdatePhase = (phaseId, newTitle, newColor, updatedPhases) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    updatedBoard.phases = updatedPhases;
    const phaseIndex = updatedBoard.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex !== -1) {
      updatedBoard.phases[phaseIndex].title = newTitle;
      updatedBoard.phases[phaseIndex].color = newColor;
    }
    setBoardData(updatedBoard);
    syncBoardToDatabase(updatedBoard);
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
        
        const matchesText = !query || 
          (client.name?.toLowerCase().includes(query)) || 
          (client.phone?.toLowerCase().includes(query)) || 
          (client.initialInfo?.toLowerCase().includes(query));
        
        let matchesTag = true;
        
        const cat = client.category?.toLowerCase() || '';
        const plat = client.platform?.toLowerCase() || '';
        const isWaError = client.whatsappError === true;

        switch(activeFilter) {
          case 'AUTO':
            matchesTag = cat.includes('auto') || cat.includes('carro');
            break;
          case 'IMOVEL':
            matchesTag = cat.includes('imóvel') || cat.includes('casa') || cat.includes('apartamento');
            break;
          case 'INVESTIMENTO':
            matchesTag = cat.includes('investimento');
            break;
          case 'INSTAGRAM':
            matchesTag = plat.includes('instagram') || plat === 'ig';
            break;
          case 'FACEBOOK':
            matchesTag = plat.includes('facebook') || plat === 'fb';
            break;
          case 'COM_WA':
            matchesTag = !isWaError; 
            break;
          case 'SEM_WA':
            matchesTag = isWaError; 
            break;
          case 'TODOS':
          default:
            matchesTag = true;
            break;
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
      
      {/* ===== INÍCIO DO CABEÇALHO CONDICIONAL ===== */}
      {isMobile ? (
        // LAYOUT EXCLUSIVO PARA CELULAR (Organizado em 3 linhas compactas)
        <View style={styles.topHeaderMobileContainer}>
          
          {/* 1ª Linha: Menu + Logo + Notificações */}
          <View style={styles.mobileRowTop}>
            <View style={styles.headerLeftGroup}>
              <TouchableOpacity style={styles.menuButton} onPress={() => setIsMenuOpen(true)}>
                <Text style={styles.menuIcon}>☰</Text>
              </TouchableOpacity>
              <Text style={styles.logoText3D}>ALÊ CRM</Text>
            </View>
            
            <TouchableOpacity style={styles.iconBtn} onPress={() => setIsNotifModalVisible(true)}>
              <Text style={styles.iconBtnText}>🔔</Text>
              {(activeNotifications.length + systemNotifications.length) > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {activeNotifications.length + systemNotifications.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* 2ª Linha: Busca + Filtro (100% da largura) */}
          <View style={styles.mobileRowMiddle}>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar Lead..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <TouchableOpacity 
              style={[styles.filterBtn, activeFilter !== 'TODOS' && styles.filterBtnActive]} 
              onPress={() => setIsFilterModalVisible(true)}
            >
              <Text style={[styles.filterBtnText, activeFilter !== 'TODOS' && styles.filterBtnTextActive]}>
                Filtro
              </Text>
            </TouchableOpacity>
          </View>

          {/* 3ª Linha: Ações de Lixeira, Importar e Novo */}
          <View style={styles.mobileRowBottom}>
            <TouchableOpacity style={[styles.actionBtnSecondary, styles.mobileActionBtn]} onPress={() => setIsTrashModalVisible(true)}>
              <Text style={styles.actionBtnSecondaryText}>Lixeira</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnSecondary, styles.mobileActionBtn]} onPress={() => setIsImportModalVisible(true)}>
              <Text style={styles.actionBtnSecondaryText}>Importar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnPrimary, styles.mobileActionBtn, { flex: 1.2 }]} onPress={() => setIsClientModalVisible(true)}>
              <Text style={styles.actionBtnPrimaryText}>+ Novo</Text>
            </TouchableOpacity>
          </View>

        </View>
      ) : (
        // LAYOUT EXCLUSIVO PARA COMPUTADOR (Preservado exatamente como estava)
        <View style={styles.topHeader}>
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity style={styles.menuButton} onPress={() => setIsMenuOpen(true)}>
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>
            <Text style={styles.logoText3D}>ALÊ CRM</Text>

            <View style={styles.headerCenter}>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar Lead..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <TouchableOpacity 
                style={[styles.filterBtn, activeFilter !== 'TODOS' && styles.filterBtnActive]} 
                onPress={() => setIsFilterModalVisible(true)}
              >
                <Text style={[styles.filterBtnText, activeFilter !== 'TODOS' && styles.filterBtnTextActive]}>
                  Filtro
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setIsNotifModalVisible(true)}>
              <Text style={styles.iconBtnText}>🔔</Text>
              {(activeNotifications.length + systemNotifications.length) > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {activeNotifications.length + systemNotifications.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {Platform.OS === 'web' && (
              <TouchableOpacity 
                style={[styles.actionBtnSecondary, { backgroundColor: '#16a34a', borderColor: '#16a34a' }]} 
                onPress={() => setIsWhatsAppModalVisible(true)}
              >
                <Text style={[styles.actionBtnSecondaryText, { color: '#fff' }]}>DisparaZap</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => setIsTrashModalVisible(true)}>
              <Text style={styles.actionBtnSecondaryText}>Lixeira</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => setIsImportModalVisible(true)}>
              <Text style={styles.actionBtnSecondaryText}>Importar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => setIsClientModalVisible(true)}>
              <Text style={styles.actionBtnPrimaryText}>Novo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* ===== FIM DO CABEÇALHO ===== */}

      {/* RENDERIZAÇÃO CONDICIONAL DAS TELAS */}
      
      {activeView === 'kanban' && (
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
      )}

      {activeView === 'minha_central' && (
        <MinhaCentral boardData={boardData} onOpenClient={handleOpenClientDetails} />
      )}

      {activeView === 'info_gerais' && (
        <InformacoesGerais />
      )}

      {activeView === 'configuracao' && (
        <Configuracao />
      )}

      {/* MODAL DO MENU LATERAL */}
      {isMenuOpen && (
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity style={styles.sidebarBackdrop} onPress={() => setIsMenuOpen(false)} />
          <View style={[styles.sidebarContent, isMobile && { width: '80%' }]}>
            <Text style={styles.sidebarTitle}>Navegação</Text>
            
            <TouchableOpacity style={[styles.menuItem, activeView === 'kanban' && styles.menuItemActive]} onPress={() => { setActiveView('kanban'); setIsMenuOpen(false); }}>
              <Text style={[styles.menuItemText, activeView === 'kanban' && styles.menuItemTextActive]}>📊 Painel Kanban</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.menuItem, activeView === 'minha_central' && styles.menuItemActive]} onPress={() => { setActiveView('minha_central'); setIsMenuOpen(false); }}>
              <Text style={[styles.menuItemText, activeView === 'minha_central' && styles.menuItemTextActive]}>🎯 Minha Central</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, activeView === 'info_gerais' && styles.menuItemActive]} onPress={() => { setActiveView('info_gerais'); setIsMenuOpen(false); }}>
              <Text style={[styles.menuItemText, activeView === 'info_gerais' && styles.menuItemTextActive]}>ℹ️ Informações Gerais</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, activeView === 'configuracao' && styles.menuItemActive]} onPress={() => { setActiveView('configuracao'); setIsMenuOpen(false); }}>
              <Text style={[styles.menuItemText, activeView === 'configuracao' && styles.menuItemTextActive]}>⚙️ Configuração</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* MODAIS */}
      <AddClientModal visible={isClientModalVisible} onClose={() => setIsClientModalVisible(false)} onSave={handleSaveNewClient} />
      <AddPhaseModal visible={isPhaseModalVisible} onClose={() => setIsPhaseModalVisible(false)} onSave={handleSaveNewPhase} />
      <TrashModal visible={isTrashModalVisible} onClose={() => setIsTrashModalVisible(false)} trashClients={boardData?.trash || []} onPermanentDelete={handlePermanentDelete} onRestore={handleRestoreFromTrash} />
      <FilterModal visible={isFilterModalVisible} onClose={() => setIsFilterModalVisible(false)} activeFilter={activeFilter} onSelectFilter={setActiveFilter} />
      <ImportLeadsModal visible={isImportModalVisible} onClose={() => setIsImportModalVisible(false)} onImport={handleImportLeads} />
      <EditPhaseModal visible={!!editingPhase} onClose={() => setEditingPhase(null)} phase={editingPhase} allPhases={boardData.phases} onSave={handleUpdatePhase} onDelete={handleDeletePhase} />
      <ClientDetailsModal visible={isDetailsModalVisible} onClose={() => { setIsDetailsModalVisible(false); setSelectedClient(null); }} clientData={selectedClient} onSave={handleUpdateClientDetails} />
      <NotificationModal 
        visible={isNotifModalVisible} 
        onClose={() => setIsNotifModalVisible(false)} 
        notifications={[...activeNotifications, ...systemNotifications]} 
        onDismiss={handleDismissNotification}
        onDismissSystem={() => setSystemNotifications([])} 
      />

      <WhatsAppBulkModal 
        visible={isWhatsAppModalVisible} 
        onClose={() => setIsWhatsAppModalVisible(false)} 
        boardData={boardData}
        onComplete={(stats) => {
          addSystemNotification('Disparo Concluído', `Os disparos para ${stats.total} leads foram finalizados. Sucesso: ${stats.success}, Erros: ${stats.error}.`);
          setIsNotifModalVisible(true);
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', 
  },
  
  /* --- ESTILOS DO CABEÇALHO DESKTOP (Preservados) --- */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    zIndex: 50,
    ...Platform.select({ web: { boxShadow: '0px 1px 3px rgba(0,0,0,0.05)' } })
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  menuButton: {
    padding: 2,
  },
  menuIcon: {
    fontSize: 20,
    color: '#334155',
    fontWeight: 'bold',
  },
  logoText3D: {
    fontFamily: MODERN_FONT,
    fontSize: 18,
    fontWeight: '900',
    color: '#1e3a8a', 
    fontStyle: 'italic',
    letterSpacing: -1,
    ...Platform.select({
      web: { textShadow: '1px 1px 0px #3b82f6, 2px 2px 0px #2563eb' }
    })
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    flex: 1,
    height: 32,
    paddingHorizontal: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: MODERN_FONT,
    fontSize: 12,
    color: '#0f172a',
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
  filterBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    height: 32,
    paddingHorizontal: 10,
    justifyContent: 'center',
    marginLeft: 6,
  },
  filterBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  filterBtnText: {
    fontFamily: MODERN_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterBtnTextActive: {
    color: '#2563EB',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  iconBtn: {
    padding: 4,
    position: 'relative',
  },
  iconBtnText: {
    fontSize: 16,
  },
  notificationBadge: {
    position: 'absolute', 
    top: 0, 
    right: 0,
    backgroundColor: '#ef4444', 
    borderRadius: 8, 
    width: 14, 
    height: 14,
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1, 
    borderColor: '#ffffff'
  },
  notificationBadgeText: { 
    color: '#ffffff', 
    fontSize: 8, 
    fontWeight: 'bold',
    fontFamily: MODERN_FONT
  },
  actionBtnSecondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  actionBtnSecondaryText: {
    fontFamily: MODERN_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  actionBtnPrimary: {
    backgroundColor: '#2563eb', 
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  actionBtnPrimaryText: {
    fontFamily: MODERN_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },

  /* --- NOVOS ESTILOS EXCLUSIVOS DO CABEÇALHO MOBILE --- */
  /* --- ESTILOS OTIMIZADOS E REDUZIDOS DO CABEÇALHO MOBILE --- */
  topHeaderMobileContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingTop: 6,      // Reduzido o topo
    paddingBottom: 8,   // Reduzido a base
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    zIndex: 50,
    ...Platform.select({ web: { boxShadow: '0px 1px 4px rgba(0,0,0,0.08)' } })
  },
  mobileRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,    // Reduzido o espaço para a próxima linha
  },
  mobileRowMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 6,    // Reduzido o espaço para a próxima linha
  },
  mobileRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    width: '100%',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    flex: 1,
    height: 28,         // Altura da barra de pesquisa menor
    paddingHorizontal: 6,
  },
  filterBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    height: 28,         // Altura do botão de filtro menor
    paddingHorizontal: 8,
    justifyContent: 'center',
    marginLeft: 6,
  },
  mobileActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6, // Botões inferiores mais finos e compactos
  },

  /* --- ÁREA DO KANBAN --- */
  boardContainer: {
    flex: 1,
    paddingTop: 16, 
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

  /* --- ESTILOS DO MENU LATERAL --- */
  sidebarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, flexDirection: 'row' },
  sidebarBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  sidebarContent: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 280, backgroundColor: '#ffffff', padding: 24, ...Platform.select({ web: { boxShadow: '4px 0px 15px rgba(0,0,0,0.1)' } }) },
  sidebarTitle: { fontFamily: MODERN_FONT, fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 24 },
  menuItem: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8, backgroundColor: '#f8fafc' },
  menuItemActive: { backgroundColor: '#eff6ff', borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  menuItemText: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: '600', color: '#475569' },
  menuItemTextActive: { color: '#2563eb' },
});