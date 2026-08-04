import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Pressable, Linking } from 'react-native';

export default function ClientCard({ client, phaseId, onDelete, onOpen, onAddComment }) {
  const cardRef = useRef(null);

  useEffect(() => {
    if (Platform.OS === 'web' && cardRef.current) {
      const node = cardRef.current;
      const handleDragStart = (e) => {
        e.stopPropagation();
        e.dataTransfer.setData('dragType', 'client');
        e.dataTransfer.setData('clientId', client.id);
        e.dataTransfer.setData('sourcePhaseId', phaseId);
      };
      
      const handleClick = (e) => {
        const text = e.target.innerText || '';
        // Evita abrir o modal se o usuário clicar em botões de ação ou no X
        if (text === '✕' || text.includes('WA') || text.includes('Ligar') || text.includes(client.phone)) return;
        if (onOpen) onOpen(client, phaseId);
      };

      node.setAttribute('draggable', 'true');
      node.addEventListener('dragstart', handleDragStart);
      node.addEventListener('click', handleClick);
      return () => {
        node.removeEventListener('dragstart', handleDragStart);
        node.removeEventListener('click', handleClick);
      };
    }
  }, [client, phaseId, onOpen]);

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

  // Ação: Ligar (Discador)
  const handlePhoneCall = (e) => {
    if (Platform.OS === 'web' && e && e.stopPropagation) e.stopPropagation();
    const cleanPhone = client.phone?.replace(/\D/g, '');
    if (cleanPhone) {
      if (onAddComment) onAddComment(client.id, phaseId, "📞 Sistema: Clicou no botão de ligar no cliente.");
      Linking.openURL(`tel:+${cleanPhone}`);
    }
  };

  // Ação: WhatsApp
  const handleWhatsAppClick = (e) => {
    if (Platform.OS === 'web' && e && e.stopPropagation) e.stopPropagation();
    const cleanPhone = client.phone?.replace(/\D/g, '');
    if (cleanPhone) {
      if (onAddComment) onAddComment(client.id, phaseId, "💬 Sistema: Clicou no botão de falar no WhatsApp.");
      Linking.openURL(`https://wa.me/${cleanPhone}`);
    }
  };

  const getDaysInactive = () => {
    const lastMoveDate = client.updatedAt || client.createdAt;
    if (!lastMoveDate) return 0;
    const diffTime = Math.abs(new Date() - new Date(lastMoveDate));
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysInactive = getDaysInactive();
  const commentsCount = client.comments ? client.comments.length : 0;

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
    <View ref={cardRef} style={styles.card}>
      <View style={styles.headerContainer}>
        <View style={styles.headerTextContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{client.name}</Text>
            
            {commentsCount > 0 && (
              <View style={styles.commentBadge}>
                <Text style={styles.commentBadgeText}>
                  {commentsCount} {commentsCount === 1 ? 'comentário' : 'comentários'}
                </Text>
              </View>
            )}

            {daysInactive >= 7 && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveText}>{daysInactive}d</Text>
              </View>
            )}
          </View>

          {client.createdAt && (
            <Text style={styles.dateText}>{formatDateTime(client.createdAt)}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={(e) => { e.stopPropagation(); onDelete(client.id, phaseId); }}>
          <Text style={styles.deleteIcon}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <Pressable style={styles.clickableArea} onPress={() => { if (Platform.OS !== 'web' && onOpen) onOpen(client, phaseId); }}>
        
        {/* NOVA ÁREA DE TELEFONE E BOTÕES */}
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
            <Text key={tag.id} style={[styles.tag, { backgroundColor: tag.bg, color: tag.color }]}>
              {tag.text}
            </Text>
          ))}
        </View>

      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', padding: 10, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#3b82f6',
    ...Platform.select({
      web: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)', cursor: 'grab', userSelect: 'none' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }
    })
  },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  headerTextContainer: { flex: 1, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  name: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', flexShrink: 1 },
  
  commentBadge: { backgroundColor: '#e0e7ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  commentBadgeText: { color: '#4f46e5', fontSize: 9, fontWeight: '700' },
  inactiveBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  inactiveText: { color: '#dc2626', fontSize: 10, fontWeight: 'bold' },
  
  dateText: { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  deleteButton: { paddingLeft: 8, paddingBottom: 4 },
  deleteIcon: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold' },
  clickableArea: { paddingTop: 0, paddingBottom: 0 },
  
  // Estilos da Nova Linha de Telefone
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
});