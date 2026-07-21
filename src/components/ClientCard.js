import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Pressable, Linking } from 'react-native';

export default function ClientCard({ client, phaseId, onDelete, onOpen }) {
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
        if (text === '✕' || text.includes(client.phone)) return;
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
    
    if (text.includes('auto') || text.includes('carro')) return 'Automóvel';
    if (text.includes('imóvel') || text.includes('casa') || text.includes('apartamento')) return 'Imóvel';
    if (text.includes('moto')) return 'Moto';
    if (text.includes('caminhão') || text.includes('pesado')) return 'Veículos Pesados';
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

  const openWhatsApp = (e) => {
    if (Platform.OS === 'web' && e && e.stopPropagation) e.stopPropagation();
    const cleanPhone = client.phone?.replace(/\D/g, '');
    if (cleanPhone) {
      Linking.openURL(`https://wa.me/${cleanPhone}`);
    }
  };

  const buildTags = () => {
    const tags = [];
    const cleanCategory = formatCategory(client.category);
    
    if (cleanCategory) {
      tags.push({ id: 'cat', text: cleanCategory, bg: '#f3e8ff', color: '#7e22ce' });
    }
    if (client.leadTemp) {
      const style = getTempStyle(client.leadTemp);
      tags.push({ id: 'temp', text: `🔥 ${client.leadTemp}`, bg: style.bg, color: style.color });
    }
    if (client.bidAmount && client.bidAmount.trim() !== '' && client.bidAmount.trim() !== 'não') {
      tags.push({ id: 'bid', text: '💰 Com Lance', bg: '#dcfce7', color: '#16a34a' });
    }
    if (client.winProbability) {
      tags.push({ id: 'prob', text: `🎯 ${client.winProbability}%`, bg: '#ecfdf5', color: '#059669' });
    }
    if (client.platform) {
      tags.push({ id: 'plat', text: `🌐 ${client.platform}`, bg: '#e0e7ff', color: '#4f46e5' });
    }

    return tags.slice(0, 4);
  };

  const tagsToRender = buildTags();

  return (
    <View ref={cardRef} style={styles.card}>
      <View style={styles.headerContainer}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.name} numberOfLines={1}>{client.name}</Text>
          {client.createdAt && (
            <Text style={styles.dateText}>{formatDateTime(client.createdAt)}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={(e) => { e.stopPropagation(); onDelete(client.id, phaseId); }}>
          <Text style={styles.deleteIcon}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <Pressable style={styles.clickableArea} onPress={() => { if (Platform.OS !== 'web' && onOpen) onOpen(client, phaseId); }}>
        
        <TouchableOpacity onPress={openWhatsApp} style={styles.whatsappButton}>
          <Text style={styles.phoneLink}>{client.phone || 'Sem telefone'}</Text>
        </TouchableOpacity>

        <Text style={styles.info} numberOfLines={2}>{client.initialInfo || 'Clique para ver detalhes...'}</Text>
        
        <View style={styles.tagsContainer}>
          {tagsToRender.map(tag => (
            <Text key={tag.id} style={[styles.tag, { backgroundColor: tag.bg, color: tag.color }]} numberOfLines={1}>
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
    backgroundColor: '#FFFFFF', 
    padding: 10, // Reduzido de 16 para 10
    borderRadius: 8, 
    marginBottom: 8, // Reduzido de 12 para 8
    borderLeftWidth: 4, 
    borderLeftColor: '#3b82f6',
    ...Platform.select({
      web: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)', cursor: 'grab', userSelect: 'none' }, // Sombra mais sutil
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }
    })
  },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }, // Reduzido de 8 para 2
  headerTextContainer: { flex: 1, marginRight: 8 },
  name: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' }, // Fonte ajustada de 16 para 14
  dateText: { fontSize: 9, color: '#94a3b8', marginTop: 0 }, // Fonte ajustada de 10 para 9 e sem margem
  deleteButton: { paddingLeft: 8, paddingBottom: 4 },
  deleteIcon: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold' },
  clickableArea: { paddingTop: 0, paddingBottom: 0 }, // Margens internas zeradas
  
  whatsappButton: { marginBottom: 4, alignSelf: 'flex-start' }, // Reduzido de 8 para 4
  phoneLink: { fontSize: 13, color: '#2563eb', fontWeight: '600' }, // Fonte ajustada de 14 para 13
  
  info: { fontSize: 12, color: '#475569', marginBottom: 6, lineHeight: 16 }, // Fonte menor (12) e entrelinha (16) para achatar o texto
  
  tagsContainer: { flexDirection: 'row', flexWrap: 'nowrap', gap: 4, overflow: 'hidden' }, // Espaço entre as tags reduzido
  tag: { 
    paddingHorizontal: 6, // Reduzido de 8 para 6
    paddingVertical: 2, // Reduzido de 4 para 2
    borderRadius: 4, 
    fontSize: 10, 
    fontWeight: '600', 
    overflow: 'hidden',
    flexShrink: 1 
  },
});