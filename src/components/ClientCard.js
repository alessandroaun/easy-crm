import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Pressable, Linking, Animated, Easing, Modal } from 'react-native';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

// ATENÇÃO AQUI: onDropClient adicionado nas props!
export default function ClientCard({ client, phaseId, onDelete, onOpen, onAddComment, onDropClient }) {
  const cardRef = useRef(null);
  const [pulseColor, setPulseColor] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Estados e Refs do Modal de Exclusão
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteScale = useRef(new Animated.Value(0.8)).current;
  const deleteOpacity = useRef(new Animated.Value(0)).current;

  // Motor em tempo real: Cor e Pulsação
  useEffect(() => {
    const checkAppointmentStatus = () => {
      if (!client.appointments || client.appointments.length === 0) {
        setPulseColor(null);
        return;
      }

      const now = new Date();
      const activeAppts = client.appointments
        .filter(a => !a.notified && new Date(a.dateTime) > now)
        .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

      if (activeAppts.length === 0) {
        setPulseColor(null);
        return;
      }

      const nextApptTime = new Date(activeAppts[0].dateTime).getTime();
      const timeLeft = nextApptTime - now.getTime();
      const hoursLeft = timeLeft / (1000 * 60 * 60);

      if (hoursLeft > 24) setPulseColor('#22c55e');      // Verde
      else if (hoursLeft > 4) setPulseColor('#eab308'); // Amarelo
      else setPulseColor('#ef4444');                    // Vermelho
    };

    checkAppointmentStatus();
    const interval = setInterval(checkAppointmentStatus, 30000);
    return () => clearInterval(interval);
  }, [client.appointments]);

  // Efeito visual do pulsar
  useEffect(() => {
    if (pulseColor) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' })
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [pulseColor, pulseAnim]);

  // =========================================================================
  // MOTOR TÁTIL SUPREMO (FANTASMA + AUTO-SCROLL HORIZONTAL + TRAVA CLIQUE)
  // =========================================================================
  useEffect(() => {
    if (Platform.OS === 'web' && cardRef.current) {
      const node = cardRef.current;
      const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

      // 1. DRAG PARA COMPUTADOR
      if (!isTouchDevice) node.setAttribute('draggable', 'true');

      const handleDragStart = (e) => {
        if (isTouchDevice) return e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.setData('dragType', 'client');
        e.dataTransfer.setData('clientId', client.id);
        e.dataTransfer.setData('sourcePhaseId', phaseId);
      };

      // VARIÁVEIS DO MOTOR
      let pressTimer = null;
      let isDragging = false;
      let ghost = null;
      let initialX = 0, initialY = 0;
      let offsetX = 0, offsetY = 0;
      let touchStartTime = 0;
      
      // VARIÁVEIS DO AUTO-SCROLL DA TELA
      let scrollInterval = null;
      let currentTouchX = 0;
      let scrollContainer = null;

      const cleanupGhost = () => {
        if (ghost && document.body.contains(ghost)) document.body.removeChild(ghost);
        ghost = null;
        isDragging = false;
        node.style.opacity = '1';
        document.body.style.overflow = '';
        
        // Desliga o motor de rolagem
        if (scrollInterval) {
          clearInterval(scrollInterval);
          scrollInterval = null;
        }
      };

      const handleClick = (e) => {
        const pressDuration = Date.now() - touchStartTime;

        if (isDragging || (isTouchDevice && touchStartTime > 0 && pressDuration > 300)) {
          e.stopPropagation();
          e.preventDefault();
          touchStartTime = 0;
          return;
        }

        const text = e.target.innerText || '';
        if (text === '✕' || text.includes('WA') || text.includes('Ligar') || text.includes(client.phone)) return;
        if (onOpen) onOpen(client, phaseId);
      };

      const handleTouchStart = (e) => {
        if (!isTouchDevice || e.touches.length > 1) return;
        
        const text = e.target.innerText || '';
        if (text === '✕' || text.includes('WA') || text.includes('Ligar')) return;

        const touch = e.touches[0];
        initialX = touch.clientX;
        initialY = touch.clientY;
        currentTouchX = touch.clientX;
        touchStartTime = Date.now();

        pressTimer = setTimeout(() => {
          isDragging = true;
          if (navigator.vibrate) navigator.vibrate(40);
          
          document.body.style.overflow = 'hidden';

          const rect = node.getBoundingClientRect();
          offsetX = touch.clientX - rect.left;
          offsetY = touch.clientY - rect.top;

          // Cria o Fantasma
          ghost = node.cloneNode(true);
          ghost.style.position = 'fixed';
          ghost.style.zIndex = '999999';
          ghost.style.opacity = '0.95';
          ghost.style.margin = '0';
          ghost.style.boxShadow = '0px 15px 30px rgba(0,0,0,0.3)';
          ghost.style.transform = 'scale(1.03)'; 
          ghost.style.setProperty('pointer-events', 'none', 'important');
          
          ghost.style.left = `${touch.clientX - offsetX}px`;
          ghost.style.top = `${touch.clientY - offsetY}px`;
          ghost.style.width = `${rect.width}px`;
          ghost.style.height = `${rect.height}px`;

          document.body.appendChild(ghost);
          node.style.opacity = '0.4';

          // ==============================================================
          // INICIA O RADAR DE AUTO-SCROLL AO CRIAR O FANTASMA
          // ==============================================================
          
          // 1. Acha quem rola horizontalmente (O ScrollView do Dashboard)
          scrollContainer = node.parentElement;
          while (scrollContainer && scrollContainer !== document.body) {
            if (scrollContainer.scrollWidth > scrollContainer.clientWidth) break;
            scrollContainer = scrollContainer.parentElement;
          }
          if (!scrollContainer) scrollContainer = document.scrollingElement || document.documentElement;

          // 2. Liga o radar 60 vezes por segundo
          scrollInterval = setInterval(() => {
            if (!isDragging) return;
            
            const edge = 80; // Zona de borda em pixels
            const speed = 12; // Velocidade que a tela anda

            if (currentTouchX < edge) {
              scrollContainer.scrollLeft -= speed; // Rola pra esquerda
            } else if (currentTouchX > window.innerWidth - edge) {
              scrollContainer.scrollLeft += speed; // Rola pra direita
            }
          }, 16);

        }, 350); 
      };

      const handleTouchMove = (e) => {
        const touch = e.touches[0];
        currentTouchX = touch.clientX; // Atualiza a mira do radar em tempo real

        if (!isDragging) {
          if (Math.abs(touch.clientX - initialX) > 10 || Math.abs(touch.clientY - initialY) > 10) {
            clearTimeout(pressTimer);
          }
          return;
        }

        if (e.cancelable) e.preventDefault(); 
        
        if (ghost) {
          ghost.style.left = `${touch.clientX - offsetX}px`;
          ghost.style.top = `${touch.clientY - offsetY}px`;
        }
      };

      const handleTouchEnd = (e) => {
        clearTimeout(pressTimer);
        
        if (!isDragging) {
          cleanupGhost();
          return;
        }
        
        const touch = e.changedTouches[0];
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);

        cleanupGhost();

        if (targetElement) {
          const targetColumn = targetElement.closest('[data-phaseid]');
          const targetCard = targetElement.closest('[data-clientid]');

          if (targetColumn && onDropClient) {
            const targetPhaseId = targetColumn.getAttribute('data-phaseid');
            const targetClientId = targetCard ? targetCard.getAttribute('data-clientid') : null;
            onDropClient(client.id, phaseId, targetPhaseId, targetClientId);
          }
        }
      };

      const handleTouchCancel = () => {
        clearTimeout(pressTimer);
        cleanupGhost();
      };

      node.addEventListener('dragstart', handleDragStart);
      node.addEventListener('click', handleClick);
      node.addEventListener('touchstart', handleTouchStart, { passive: true });
      node.addEventListener('touchmove', handleTouchMove, { passive: false });
      node.addEventListener('touchend', handleTouchEnd);
      node.addEventListener('touchcancel', handleTouchCancel);
      
      return () => {
        clearTimeout(pressTimer);
        cleanupGhost();
        node.removeEventListener('dragstart', handleDragStart);
        node.removeEventListener('click', handleClick);
        node.removeEventListener('touchstart', handleTouchStart);
        node.removeEventListener('touchmove', handleTouchMove);
        node.removeEventListener('touchend', handleTouchEnd);
        node.removeEventListener('touchcancel', handleTouchCancel);
      };
    }
  }, [client, phaseId, onOpen, onDropClient]);


  // Funções do Modal Animado
  const openDeleteModal = (e) => {
    if (Platform.OS === 'web' && e && e.stopPropagation) e.stopPropagation();
    setIsDeleting(true);
    deleteScale.setValue(0.8);
    deleteOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(deleteScale, { toValue: 1, friction: 6, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(deleteOpacity, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' })
    ]).start();
  };

  const closeDeleteModal = (callback) => {
    Animated.parallel([
      Animated.timing(deleteScale, { toValue: 0.8, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(deleteOpacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' })
    ]).start(() => {
      setIsDeleting(false);
      if (typeof callback === 'function') callback();
    });
  };

  const formatCategory = (rawCategory) => {
    if (!rawCategory) return null;
    const text = rawCategory.toLowerCase();
    if (text.includes('auto') || text.includes('carro')) return 'Auto';
    if (text.includes('imóvel') || text.includes('casa') || text.includes('apartamento')) return 'Imóvel';
    if (text.includes('moto')) return 'Moto';
    if (text.includes('caminhão') || text.includes('pesado')) return 'Pesados';
    if (text.includes('investimento')) return 'Investimento';
    if (text.includes('serviço')) return 'Serviços';
    return rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1).replace(/_/g, ' ');
  };

  const getTempStyle = (temp) => {
    const t = temp?.toLowerCase() || '';
    if (t.includes('quente')) return { bg: '#fee2e2', color: '#dc2626' };
    if (t.includes('morno')) return { bg: '#fef3c7', color: '#d97706' };
    if (t.includes('frio')) return { bg: '#e0f2fe', color: '#0284c7' };
    return { bg: '#f1f5f9', color: '#475569' };
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handlePhoneCall = (e) => {
    if (Platform.OS === 'web' && e && e.stopPropagation) e.stopPropagation();
    const cleanPhone = client.phone?.replace(/\D/g, '');
    if (cleanPhone) {
      if (onAddComment) onAddComment(client.id, phaseId, "📞 Sistema: Clicou no botão de ligar no cliente.");
      Linking.openURL(`tel:+${cleanPhone}`);
    }
  };

  const handleWhatsAppClick = (e) => {
    if (Platform.OS === 'web' && e && e.stopPropagation) e.stopPropagation();
    const cleanPhone = client.phone?.replace(/\D/g, '');
    if (cleanPhone) {
      if (onAddComment) onAddComment(client.id, phaseId, "💬 Sistema: Clicou no botão de falar no WhatsApp.");
      Linking.openURL(`https://wa.me/${cleanPhone}`);
    }
  };

  const daysInactive = () => {
    const lastMoveDate = client.updatedAt || client.createdAt;
    if (!lastMoveDate) return 0;
    return Math.floor(Math.abs(new Date() - new Date(lastMoveDate)) / (1000 * 60 * 60 * 24));
  };
  
  const commentsCount = client.comments ? client.comments.length : 0;
  const completedApptsCount = client.appointments ? client.appointments.filter(a => a.notified).length : 0;

  const buildTags = () => {
    const tags = [];
    const cleanCategory = formatCategory(client.category);
    if (cleanCategory) tags.push({ id: 'cat', text: cleanCategory, bg: '#f3e8ff', color: '#7e22ce' });
    if (client.leadTemp) {
      const style = getTempStyle(client.leadTemp);
      tags.push({ id: 'temp', text: client.leadTemp, bg: style.bg, color: style.color });
    }
    if (client.bidAmount && client.bidAmount.trim() !== '' && client.bidAmount.trim().toLowerCase() !== 'não') {
      tags.push({ id: 'bid', text: 'Com Lance', bg: '#dcfce7', color: '#16a34a' });
    }
    if (client.winProbability) {
      tags.push({ id: 'prob', text: `${client.winProbability}%`, bg: '#ecfdf5', color: '#059669' });
    }
    if (client.platform) {
      tags.push({ id: 'plat', text: client.platform, bg: '#e0e7ff', color: '#4f46e5' });
    }
    return tags.slice(0, 4);
  };

  const tagsToRender = buildTags();

  return (
    <>
      <View ref={cardRef} dataSet={{ clientid: client.id }} style={[styles.card, pulseColor && { borderColor: pulseColor, borderWidth: 2 }]}>
        <View style={styles.headerContainer}>
          <View style={styles.headerTextContainer}>
            <View style={styles.nameRow}>
              
              {/* RELÓGINHO COM ANIMAÇÃO */}
              {pulseColor && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Text style={styles.pulsingClock}>⏰</Text>
                </Animated.View>
              )}

              <Text style={styles.name} numberOfLines={1}>{client.name}</Text>
              
              {commentsCount > 0 && (
                <View style={styles.commentBadge}>
                  <Text style={styles.commentBadgeText}>{commentsCount} {commentsCount === 1 ? 'comentário' : 'comentários'}</Text>
                </View>
              )}

              {/* TAG DE HISTÓRICO DE AGENDAMENTOS */}
              {completedApptsCount > 0 && (
                <View style={styles.apptBadge}>
                  <Text style={styles.apptBadgeText}>{completedApptsCount}A</Text>
                </View>
              )}

              {daysInactive() >= 7 && (
                <View style={styles.inactiveBadge}>
                  <Text style={styles.inactiveText}>{daysInactive()}d</Text>
                </View>
              )}
            </View>

            {client.createdAt && (
              <Text style={styles.dateText}>{formatDateTime(client.createdAt)}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.deleteButton} onPress={openDeleteModal}>
            <Text style={styles.deleteIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <Pressable style={styles.clickableArea} onPress={() => { if (Platform.OS !== 'web' && onOpen) onOpen(client, phaseId); }}>
          
          <View style={styles.phoneRow}>
            <Text style={styles.phoneText}>{client.phone || 'Sem telefone'}</Text>
            {client.phone && (
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity style={styles.btnActionWA} onPress={handleWhatsAppClick}>
                  <Text style={styles.btnActionTextWA}>WA</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnActionCall} onPress={handlePhoneCall}>
                  <Text style={styles.btnActionTextCall}>Ligar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.info} numberOfLines={2}>{client.initialInfo || 'Clique para ver detalhes...'}</Text>
          
          <View style={styles.tagsContainer}>
            {tagsToRender.map(tag => (
              <Text key={tag.id} style={[styles.tag, { backgroundColor: tag.bg, color: tag.color }]}>{tag.text}</Text>
            ))}
          </View>

        </Pressable>
      </View>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {isDeleting && (
        <Modal transparent={true} visible={isDeleting} onRequestClose={() => closeDeleteModal()}>
          <View style={styles.modalOverlay}>
            <Animated.View style={[styles.alertBox, { opacity: deleteOpacity, transform: [{ scale: deleteScale }] }]}>
              <Text style={styles.alertIcon}>⚠️</Text>
              <Text style={styles.alertTitle}>Excluir Card?</Text>
              <Text style={styles.alertMessage}>Tem certeza que deseja enviar "{client.name}" para a lixeira? Você poderá restaurá-lo depois se precisar.</Text>
              
              <View style={styles.alertButtonRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => closeDeleteModal()}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={() => closeDeleteModal(() => onDelete(client.id, phaseId))}>
                  <Text style={styles.confirmBtnText}>Sim, excluir</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { 
    backgroundColor: '#FFFFFF', 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 8, 
    borderLeftWidth: 4, 
    borderLeftColor: '#3b82f6', 
    ...Platform.select({ 
      web: { 
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)', 
        cursor: 'grab', 
        userSelect: 'none', 
        WebkitUserSelect: 'none', 
        WebkitTouchCallout: 'none' 
      }, 
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 } 
    }) 
  },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  headerTextContainer: { flex: 1, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  name: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', flexShrink: 1 },
  pulsingClock: { fontSize: 12 },
  commentBadge: { backgroundColor: '#e0e7ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  commentBadgeText: { color: '#4f46e5', fontSize: 9, fontWeight: '700' },
  apptBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  apptBadgeText: { color: '#d97706', fontSize: 9, fontWeight: 'bold' },
  inactiveBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  inactiveText: { color: '#dc2626', fontSize: 10, fontWeight: 'bold' },
  dateText: { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  deleteButton: { paddingLeft: 8, paddingBottom: 4 },
  deleteIcon: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold' },
  clickableArea: { paddingTop: 0, paddingBottom: 0 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  phoneText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  actionButtonsContainer: { flexDirection: 'row', gap: 4 },
  btnActionWA: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  btnActionTextWA: { color: '#16a34a', fontSize: 10, fontWeight: 'bold' },
  btnActionCall: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  btnActionTextCall: { color: '#475569', fontSize: 10, fontWeight: 'bold' },
  info: { fontSize: 12, color: '#475569', marginBottom: 6, lineHeight: 16 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 }, 
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 10, fontWeight: '600' },
  
  // Estilos do Modal de Exclusão
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  alertBox: { backgroundColor: '#ffffff', padding: 24, borderRadius: 16, alignItems: 'center', width: 320, ...Platform.select({ web: { boxShadow: '0px 10px 25px rgba(0,0,0,0.2)' } }) },
  alertIcon: { fontSize: 48, marginBottom: 12 },
  alertTitle: { fontFamily: MODERN_FONT, fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  alertMessage: { fontFamily: MODERN_FONT, fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  alertButtonRow: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtnText: { fontFamily: MODERN_FONT, color: '#475569', fontWeight: '700', fontSize: 14 },
  confirmBtn: { flex: 1, backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  confirmBtnText: { fontFamily: MODERN_FONT, color: '#ffffff', fontWeight: '700', fontSize: 14 }
});