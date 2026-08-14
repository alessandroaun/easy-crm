import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Platform, useWindowDimensions, Animated } from 'react-native';
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
import AdminPanel from '../components/AdminPanel';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function DashboardScreen({ isDarkMode, toggleDarkMode }) {
  const [activeView, setActiveView] = useState('kanban'); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSellersDropdownOpen, setIsSellersDropdownOpen] = useState(false);
  
  // Estado para detectar se o app está rodando via Electron
  const [isElectron, setIsElectron] = useState(false);

  // Hook de Responsividade
  const { width } = useWindowDimensions();
  const isMobile = width < 850; 

  const [boardData, setBoardData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loggedUserId, setLoggedUserId] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [isClientModalVisible, setIsClientModalVisible] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  
  // Estados da Transferência em Massa de Leads
  const [isBulkTransferActive, setIsBulkTransferActive] = useState(false);
  const [bulkTargetUserId, setBulkTargetUserId] = useState(null);
  const [isBulkDropdownOpen, setIsBulkDropdownOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  // Estados da Troca de Senha Própria
  const [isChangePassModalVisible, setIsChangePassModalVisible] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [newPassConfirm, setNewPassConfirm] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Adicione este estado e referência de animação para o menu lateral
  const slideAnim = useRef(new Animated.Value(-280)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [isMenuRendered, setIsMenuRendered] = useState(false);

  const openSidebar = () => {
    setIsMenuRendered(true);
    setIsMenuOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -280,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setIsMenuRendered(false);
      setIsMenuOpen(false);
    });
  };

  // Motor Dinâmico de Alertas (Sucesso / Erro)
  const [alertConfig, setAlertConfig] = useState({ visible: false, type: 'success', title: '', message: '' });
  const alertScale = useRef(new Animated.Value(0.8)).current;
  const alertOpacity = useRef(new Animated.Value(0)).current;

  const showCustomAlert = (type, title, message) => {
    setAlertConfig({ visible: true, type, title, message });
    alertScale.setValue(0.8);
    alertOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(alertScale, { toValue: 1, friction: 6, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(alertOpacity, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' })
    ]).start();
  };

  const closeCustomAlert = () => {
    Animated.parallel([
      Animated.timing(alertScale, { toValue: 0.8, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(alertOpacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' })
    ]).start(() => {
      setAlertConfig({ visible: false, type: 'success', title: '', message: '' });
    });
  };

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
  if (!loggedUserId) return;

  const profileSubscription = supabase
    .channel('public:user_profiles')
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'user_profiles',
      filter: `id=eq.${loggedUserId}` 
    }, (payload) => {
      console.log("[DEBUG] Perfil alterado, recarregando dados...");
      fetchInitialData(); 
    })
    .subscribe();

  return () => supabase.removeChannel(profileSubscription);
}, [loggedUserId]);

  useEffect(() => {
    fetchInitialData();
    
    // Detecta se está rodando no ambiente Electron
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      const isElectronEnv = userAgent.includes('electron') || window.electron || (window.process && window.process.versions && window.process.versions.electron);
      setIsElectron(!!isElectronEnv);
    }
  }, []);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setLoggedUserId(user.id);

      // 1. Busca o perfil completo
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setUserProfile(profile);

      // Se for ativo
      if (profile && profile.status === 'ativo') {
        // Se for admin, busca todos os usuários
        if (profile.role === 'admin') {
          const { data: users } = await supabase
            .from('user_profiles')
            .select('id, name, email')
            .eq('status', 'ativo');
          setUsersList(users || []);
        }
        
        // CORREÇÃO: Forçamos a definição do currentUserId
        // Se for Admin, ele começa visualizando o próprio quadro
        setCurrentUserId(user.id); 
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Erro no fetch inicial:", error);
      setLoading(false);
    }
  };
  
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

  // ===== CORREÇÃO: O CÉREBRO DAS NOTIFICAÇÕES AGORA BUSCA DADOS DO ADMIN =====
  useEffect(() => {
    const checkNotifications = async () => {
      
      // 1. Notificações do Kanban (Leads)
      if (boardData && boardData.phases && Array.isArray(boardData.phases)) {
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
      }

      // Dentro do useEffect de verificação do admin em DashboardScreen.js:
if (userProfile && userProfile.role === 'admin') {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, name, old_name, reset_requested, name_change_requested, name_change_alert');
    
    if (data && !error) {
      const adminNotifs = [];
      data.forEach(user => {
        if (user.reset_requested) {
          adminNotifs.push({
            id: `req_reset_${user.id}`,
            userId: user.id,
            email: user.email,
            name: user.name || 'Nome não informado',
            type: 'ResetRequest'
          });
        }
        if (user.name_change_requested) {
          adminNotifs.push({
            id: `req_name_${user.id}`,
            userId: user.id,
            userEmail: user.email,
            currentName: user.name || 'Nome não informado',
            type: 'NameChangeRequest'
          });
        }
        // Se a flag de alerta de mudança concluída estiver ativa
        if (user.name_change_alert) {
          adminNotifs.push({
            id: `alert_name_${user.id}`,
            userId: user.id,
            userEmail: user.email,
            oldName: user.old_name || 'Nome antigo',
            newName: user.name || 'Nome atual',
            type: 'NameChangeAlert'
          });
        }
      });
      setAdminNotifications(adminNotifs);
    }
  } catch (error) {
    console.error("Erro ao checar admin notifications:", error);
  }
}
    };

    checkNotifications(); 
    const timer = setInterval(checkNotifications, 60000); 
    return () => clearInterval(timer);
  }, [boardData, userProfile]);

  useEffect(() => {
    // Motor de Notificações Injetadas via Transferência
    if (boardData && boardData.unreadNotifications && boardData.unreadNotifications.length > 0) {
      
      // Joga para a lista local visual
      setSystemNotifications(prev => [...boardData.unreadNotifications, ...prev]);
      
      // Remove do banco de dados para não notificar duas vezes
      const updatedBoard = JSON.parse(JSON.stringify(boardData));
      delete updatedBoard.unreadNotifications;
      
      setBoardData(updatedBoard);
      syncBoardToDatabase(updatedBoard);
      
      // Abre o modal de notificação para chamar a atenção
      setIsNotifModalVisible(true);
    }
  }, [boardData]);

  const handleClearNotificationHistory = () => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    updatedBoard.notificationHistory = [];
    setBoardData(updatedBoard);
    syncBoardToDatabase(updatedBoard);
  };

  const handleDismissSystem = (id) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    
    // Procura na caixa de entrada do sistema
    const index = systemNotifications.findIndex(n => n.id === id);
    if (index !== -1) {
      const [dismissedItem] = systemNotifications.splice(index, 1);
      setSystemNotifications([...systemNotifications]);
      
      // Adiciona ao histórico do board
      if (!updatedBoard.notificationHistory) updatedBoard.notificationHistory = [];
      updatedBoard.notificationHistory.unshift(dismissedItem);
      
      setBoardData(updatedBoard);
      syncBoardToDatabase(updatedBoard);
    }
  };

  const boardScrollRef = useRef(null);

  useEffect(() => {
    console.log("[DEBUG] Estado boardData mudou:", boardData ? "Dados presentes" : "BOARD DATA ESTÁ VAZIO (NULL/UNDEF)");
  }, [boardData]);

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
    if (!currentUserId) {
      console.log("[DEBUG] currentUserId é nulo ou indefinido.");
      return;
    }

    const fetchAndSubscribeBoard = async () => {
      setLoading(true);
      console.log(`[DEBUG] Iniciando busca de board para usuário: ${currentUserId}`);
      
      const { data: boards, error } = await supabase
        .from('crm_boards')
        .select('data_payload, id')
        .eq('user_id', currentUserId)
        .ilike('id', 'board_%') 
        .order('id', { ascending: false })
        .limit(1);

      if (error) {
        console.error("[DEBUG] Erro ao buscar board no Supabase:", error);
      } else if (boards && boards.length > 0) {
        console.log(`[DEBUG] Board encontrado com ID: ${boards[0].id}. Payload recebido com sucesso.`);
        setBoardData(boards[0].data_payload);
      } else {
        console.warn(`[DEBUG] Nenhum board 'board_%' encontrado para o usuário ${currentUserId}. Criando novo.`);
        const defaultData = { phases: [{ id: "phase_1", title: "Novo Cliente", clients: [] }], trash: [] };
        const newBoardId = `board_${Date.now()}`;
        await supabase.from('crm_boards').insert([{ id: newBoardId, user_id: currentUserId, data_payload: defaultData }]);
        setBoardData(defaultData);
      }
      
      setLoading(false);
    };

    fetchAndSubscribeBoard();

    // CORREÇÃO CRUCIAL: O Realtime agora escuta apenas alterações cuja ID comece com 'board_' 
    // Isso evita que salvar das configurações ('config_...') limpe os cards do Kanban.
    const boardSubscription = supabase
      .channel(`realtime-board-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', 
          schema: 'public',
          table: 'crm_boards',
          filter: `user_id=eq.${currentUserId}` 
        },
        (payload) => {
          // Só atualiza o Kanban se o evento pertencer ao quadro Kanban real e não às configurações
          if (payload.new && payload.new.id && payload.new.id.startsWith('board_') && payload.new.data_payload) {
            setBoardData(payload.new.data_payload);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(boardSubscription);
    };
  }, [currentUserId]);

  const syncBoardToDatabase = async (updatedBoard) => {
    console.log("[DEBUG] Tentando sincronizar board para user:", currentUserId);
    try {
      if (!currentUserId) {
         console.error("[DEBUG] Sync falhou: currentUserId está vazio!");
         return;
      }
      
      // Busca o ID correto do board antes de atualizar
      const { data: boards } = await supabase
        .from('crm_boards')
        .select('id')
        .eq('user_id', currentUserId)
        .ilike('id', 'board_%') // Garante que estamos pegando o Kanban
        .limit(1);

      if (boards && boards.length > 0) {
        const boardId = boards[0].id;

        const { data, error } = await supabase
          .from('crm_boards')
          .update({ data_payload: updatedBoard })
          .eq('id', boardId) // Atualiza apenas o ID específico do board
          .eq('user_id', currentUserId);
        
        if (error) throw error;
      }
    } catch (error) {
      console.error("[DEBUG] Erro crítico no sync:", error.message);
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
      showCustomAlert('error', 'Atenção', 'Crie pelo menos uma fase.');
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

  const handleDismissNameChangeAlert = async (targetUserId, notificationId) => {
  await supabase
    .from('user_profiles')
    .update({ name_change_alert: false })
    .eq('id', targetUserId);
    
  setAdminNotifications(prev => prev.filter(n => n.id !== notificationId));
  addAdminActionToHistory(`Confirmou visualização de mudança de identidade de um vendedor.`);
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

  const handleApproveReset = async (targetUserId, targetEmail) => {
    try {
      // 1. Reseta a senha do usuário via RPC para 'Senha123!'
      const { error } = await supabase.rpc('admin_reset_user_credentials', {
        target_user_id: targetUserId,
        new_email: targetEmail,
        new_password: 'Senha123!'
      });
      if (error) throw error;
      
      // 2. Remove a flag de pedido de reset
      await supabase.from('user_profiles').update({ reset_requested: false }).eq('id', targetUserId);

      // 3. Dispara o e-mail nativo de recuperação do Supabase informando o e-mail do usuário
      await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: 'https://seu-app.com/update-password', // Opcional: link para redirecionar se necessário
      });

      showCustomAlert('success', 'Sucesso', `Senha de ${targetEmail} redefinida para 'Senha123!' e e-mail de notificação enviado pelo Supabase.`);
      setAdminNotifications(prev => prev.filter(n => n.userId !== targetUserId));
      addAdminActionToHistory(`Aprovou reset de senha para o e-mail ${targetEmail}`);
    } catch (err) {
      showCustomAlert('error', 'Erro', "Erro ao resetar: " + err.message);
    }
  };

  // Função para o Admin recusar o reset
  const handleRejectReset = async (targetUserId) => {
    await supabase.from('user_profiles').update({ reset_requested: false }).eq('id', targetUserId);
    setAdminNotifications(prev => prev.filter(n => n.userId !== targetUserId));
    addAdminActionToHistory(`Recusou pedido de reset de senha.`);
  };

  const handleApproveNameChange = async (targetUserId, notificationId) => {
    try {
      // 1. Libera o campo no perfil do usuário e remove o pedido
      const { error } = await supabase
        .from('user_profiles')
        .update({ can_edit_name: true, name_change_requested: false })
        .eq('id', targetUserId);

      if (error) throw error;

      // 2. Busca estritamente o board do Kanban do vendedor (excluindo linhas de configuração 'config_')
      const { data: vendorBoards } = await supabase
        .from('crm_boards')
        .select('data_payload, id')
        .eq('user_id', targetUserId)
        .ilike('id', 'board_%') // Garante que pega apenas os quadros Kanban reais
        .order('id', { ascending: false })
        .limit(1);

      if (vendorBoards && vendorBoards.length > 0) {
        const vendorBoardRow = vendorBoards[0];
        const payload = vendorBoardRow.data_payload || {};

        const approvalNotification = {
          id: `app_name_${Date.now()}`,
          type: 'NameChangeApproved',
          date: new Date().toISOString()
        };

        payload.unreadNotifications = [approvalNotification, ...(payload.unreadNotifications || [])];

        // Atualiza estritamente a linha do Kanban do usuário sem mexer na tabela de configurações ('config_...')
        await supabase
          .from('crm_boards')
          .update({ data_payload: payload })
          .eq('id', vendorBoardRow.id)
          .eq('user_id', targetUserId); // Dupla segurança para nunca afetar dados errados
      }

      // 3. Remove o card da lista do admin sem exibir modal de alerta
      setAdminNotifications(prev => prev.filter(n => n.id !== notificationId));
      setSystemNotifications(prev => prev.filter(n => n.id !== notificationId));
      addAdminActionToHistory(`Autorizou a alteração de nome de um vendedor.`);
    } catch (err) {
      console.error("Erro ao aprovar mudança de nome:", err);
    }
  };

  const handleRejectNameChange = async (targetUserId, notificationId) => {
    // 1. Apenas retira o bloqueio pendente
    await supabase.from('user_profiles').update({ name_change_requested: false }).eq('id', targetUserId);
    // 2. Remove o card visualmente sem modal de alerta
    setAdminNotifications(prev => prev.filter(n => n.id !== notificationId));
    setSystemNotifications(prev => prev.filter(n => n.id !== notificationId));
    addAdminActionToHistory(`Recusou a alteração de nome de um vendedor.`);
  };

  // ===== FUNÇÃO ATUALIZADA: O PRÓPRIO USUÁRIO TROCAR A SENHA (PADRÃO SENHA123!) =====
  const handleUpdateOwnPassword = async () => {
    const validatePassword = (pwd) => {
      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;
      return regex.test(pwd);
    };

    if (!validatePassword(newPass)) {
      showCustomAlert('error', 'Senha Inválida', 'A senha deve conter no mínimo 6 caracteres, incluindo letra maiúscula, minúscula, número e caractere especial (Ex: Senha123!).');
      return;
    }
    if (newPass !== newPassConfirm) {
      showCustomAlert('error', 'Erro', 'As senhas não coincidem.');
      return;
    }

    setIsChangingPass(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setIsChangingPass(false);

    if (error) {
      showCustomAlert('error', 'Erro', "Erro ao alterar senha: " + error.message);
    } else {
      showCustomAlert('success', 'Sucesso', 'Sua senha foi atualizada com sucesso!');
      setIsChangePassModalVisible(false);
      setNewPass('');
      setNewPassConfirm('');
    }
  };

  const getFilteredBoard = () => {
    if (!boardData) return null;
    const query = searchQuery.toLowerCase();
    
    // O (boardData.phases || []) impede o erro "reading 'map'"
    const filteredPhases = (boardData.phases || []).map(phase => {
      const filteredClients = (phase.clients || []).filter(client => {
        
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

  // Substitua a linha atual por esta:
const filteredBoardData = boardData ? getFilteredBoard() : { phases: [] };

  const currentTheme = isDarkMode ? darkStyles : lightStyles;

  if (loading) {
    return (
      <View style={[styles.container, currentTheme.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // TELA DE BLOQUEIO (Conta Pendente ou Inativa)
  if (!userProfile || userProfile.status !== 'ativo') {
    return (
      <View style={[styles.container, currentTheme.container, { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
        <Text style={[styles.blockTitle, currentTheme.blockTitle]}>
          {userProfile?.status === 'inativo' ? 'Conta Desativada' : 'Aguardando Liberação'}
        </Text>
        <Text style={[styles.blockText, currentTheme.blockText]}>
          {userProfile?.status === 'inativo' 
            ? 'Sua conta foi suspensa pelo administrador.' 
            : 'Seu cadastro foi recebido! Aguarde o administrador aprovar o seu acesso ao CRM.'}
        </Text>
        <TouchableOpacity 
          style={{ marginTop: 24, padding: 12, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 8 }}
          onPress={() => supabase.auth.signOut()}
        >
          <Text style={{ color: isDarkMode ? '#f8fafc' : '#475569', fontWeight: 'bold' }}>Sair / Voltar ao Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleTransferLead = async (leadData, targetUserId, withoutComment) => {
    try {
      if (!boardData) return;
      
      // 1. Remove do Kanban atual (de onde o lead está saindo)
      const updatedCurrentBoard = JSON.parse(JSON.stringify(boardData));
      let leadRemoved = false;
      
      for (let phase of updatedCurrentBoard.phases) {
        const cIndex = phase.clients.findIndex(c => c.id === leadData.id);
        if (cIndex !== -1) {
          phase.clients.splice(cIndex, 1);
          leadRemoved = true;
          break;
        }
      }
      
      if (leadRemoved) {
        setBoardData(updatedCurrentBoard);
        syncBoardToDatabase(updatedCurrentBoard);
      }

      // 2. Busca o Kanban do vendedor destino diretamente do banco
      const { data: targetBoards } = await supabase
        .from('crm_boards')
        .select('data_payload, id')
        .eq('user_id', targetUserId)
        .like('id', 'board_%') // <-- PROTEÇÃO AQUI TAMBÉM
        .order('id', { ascending: false })
        .limit(1);

      const targetBoardRow = targetBoards && targetBoards.length > 0 ? targetBoards[0] : null;

      if (targetBoardRow && targetBoardRow.data_payload) {
        let targetBoard = targetBoardRow.data_payload;
        
        // Insere comentário automático (se não foi desmarcado)
        if (!withoutComment) {
          const transferComment = {
            id: `sys_transf_${Date.now()}`,
            text: `⚙️ Sistema: Lead transferido pelo Administrador.`,
            date: new Date().toISOString()
          };
          leadData.comments = [transferComment, ...(leadData.comments || [])];
        }

        // Reseta o "updatedAt" para aparecer lá em cima na fila
        leadData.updatedAt = new Date().toISOString();

        // Adiciona na primeira fase (Novo Cliente) do vendedor destino
        if (targetBoard.phases.length > 0) {
           targetBoard.phases[0].clients.unshift(leadData);
        }
        
        // 3. Prepara a Notificação Cruzada para o destino
        const fromUser = usersList.find(u => u.id === currentUserId);
        const fromName = fromUser ? (fromUser.name || fromUser.email) : 'outro vendedor';
        
        const newNotif = {
          id: `notif_${Date.now()}`,
          type: 'Sistema',
          text: `📢 Novo Lead! O administrador transferiu "${leadData.name || 'Sem Nome'}" do funil de ${fromName} para a sua coluna inicial.`,
          date: new Date().toISOString()
        };
        
        // Anexa a notificação na "caixa de entrada" do board dele
        targetBoard.unreadNotifications = [newNotif, ...(targetBoard.unreadNotifications || [])];

        // 4. Salva o Kanban atualizado do vendedor destino no banco
        await supabase
          .from('crm_boards')
          .update({ data_payload: targetBoard })
          .eq('id', targetBoardRow.id);
          
        showCustomAlert('success', 'Transferência Concluída', `O lead foi transferido com sucesso.`);
      } else {
        showCustomAlert('error', 'Erro', 'O quadro do vendedor destino não foi encontrado ou está vazio.');
      }
    } catch (err) {
      showCustomAlert('error', 'Erro', 'Falha ao transferir lead: ' + err.message);
    }
  };

  const handleBulkTransferExecute = async () => {
    if (!bulkTargetUserId || selectedLeadIds.length === 0 || !boardData) return;
    try {
      const updatedCurrentBoard = JSON.parse(JSON.stringify(boardData));
      const extractedLeads = [];

      // 1. Remove os leads selecionados do board atual
      updatedCurrentBoard.phases.forEach(phase => {
        phase.clients = phase.clients.filter(client => {
          if (selectedLeadIds.includes(client.id)) {
            const transferComment = {
              id: `sys_transf_${Date.now()}_${Math.random()}`,
              text: `⚙️ Sistema: Lead transferido em massa pelo Administrador.`,
              date: new Date().toISOString()
            };
            client.comments = [transferComment, ...(client.comments || [])];
            client.updatedAt = new Date().toISOString();
            extractedLeads.push(client);
            return false;
          }
          return true;
        });
      });

      if (extractedLeads.length === 0) return;

      // Atualiza o board de origem
      setBoardData(updatedCurrentBoard);
      await syncBoardToDatabase(updatedCurrentBoard);

      // 2. Busca o board do vendedor destino
      const { data: targetBoards } = await supabase
        .from('crm_boards')
        .select('data_payload, id')
        .eq('user_id', bulkTargetUserId)
        .like('id', 'board_%') // <-- PROTEÇÃO AQUI TAMBÉM
        .order('id', { ascending: false })
        .limit(1);

      const targetBoardRow = targetBoards && targetBoards.length > 0 ? targetBoards[0] : null;

      if (targetBoardRow && targetBoardRow.data_payload) {
        let targetBoard = targetBoardRow.data_payload;

        if (targetBoard.phases.length > 0) {
          targetBoard.phases[0].clients.unshift(...extractedLeads);
        }

        const fromUser = usersList.find(u => u.id === currentUserId);
        const fromName = fromUser ? (fromUser.name || fromUser.email) : 'administrador';
        
        const newNotif = {
          id: `notif_${Date.now()}`,
          type: 'Sistema',
          text: `📢 Novos Leads! O administrador transferiu ${extractedLeads.length} leads do funil de ${fromName} para a sua fase de "Novo Cliente".`,
          date: new Date().toISOString()
        };

        targetBoard.unreadNotifications = [newNotif, ...(targetBoard.unreadNotifications || [])];

        await supabase
          .from('crm_boards')
          .update({ data_payload: targetBoard })
          .eq('id', targetBoardRow.id);
      }

      // Resetar os estados da transferência em massa
      setIsBulkTransferActive(false);
      setBulkTargetUserId(null);
      setSelectedLeadIds([]);
      setIsBulkDropdownOpen(false);

      showCustomAlert('success', 'Sucesso na Transferência', `Os ${extractedLeads.length} leads foram transferidos com sucesso.`);
    } catch (err) {
      showCustomAlert('error', 'Erro', 'Falha na transferência em massa: ' + err.message);
    }
  };

  const addAdminActionToHistory = (message) => {
    if (!boardData) return;
    const updatedBoard = JSON.parse(JSON.stringify(boardData));
    if (!updatedBoard.notificationHistory) updatedBoard.notificationHistory = [];
    
    updatedBoard.notificationHistory.unshift({
      id: `hist_admin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      text: `Admin: ${message}`,
      date: new Date().toISOString(),
      type: 'Sistema' // Usamos Sistema para renderizar como texto padrão
    });
    
    setBoardData(updatedBoard);
    syncBoardToDatabase(updatedBoard);
  };

  const selectedTargetUserObj = usersList.find(u => u.id === bulkTargetUserId);
  const bulkButtonLabel = selectedTargetUserObj 
    ? `Transferir Leads (${(selectedTargetUserObj.name || selectedTargetUserObj.email).split(' ')[0]})`
    : 'Transferir Leads';

  return (
    <View style={[styles.container, currentTheme.container]}>
      
      {/* ===== INÍCIO DO CABEÇALHO CONDICIONAL ===== */}
      {isMobile ? (
        // LAYOUT EXCLUSIVO PARA CELULAR (Organizado em 3 linhas compactas)
        <View style={[styles.topHeaderMobileContainer, currentTheme.topHeader]}>
          
          {/* 1ª Linha: Menu + Logo + Notificações + DarkMode Toggle */}
          <View style={styles.mobileRowTop}>
            <View style={styles.headerLeftGroup}>
              <TouchableOpacity style={styles.menuButton} onPress={openSidebar}>
                <Text style={[styles.menuIcon, currentTheme.menuIcon]}>☰</Text>
              </TouchableOpacity>
              <Text style={styles.logoText3D}>ALÊ CRM</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TouchableOpacity 
                style={[styles.themeToggleButton, currentTheme.themeToggleButton]} 
                onPress={() => toggleDarkMode(!isDarkMode)}
                activeOpacity={0.7}
              >
                <Text style={styles.themeToggleIcon}>{isDarkMode ? '☀️' : '🌙'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconBtn} onPress={() => setIsNotifModalVisible(true)}>
                <Text style={styles.iconBtnText}>🔔</Text>
                {(activeNotifications.length + systemNotifications.length + adminNotifications.length) > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {activeNotifications.length + systemNotifications.length + adminNotifications.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 2ª Linha: Busca + Filtro (100% da largura) */}
          <View style={styles.mobileRowMiddle}>
            <View style={[styles.searchContainer, currentTheme.searchContainer]}>
              <TextInput
                style={[styles.searchInput, currentTheme.searchInput]}
                placeholder="Buscar Lead..."
                placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <TouchableOpacity 
              style={[styles.filterBtn, currentTheme.filterBtn, activeFilter !== 'TODOS' && styles.filterBtnActive]} 
              onPress={() => setIsFilterModalVisible(true)}
            >
              <Text style={[styles.filterBtnText, currentTheme.filterBtnText, activeFilter !== 'TODOS' && styles.filterBtnTextActive]}>
                Filtro
              </Text>
            </TouchableOpacity>
          </View>

          {/* 3ª Linha: Ações de Lixeira, Importar, Transferir Leads (se admin) e Novo */}
          <View style={styles.mobileRowBottom}>
            {userProfile?.role === 'admin' && (
              <View style={{ position: 'relative', flex: 1 }}>
                <TouchableOpacity 
                  style={[styles.actionBtnSecondary, currentTheme.actionBtnSecondary, styles.mobileActionBtn, isBulkTransferActive && { backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff', borderColor: '#3b82f6' }]} 
                  onPress={() => {
                    if (!isBulkTransferActive) {
                      setIsBulkTransferActive(true);
                      setIsBulkDropdownOpen(true);
                    } else {
                      setIsBulkTransferActive(false);
                      setBulkTargetUserId(null);
                      setSelectedLeadIds([]);
                      setIsBulkDropdownOpen(false);
                    }
                  }}
                >
                  <Text style={[styles.actionBtnSecondaryText, currentTheme.actionBtnSecondaryText, isBulkTransferActive && { color: '#2563eb' }]} numberOfLines={1}>
                    {bulkButtonLabel}
                  </Text>
                </TouchableOpacity>

                {isBulkTransferActive && isBulkDropdownOpen && (
                  <View style={[styles.bulkDropdownMenu, currentTheme.bulkDropdownMenu]}>
                    <Text style={[styles.bulkDropdownTitle, currentTheme.bulkDropdownTitle]}>Selecione o Vendedor:</Text>
                    {usersList.map(u => (
                      <TouchableOpacity 
                        key={u.id} 
                        style={[styles.bulkDropdownItem, currentTheme.bulkDropdownItem]}
                        onPress={() => {
                          setBulkTargetUserId(u.id);
                          setIsBulkDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.bulkDropdownItemText, currentTheme.bulkDropdownItemText]} numberOfLines={1}>{u.name || u.email}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity style={[styles.actionBtnSecondary, currentTheme.actionBtnSecondary, styles.mobileActionBtn]} onPress={() => setIsTrashModalVisible(true)}>
              <Text style={[styles.actionBtnSecondaryText, currentTheme.actionBtnSecondaryText]}>Lixeira</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnSecondary, currentTheme.actionBtnSecondary, styles.mobileActionBtn]} onPress={() => setIsImportModalVisible(true)}>
              <Text style={[styles.actionBtnSecondaryText, currentTheme.actionBtnSecondaryText]}>Importar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnPrimary, styles.mobileActionBtn, { flex: 1.2 }]} onPress={() => setIsClientModalVisible(true)}>
              <Text style={styles.actionBtnPrimaryText}>+ Novo</Text>
            </TouchableOpacity>
          </View>

        </View>
      ) : (
        // LAYOUT EXCLUSIVO PARA COMPUTADOR
        <View style={[styles.topHeader, currentTheme.topHeader]}>
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity style={styles.menuButton} onPress={openSidebar}>
              <Text style={[styles.menuIcon, currentTheme.menuIcon]}>☰</Text>
            </TouchableOpacity>
            <Text style={styles.logoText3D}>ALÊ CRM</Text>

            <View style={styles.headerCenter}>
              <View style={[styles.searchContainer, currentTheme.searchContainer]}>
                <TextInput
                  style={[styles.searchInput, currentTheme.searchInput]}
                  placeholder="Buscar Lead..."
                  placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <TouchableOpacity 
                style={[styles.filterBtn, currentTheme.filterBtn, activeFilter !== 'TODOS' && styles.filterBtnActive]} 
                onPress={() => setIsFilterModalVisible(true)}
              >
                <Text style={[styles.filterBtnText, currentTheme.filterBtnText, activeFilter !== 'TODOS' && styles.filterBtnTextActive]}>
                  Filtro
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.themeToggleButton, currentTheme.themeToggleButton]} 
              onPress={() => toggleDarkMode(!isDarkMode)}
              activeOpacity={0.7}
            >
              <Text style={styles.themeToggleIcon}>{isDarkMode ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={() => setIsNotifModalVisible(true)}>
              <Text style={styles.iconBtnText}>🔔</Text>
              {(activeNotifications.length + systemNotifications.length + adminNotifications.length) > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {activeNotifications.length + systemNotifications.length + adminNotifications.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* O BOTÃO DISPARAZAP SÓ APARECE SE FOR NO ELECTRON E USUÁRIO LOGADO PRÓPRIO */}
            {Platform.OS === 'web' && isElectron && currentUserId === loggedUserId && (
              <TouchableOpacity 
                style={[styles.actionBtnSecondary, { backgroundColor: '#16a34a', borderColor: '#16a34a' }]} 
                onPress={() => setIsWhatsAppModalVisible(true)}
              >
                <Text style={[styles.actionBtnSecondaryText, { color: '#fff' }]}>DisparaZap</Text>
              </TouchableOpacity>
            )}

            {userProfile?.role === 'admin' && (
              <View style={{ position: 'relative' }}>
                <TouchableOpacity 
                  style={[styles.actionBtnSecondary, currentTheme.actionBtnSecondary, isBulkTransferActive && { backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff', borderColor: '#3b82f6' }]} 
                  onPress={() => {
                    if (!isBulkTransferActive) {
                      setIsBulkTransferActive(true);
                      setIsBulkDropdownOpen(true);
                    } else {
                      setIsBulkTransferActive(false);
                      setBulkTargetUserId(null);
                      setSelectedLeadIds([]);
                      setIsBulkDropdownOpen(false);
                    }
                  }}
                >
                  <Text style={[styles.actionBtnSecondaryText, currentTheme.actionBtnSecondaryText, isBulkTransferActive && { color: '#2563eb' }]}>
                    {bulkButtonLabel}
                  </Text>
                </TouchableOpacity>

                {isBulkTransferActive && isBulkDropdownOpen && (
                  <View style={[styles.bulkDropdownMenu, currentTheme.bulkDropdownMenu]}>
                    <Text style={[styles.bulkDropdownTitle, currentTheme.bulkDropdownTitle]}>Selecione o Vendedor:</Text>
                    {usersList.map(u => (
                      <TouchableOpacity 
                        key={u.id} 
                        style={[styles.bulkDropdownItem, currentTheme.bulkDropdownItem]}
                        onPress={() => {
                          setBulkTargetUserId(u.id);
                          setIsBulkDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.bulkDropdownItemText, currentTheme.bulkDropdownItemText]}>{u.name || u.email}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity style={[styles.actionBtnSecondary, currentTheme.actionBtnSecondary]} onPress={() => setIsTrashModalVisible(true)}>
              <Text style={[styles.actionBtnSecondaryText, currentTheme.actionBtnSecondaryText]}>Lixeira</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnSecondary, currentTheme.actionBtnSecondary]} onPress={() => setIsImportModalVisible(true)}>
              <Text style={[styles.actionBtnSecondaryText, currentTheme.actionBtnSecondaryText]}>Importar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => setIsClientModalVisible(true)}>
              <Text style={styles.actionBtnPrimaryText}>Novo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* ===== FIM DO CABEÇALHO ===== */}

      {/* RENDERIZAÇÃO CONDICIONAL DAS TELAS */}
      
      {activeView === 'kanban' && boardData && boardData.phases && (
        <ScrollView ref={boardScrollRef} horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'} style={styles.boardContainer}>
          {/* PROTEGIDO: Adicionado ?. em filteredBoardData e phases */}
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
              isBulkSelecting={isBulkTransferActive}
              selectedLeadIds={selectedLeadIds}
              onToggleSelectLead={(clientId) => {
                setSelectedLeadIds(prev => 
                  prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
                );
              }}
              onSelectAllInPhase={(phaseClientIds) => {
                setSelectedLeadIds(prev => Array.from(new Set([...prev, ...phaseClientIds])));
              }}
              onDeselectAllInPhase={(phaseClientIds) => {
                setSelectedLeadIds(prev => prev.filter(id => !phaseClientIds.includes(id)));
              }}
              isDarkMode={isDarkMode}
            />
          ))}
          <TouchableOpacity style={[styles.addPhaseButton, currentTheme.addPhaseButton]} onPress={() => setIsPhaseModalVisible(true)}>
            <Text style={[styles.addPhaseText, currentTheme.addPhaseText]}>+ Adicionar Fase</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {activeView === 'minha_central' && (
        <MinhaCentral boardData={boardData} onOpenClient={handleOpenClientDetails} isDarkMode={isDarkMode} />
      )}

      {activeView === 'info_gerais' && (
        <InformacoesGerais isDarkMode={isDarkMode} />
      )}

      {activeView === 'configuracao' && (
  <Configuracao isDarkMode={isDarkMode} onConfigSaved={() => {
    // Atualiza os dados do perfil sem quebrar o kanban
    fetchInitialData();
  }} />
)}

      {activeView === 'admin_panel' && (<AdminPanel isDarkMode={isDarkMode} />)}

      {/* BOTÃO FLUTUANTE DE TRANSFERÊNCIA EM MASSA */}
      {isBulkTransferActive && selectedLeadIds.length > 0 && bulkTargetUserId && (
        <TouchableOpacity 
          style={styles.floatingBulkBtn} 
          onPress={handleBulkTransferExecute}
        >
          <Text style={styles.floatingBulkBtnText}>Transferir ({selectedLeadIds.length})</Text>
        </TouchableOpacity>
      )}

      {/* ===== MODAL DO MENU LATERAL ANIMADO E RESPONSIVO ===== */}
      {isMenuRendered && (
        <View style={styles.sidebarOverlay}>
          <Animated.View style={[styles.sidebarBackdrop, { opacity: backdropOpacity }]}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeSidebar} />
          </Animated.View>
          
          <Animated.View style={[
            styles.sidebarContent, 
            currentTheme.sidebarContent,
            isMobile && styles.sidebarContentMobile,
            { transform: [{ translateX: slideAnim }] }
          ]}>
            
            {/* TOPO DO MENU: NOME E E-MAIL DO USUÁRIO */}
            <View style={[styles.sidebarHeaderContainer, currentTheme.sidebarHeaderContainer]}>
              <Text style={[styles.sidebarUserName, currentTheme.sidebarUserName, isMobile && styles.sidebarUserNameMobile]} numberOfLines={1}>
                Olá, {userProfile?.name ? userProfile.name.trim().split(' ')[0] : (userProfile?.email ? userProfile.email.split('@')[0] : 'Usuário')}
              </Text>
              <Text style={[styles.sidebarUserEmail, currentTheme.sidebarUserEmail, isMobile && styles.sidebarUserEmailMobile]} numberOfLines={1}>
                {userProfile?.email || ''}
              </Text>
            </View>
            
            <View style={styles.sidebarMenuContainer}>
              <TouchableOpacity 
                style={[styles.menuItem, currentTheme.menuItem, isMobile && styles.menuItemMobile, activeView === 'kanban' && (isDarkMode ? styles.menuItemActiveDark : styles.menuItemActive)]} 
                onPress={() => { setActiveView('kanban'); closeSidebar(); }}
              >
                <Text style={[styles.menuItemText, currentTheme.menuItemText, isMobile && styles.menuItemTextMobile, activeView === 'kanban' && styles.menuItemTextActive]}>Painel dos Leads</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.menuItem, currentTheme.menuItem, isMobile && styles.menuItemMobile, activeView === 'minha_central' && (isDarkMode ? styles.menuItemActiveDark : styles.menuItemActive)]} 
                onPress={() => { setActiveView('minha_central'); closeSidebar(); }}
              >
                <Text style={[styles.menuItemText, currentTheme.menuItemText, isMobile && styles.menuItemTextMobile, activeView === 'minha_central' && styles.menuItemTextActive]}>Minha Central</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.menuItem, currentTheme.menuItem, isMobile && styles.menuItemMobile, activeView === 'info_gerais' && (isDarkMode ? styles.menuItemActiveDark : styles.menuItemActive)]} 
                onPress={() => { setActiveView('info_gerais'); closeSidebar(); }}
              >
                <Text style={[styles.menuItemText, currentTheme.menuItemText, isMobile && styles.menuItemTextMobile, activeView === 'info_gerais' && styles.menuItemTextActive]}>Visão Geral</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.menuItem, currentTheme.menuItem, isMobile && styles.menuItemMobile, activeView === 'configuracao' && (isDarkMode ? styles.menuItemActiveDark : styles.menuItemActive)]} 
                onPress={() => { setActiveView('configuracao'); closeSidebar(); }}
              >
                <Text style={[styles.menuItemText, currentTheme.menuItemText, isMobile && styles.menuItemTextMobile, activeView === 'configuracao' && styles.menuItemTextActive]}>Configuração</Text>
              </TouchableOpacity>

              {userProfile?.role === 'admin' && (
                <View style={[styles.adminSectionContainer, currentTheme.adminSectionContainer]}>
                  <TouchableOpacity 
                    style={[styles.menuItem, currentTheme.adminMenuItem, isMobile && styles.menuItemMobile, activeView === 'admin_panel' && styles.adminMenuItemActive]} 
                    onPress={() => { setActiveView('admin_panel'); closeSidebar(); }}
                  >
                    <Text style={[styles.adminMenuItemText, currentTheme.adminMenuItemText, isMobile && styles.adminMenuItemTextMobile]}>Painel Administrativo</Text>
                  </TouchableOpacity>

                  {/* Seção Simples e Moderna de Vendedores */}
                  <View style={[styles.sellersBox, currentTheme.sellersBox]}>
                    <TouchableOpacity 
                      style={[styles.sellersHeaderToggle, isMobile && styles.sellersHeaderToggleMobile]}
                      onPress={() => setIsSellersDropdownOpen(!isSellersDropdownOpen)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.sellersHeaderTitle, currentTheme.sellersHeaderTitle, isMobile && styles.sellersHeaderTitleMobile]}>CRM dos Vendedores</Text>
                      <Text style={[styles.sellersHeaderArrow, currentTheme.sellersHeaderArrow]}>{isSellersDropdownOpen ? '▴' : '▾'}</Text>
                    </TouchableOpacity>
                    
                    {isSellersDropdownOpen && (
                      <ScrollView 
                        style={[styles.sellersDropdownList, currentTheme.sellersDropdownList]} 
                        nestedScrollEnabled={true}
                        showsVerticalScrollIndicator={false}
                      >
                        {(usersList || []).map(u => {
                          const isSelectedUser = currentUserId === u.id;
                          return (
                            <TouchableOpacity 
                              key={u.id}
                              style={[
                                styles.sellerItemRow,
                                isMobile && styles.sellerItemRowMobile,
                                isSelectedUser && currentTheme.sellerItemRowActive
                              ]} 
                              onPress={() => { 
                                setCurrentUserId(u.id); 
                                setActiveView('kanban'); 
                                closeSidebar(); 
                              }}
                            >
                              <View style={[styles.sellerIndicatorDot, isSelectedUser && styles.sellerIndicatorDotActive]} />
                              <Text 
                                style={[styles.sellerItemText, currentTheme.sellerItemText, isMobile && styles.sellerItemTextMobile, isSelectedUser && styles.sellerItemTextActive]} 
                                numberOfLines={1}
                              >
                                {u.id === loggedUserId ? 'Meu CRM (Próprio)' : (u.name || u.email)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                </View>
              )}
            </View>

            <View style={[styles.sidebarFooterContainer, currentTheme.sidebarFooterContainer]}>
              <TouchableOpacity 
                style={[styles.sidebarFooterButtonChangePass, currentTheme.sidebarFooterButtonChangePass, isMobile && styles.sidebarFooterButtonMobile]} 
                onPress={() => { setIsChangePassModalVisible(true); closeSidebar(); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.sidebarFooterButtonChangePassText, currentTheme.sidebarFooterButtonChangePassText, isMobile && styles.sidebarFooterButtonTextMobile]}>Trocar Minha Senha</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.sidebarFooterButtonLogout, currentTheme.sidebarFooterButtonLogout, isMobile && styles.sidebarFooterButtonMobile]} 
                onPress={() => { setIsLogoutModalVisible(true); closeSidebar(); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.sidebarFooterButtonLogoutText, currentTheme.sidebarFooterButtonLogoutText, isMobile && styles.sidebarFooterButtonTextMobile]}>Encerrar Sessão</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </View>
      )}

      {/* MODAIS */}
      <AddClientModal visible={isClientModalVisible} onClose={() => setIsClientModalVisible(false)} onSave={handleSaveNewClient} isDarkMode={isDarkMode} />
      <AddPhaseModal visible={isPhaseModalVisible} onClose={() => setIsPhaseModalVisible(false)} onSave={handleSaveNewPhase} isDarkMode={isDarkMode} />
      <TrashModal visible={isTrashModalVisible} onClose={() => setIsTrashModalVisible(false)} trashClients={boardData?.trash || []} onPermanentDelete={handlePermanentDelete} onRestore={handleRestoreFromTrash} isDarkMode={isDarkMode} />
      <FilterModal visible={isFilterModalVisible} onClose={() => setIsFilterModalVisible(false)} activeFilter={activeFilter} onSelectFilter={setActiveFilter} isDarkMode={isDarkMode} />
      <ImportLeadsModal visible={isImportModalVisible} onClose={() => setIsImportModalVisible(false)} onImport={handleImportLeads} isDarkMode={isDarkMode} />
      <EditPhaseModal visible={!!editingPhase} onClose={() => setEditingPhase(null)} phase={editingPhase} allPhases={boardData.phases} onSave={handleUpdatePhase} onDelete={handleDeletePhase} isDarkMode={isDarkMode} />
      <ClientDetailsModal visible={isDetailsModalVisible} onClose={() => { setIsDetailsModalVisible(false); setSelectedClient(null); }} clientData={selectedClient} onSave={handleUpdateClientDetails} isAdmin={userProfile?.role === 'admin'} usersList={usersList} currentUserId={currentUserId} onTransferLead={handleTransferLead} isDarkMode={isDarkMode} />
      <NotificationModal 
    visible={isNotifModalVisible} 
    onClose={() => setIsNotifModalVisible(false)} 
    notifications={[...(activeNotifications || []), ...(systemNotifications || []), ...(adminNotifications || [])]} 
    historyNotifications={boardData?.notificationHistory || []}
    onDismiss={handleDismissNotification}
    onDismissSystem={handleDismissSystem} 
    onApproveReset={handleApproveReset} 
    onRejectReset={handleRejectReset} 
    onApproveNameChange={handleApproveNameChange}
    onRejectNameChange={handleRejectNameChange}
    onDismissNameChangeAlert={handleDismissNameChangeAlert}
    onClearHistory={handleClearNotificationHistory}
    isDarkMode={isDarkMode}
  />

      <WhatsAppBulkModal 
        visible={isWhatsAppModalVisible} 
        onClose={() => setIsWhatsAppModalVisible(false)} 
        boardData={boardData}
        onComplete={(stats) => {
          addSystemNotification('Disparo Concluído', `Os disparos para ${stats.total} leads foram finalizados. Sucesso: ${stats.success}, Erros: ${stats.error}.`);
          setIsNotifModalVisible(true);
        }}
        isDarkMode={isDarkMode}
      />

      {/* ===== MODAL DE TROCA DE SENHA ===== */}
      {isChangePassModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, currentTheme.modalContent]}>
            <Text style={[styles.modalTitle, currentTheme.modalTitle]}>Trocar Minha Senha</Text>
            <Text style={[styles.modalText, currentTheme.modalText]}>Digite sua nova senha de acesso abaixo (mínimo de 6 caracteres, com maiúscula, minúscula, número e caractere especial).</Text>
            
            <TextInput
              style={[styles.passInput, currentTheme.passInput]}
              placeholder="Nova senha (ex: Senha123!)"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
              secureTextEntry
              value={newPass}
              onChangeText={setNewPass}
            />
            <TextInput
              style={[styles.passInput, currentTheme.passInput]}
              placeholder="Confirme a nova senha"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
              secureTextEntry
              value={newPassConfirm}
              onChangeText={setNewPassConfirm}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.cancelBtn, currentTheme.cancelBtn]} onPress={() => { setIsChangePassModalVisible(false); setNewPass(''); setNewPassConfirm(''); }}>
                <Text style={[styles.cancelBtnText, currentTheme.cancelBtnText]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#4f46e5' }]} onPress={handleUpdateOwnPassword} disabled={isChangingPass}>
                <Text style={styles.confirmBtnText}>{isChangingPass ? 'Salvando...' : 'Salvar Senha'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE LOGOUT */}
      {isLogoutModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, currentTheme.modalContent]}>
            <Text style={[styles.modalTitle, currentTheme.modalTitle]}>Confirmar Saída</Text>
            <Text style={[styles.modalText, currentTheme.modalText]}>Tem certeza que deseja sair? Certifique-se de que todas as alterações foram salvas.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.cancelBtn, currentTheme.cancelBtn]} onPress={() => setIsLogoutModalVisible(false)}>
                <Text style={[styles.cancelBtnText, currentTheme.cancelBtnText]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={async () => {
                
                // 1. DESCONECTA O WHATSAPP AUTOMATICAMENTE DO SERVIDOR
                try {
                  await fetch('http://localhost:3001/desconectar', { method: 'POST' });
                } catch (e) {
                  console.log('API do WhatsApp offline ou inacessível no momento do logout:', e.message);
                }

                // 2. ENCERRA A SESSÃO DO SUPABASE
                await supabase.auth.signOut();
                setIsLogoutModalVisible(false);
                
              }}>
                <Text style={styles.confirmBtnText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* MODAL DE ALERTA CUSTOMIZADO COM FADE */}
      {alertConfig.visible && (
        <View style={styles.successAlertOverlay}>
          <Animated.View style={[styles.successAlertBox, currentTheme.successAlertBox, { opacity: alertOpacity, transform: [{ scale: alertScale }] }]}>
            <Text style={styles.successAlertIcon}>{alertConfig.type === 'success' ? '✅' : '⚠️'}</Text>
            <Text style={[styles.successAlertTitle, currentTheme.successAlertTitle]}>{alertConfig.title}</Text>
            <Text style={[styles.successAlertMessage, currentTheme.successAlertMessage]}>{alertConfig.message}</Text>
            <TouchableOpacity 
              style={[styles.successAlertBtn, alertConfig.type === 'error' && { backgroundColor: '#ef4444' }]} 
              onPress={closeCustomAlert}
            >
              <Text style={styles.successAlertBtnText}>{alertConfig.type === 'success' ? 'Continuar' : 'Entendi'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
  },
  
  /* --- ESTILOS DO CABEÇALHO DESKTOP (Preservados) --- */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    zIndex: 50,
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
    borderWidth: 1,
    borderRadius: 6,
    flex: 1,
    height: 32,
    paddingHorizontal: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: MODERN_FONT,
    fontSize: 12,
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
  filterBtn: {
    borderWidth: 1,
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
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  actionBtnSecondaryText: {
    fontFamily: MODERN_FONT,
    fontSize: 11,
    fontWeight: '700',
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
  topHeaderMobileContainer: {
    paddingHorizontal: 10,
    paddingTop: 6,      
    paddingBottom: 8,   
    borderBottomWidth: 1,
    zIndex: 50,
  },
  mobileRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,    
  },
  mobileRowMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 6,    
  },
  mobileRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    width: '100%',
  },
  mobileActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6, 
  },

  /* --- ÁREA DO KANBAN --- */
  boardContainer: {
    flex: 1,
    paddingTop: 16, 
    paddingHorizontal: 16,
  },
  addPhaseButton: {
    width: 300,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderWidth: 2,
    maxHeight: 52,
    marginRight: 24,
  },
  addPhaseText: {
    fontFamily: MODERN_FONT,
    fontWeight: '700',
    fontSize: 14,
  },

  /* --- ESTILOS DO MENU LATERAL (ANIMAÇÃO E RESPONSIVIDADE) --- */
  sidebarOverlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    zIndex: 9999, 
    flexDirection: 'row' 
  },
  sidebarBackdrop: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)' 
  },
  sidebarContent: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    bottom: 0, 
    width: 230, 
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 20,
    justifyContent: 'space-between',
    zIndex: 10000,
  },
  sidebarContentMobile: {
    width: '78%', // Largura ideal e confortável para toque em celulares
    maxWidth: 300,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 24,
  },
  sidebarHeaderContainer: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  sidebarUserName: { 
    fontFamily: MODERN_FONT, 
    fontSize: 18, 
    fontWeight: '800', 
    letterSpacing: -0.3,
  },
  sidebarUserNameMobile: {
    fontSize: 16, // Ajuste proporcional para telas menores sem perder legibilidade
  },
  sidebarUserEmail: {
    fontFamily: MODERN_FONT,
    fontSize: 10,
    marginTop: 2,
  },
  sidebarUserEmailMobile: {
    fontSize: 11,
  },
  sidebarMenuContainer: {
    flex: 1,
    gap: 6,
    flexShrink: 1,
    marginBottom: 8,
  },
  menuItem: { 
    paddingVertical: 10, 
    paddingHorizontal: 12, 
    borderRadius: 8, 
    borderWidth: 1,
    borderColor: 'transparent',
  },
  menuItemMobile: {
    paddingVertical: 13, // Área de toque maior e mais confortável no celular
    paddingHorizontal: 14,
  },
  menuItemActive: { 
    backgroundColor: '#f8fafc', 
    borderColor: '#e2e8f0',
    borderLeftWidth: 3, 
    borderLeftColor: '#2563eb' 
  },
  menuItemActiveDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6'
  },
  menuItemText: { 
    fontFamily: MODERN_FONT, 
    fontSize: 12, 
    fontWeight: '600', 
  },
  menuItemTextMobile: {
    fontSize: 14, // Fonte ampliada no mobile para melhor visualização
  },
  menuItemTextActive: { 
    color: '#2563eb',
    fontWeight: '700',
  },
  adminSectionContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 6,
    flexShrink: 1,
  },
  adminMenuItem: {
    borderWidth: 1,
    paddingVertical: 9,
  },
  adminMenuItemText: {
    fontFamily: MODERN_FONT,
    fontSize: 12,
    fontWeight: '700',
  },
  adminMenuItemTextMobile: {
    fontSize: 14,
  },
  sellersBox: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    flexShrink: 1,
  },
  sellersHeaderToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  sellersHeaderToggleMobile: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  sellersHeaderTitle: {
    fontFamily: MODERN_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sellersHeaderTitleMobile: {
    fontSize: 13,
  },
  sellersHeaderArrow: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  sellersDropdownList: {
    maxHeight: 150,
    minHeight: 40,
    borderTopWidth: 1,
    paddingVertical: 2,
  },
  sellerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 6,
  },
  sellerItemRowMobile: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sellerIndicatorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#cbd5e1',
  },
  sellerIndicatorDotActive: {
    backgroundColor: '#2563eb',
  },
  sellerItemText: {
    fontFamily: MODERN_FONT,
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  sellerItemTextMobile: {
    fontSize: 13,
  },
  sellerItemTextActive: {
    fontWeight: '700',
  },
  sidebarFooterContainer: {
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  sidebarFooterButtonChangePass: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  sidebarFooterButtonMobile: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  sidebarFooterButtonChangePassText: {
    fontFamily: MODERN_FONT,
    fontSize: 12,
    fontWeight: '600',
  },
  sidebarFooterButtonTextMobile: {
    fontSize: 13,
  },
  sidebarFooterButtonLogout: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  sidebarFooterButtonLogoutText: {
    fontFamily: MODERN_FONT,
    fontSize: 12,
    fontWeight: '700',
  },

  /* --- ESTILOS DOS MODAIS CUSTOMIZADOS --- */
  modalOverlay: { 
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 10000 
  },
  modalContent: { 
    padding: 24, borderRadius: 16, width: '90%', maxWidth: 320, 
    alignItems: 'center' 
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  modalText: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  passInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontFamily: MODERN_FONT,
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtnText: { fontWeight: 'bold' },
  confirmBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center' },
  confirmBtnText: { fontWeight: 'bold', color: '#ffffff' },

  successAlertOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  successAlertBox: { padding: 24, borderRadius: 16, alignItems: 'center', width: 320 },
  successAlertIcon: { fontSize: 48, marginBottom: 12 },
  successAlertTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  successAlertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  successAlertBtn: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 8, width: '100%', alignItems: 'center' },
  successAlertBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },

  bulkDropdownMenu: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
    zIndex: 1000,
  },
  bulkDropdownTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  bulkDropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  bulkDropdownItemText: {
    fontSize: 12,
    fontWeight: '600',
  },
  floatingBulkBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    zIndex: 999,
    ...Platform.select({ web: { boxShadow: '0px 6px 16px rgba(37, 99, 235, 0.4)' } })
  },
  floatingBulkBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    fontFamily: MODERN_FONT,
  },
  themeToggleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeToggleIcon: {
    fontSize: 15,
  },
  blockTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center'
  },
  blockText: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 400
  }
});

/* Estilos para o Modo Claro */
const lightStyles = StyleSheet.create({
  container: { backgroundColor: '#F9FAFB' },
  topHeader: { backgroundColor: '#ffffff', borderBottomColor: '#e2e8f0', ...Platform.select({ web: { boxShadow: '0px 1px 3px rgba(0,0,0,0.05)' } }) },
  menuIcon: { color: '#334155' },
  themeToggleButton: { backgroundColor: '#f1f5f9' },
  searchContainer: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  searchInput: { color: '#0f172a' },
  filterBtn: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  filterBtnText: { color: '#475569' },
  actionBtnSecondary: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  actionBtnSecondaryText: { color: '#475569' },
  addPhaseButton: { backgroundColor: 'rgba(226, 232, 240, 0.5)', borderColor: '#CBD5E1' },
  addPhaseText: { color: '#64748B' },
  sidebarContent: { backgroundColor: '#ffffff', ...Platform.select({ web: { boxShadow: '6px 0px 25px rgba(0,0,0,0.08)' } }) },
  sidebarHeaderContainer: { borderBottomColor: '#f1f5f9' },
  sidebarUserName: { color: '#0f172a' },
  sidebarUserEmail: { color: '#64748b' },
  menuItem: { backgroundColor: '#ffffff' },
  menuItemText: { color: '#475569' },
  adminSectionContainer: { borderTopColor: '#f1f5f9' },
  adminMenuItem: { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' },
  adminMenuItemText: { color: '#1e40af' },
  sellersBox: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  sellersHeaderTitle: { color: '#64748b' },
  sellersHeaderArrow: { color: '#64748b' },
  sellersDropdownList: { backgroundColor: '#ffffff', borderTopColor: '#e2e8f0' },
  sellerItemRowActive: { backgroundColor: '#f1f5f9' },
  sellerItemText: { color: '#475569' },
  sellerItemTextActive: { color: '#1e293b' },
  sidebarFooterContainer: { borderTopColor: '#f1f5f9' },
  sidebarFooterButtonChangePass: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  sidebarFooterButtonChangePassText: { color: '#334155' },
  sidebarFooterButtonLogout: { backgroundColor: '#fff1f2', borderColor: '#ffe4e6' },
  sidebarFooterButtonLogoutText: { color: '#e11d48' },
  bulkDropdownMenu: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  bulkDropdownTitle: { color: '#64748b' },
  bulkDropdownItemText: { color: '#334155' },
  modalContent: { backgroundColor: '#fff', ...Platform.select({ web: { boxShadow: '0px 10px 25px rgba(0,0,0,0.1)' } }) },
  modalTitle: { color: '#1e293b' },
  modalText: { color: '#64748b' },
  passInput: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', color: '#0f172a' },
  cancelBtn: { backgroundColor: '#f1f5f9' },
  cancelBtnText: { color: '#475569' },
  successAlertBox: { backgroundColor: '#ffffff', ...Platform.select({ web: { boxShadow: '0px 10px 25px rgba(0,0,0,0.2)' } }) },
  successAlertTitle: { color: '#1e293b' },
  successAlertMessage: { color: '#475569' },
  blockTitle: { color: '#1e293b' },
  blockText: { color: '#64748b' }
});

/* Estilos para o Modo Escuro */
const darkStyles = StyleSheet.create({
  container: { backgroundColor: '#0f172a' },
  topHeader: { backgroundColor: '#1e293b', borderBottomColor: '#334155', ...Platform.select({ web: { boxShadow: '0px 1px 3px rgba(0,0,0,0.2)' } }) },
  menuIcon: { color: '#f8fafc' },
  themeToggleButton: { backgroundColor: '#334155' },
  searchContainer: { backgroundColor: '#0f172a', borderColor: '#334155' },
  searchInput: { color: '#f8fafc' },
  filterBtn: { backgroundColor: '#1e293b', borderColor: '#334155' },
  filterBtnText: { color: '#94a3b8' },
  actionBtnSecondary: { backgroundColor: '#1e293b', borderColor: '#334155' },
  actionBtnSecondaryText: { color: '#cbd5e1' },
  addPhaseButton: { backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: '#334155' },
  addPhaseText: { color: '#94a3b8' },
  sidebarContent: { backgroundColor: '#1e293b', ...Platform.select({ web: { boxShadow: '6px 0px 25px rgba(0,0,0,0.4)' } }) },
  sidebarHeaderContainer: { borderBottomColor: '#334155' },
  sidebarUserName: { color: '#f8fafc' },
  sidebarUserEmail: { color: '#94a3b8' },
  menuItem: { backgroundColor: '#1e293b' },
  menuItemText: { color: '#cbd5e1' },
  adminSectionContainer: { borderTopColor: '#334155' },
  adminMenuItem: { backgroundColor: '#0f172a', borderColor: '#334155' },
  adminMenuItemText: { color: '#60a5fa' },
  sellersBox: { backgroundColor: '#0f172a', borderColor: '#334155' },
  sellersHeaderTitle: { color: '#94a3b8' },
  sellersHeaderArrow: { color: '#94a3b8' },
  sellersDropdownList: { backgroundColor: '#1e293b', borderTopColor: '#334155' },
  sellerItemRowActive: { backgroundColor: '#334155' },
  sellerItemText: { color: '#cbd5e1' },
  sellerItemTextActive: { color: '#f8fafc' },
  sidebarFooterContainer: { borderTopColor: '#334155' },
  sidebarFooterButtonChangePass: { backgroundColor: '#0f172a', borderColor: '#334155' },
  sidebarFooterButtonChangePassText: { color: '#cbd5e1' },
  sidebarFooterButtonLogout: { backgroundColor: '#451a03', borderColor: '#78350f' },
  sidebarFooterButtonLogoutText: { color: '#f87171' },
  bulkDropdownMenu: { backgroundColor: '#1e293b', borderColor: '#334155' },
  bulkDropdownTitle: { color: '#94a3b8' },
  bulkDropdownItemText: { color: '#cbd5e1' },
  modalContent: { backgroundColor: '#1e293b', ...Platform.select({ web: { boxShadow: '0px 10px 25px rgba(0,0,0,0.4)' } }) },
  modalTitle: { color: '#f8fafc' },
  modalText: { color: '#94a3b8' },
  passInput: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' },
  cancelBtn: { backgroundColor: '#334155' },
  cancelBtnText: { color: '#cbd5e1' },
  successAlertBox: { backgroundColor: '#1e293b', ...Platform.select({ web: { boxShadow: '0px 10px 25px rgba(0,0,0,0.4)' } }) },
  successAlertTitle: { color: '#f8fafc' },
  successAlertMessage: { color: '#94a3b8' },
  blockTitle: { color: '#f8fafc' },
  blockText: { color: '#94a3b8' }
});