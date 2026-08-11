import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';

export default function ReportModal({ visible, onClose, report, boardData }) {
  // Nota: Como removemos o botão, 'isPrinting' e 'handleExport' não são mais necessários
  // mas deixaremos a estrutura limpa para o funcionamento do modal.

  if (!report) return null;

  let mensagemLimpa = report.mensagem || '';
  let dadosExtra = { fase: 'Todas as Fases', tag: 'Todas as Tags / Origens', leads: [] };

  if (mensagemLimpa.includes('[DADOS_EXTRA:')) {
    try {
      const startIndex = mensagemLimpa.indexOf('[DADOS_EXTRA:');
      const jsonString = mensagemLimpa.substring(startIndex + 13, mensagemLimpa.lastIndexOf(']'));
      const parsedData = JSON.parse(jsonString);
      if (parsedData) {
        dadosExtra.fase = parsedData.fase || dadosExtra.fase;
        dadosExtra.tag = parsedData.tag || dadosExtra.tag;
        dadosExtra.leads = parsedData.leads || [];
      }
      mensagemLimpa = mensagemLimpa.substring(0, startIndex).trim();
    } catch (e) {
      console.error("Erro ao decodificar DADOS_EXTRA:", e);
    }
  }

  let faseExibida = dadosExtra.fase;
  if (faseExibida === 'all' || !faseExibida) {
    faseExibida = 'Todas as Fases';
  } else if (boardData?.phases) {
    const encontrada = boardData.phases.find(p => p.id === faseExibida);
    if (encontrada) faseExibida = encontrada.title;
  }

  let tagExibida = dadosExtra.tag;
  if (!tagExibida || tagExibida === 'all') {
    tagExibida = 'Todas as Tags / Origens';
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Relatório do Disparo</Text>
              <Text style={styles.subtitle}>Detalhamento da campanha de disparo em massa</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={true}>
            
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { borderLeftColor: '#2563eb' }]}>
                <Text style={styles.metricLabel}>Total Alvos</Text>
                <Text style={styles.metricValue}>{report.total_alvos || 0}</Text>
              </View>
              <View style={[styles.metricCard, { borderLeftColor: '#16a34a' }]}>
                <Text style={styles.metricLabel}>Sucesso</Text>
                <Text style={[styles.metricValue, { color: '#16a34a' }]}>{report.sucesso || 0}</Text>
              </View>
              <View style={[styles.metricCard, { borderLeftColor: '#dc2626' }]}>
                <Text style={styles.metricLabel}>Falhas</Text>
                <Text style={[styles.metricValue, { color: '#dc2626' }]}>{report.falha || 0}</Text>
              </View>
              <View style={[styles.metricCard, { borderLeftColor: '#9333ea' }]}>
                <Text style={styles.metricLabel}>Status</Text>
                <Text style={[styles.metricValue, { fontSize: 13, color: '#9333ea' }]}>{report.status}</Text>
              </View>
            </View>

            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Parâmetros Utilizados</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Fase:</Text>
                  <Text style={styles.infoVal}>{faseExibida}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Origem / Categoria:</Text>
                  <Text style={styles.infoVal}>{tagExibida}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Conta WhatsApp:</Text>
                  <Text style={styles.infoVal}>+{report.whatsapp_numero}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Início / Término:</Text>
                  <Text style={styles.infoVal}>{report.inicio} ➔ {report.fim}</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>💬 Conteúdo da Mensagem Disparada</Text>
              <View style={styles.msgContainer}>
                <Text style={styles.msgText}>{mensagemLimpa}</Text>
              </View>
            </View>

            <View style={styles.sectionContainer}>
              <View style={styles.leadsHeaderRow}>
                <Text style={styles.sectionTitle}>Leads Alcançados na Campanha</Text>
                <Text style={styles.leadsCountBadge}>{dadosExtra.leads?.length || report.total_alvos} registros</Text>
              </View>

              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 2 }]}>Nome do Lead</Text>
                <Text style={[styles.th, { flex: 1.5 }]}>Telefone / WhatsApp</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Status Envio</Text>
              </View>

              {dadosExtra.leads && dadosExtra.leads.length > 0 ? (
                dadosExtra.leads.map((lead, i) => {
                  const isFalha = lead.status === 'Falha';
                  return (
                    <View key={i} style={[styles.tableRow, i % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                      <Text style={[styles.td, { flex: 2, fontWeight: '600' }]} numberOfLines={1}>{lead.name}</Text>
                      <Text style={[styles.td, { flex: 1.5, color: '#475569' }]}>{lead.phone}</Text>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <View style={isFalha ? styles.statusPillError : styles.statusPillSuccess}>
                          <Text style={isFalha ? styles.statusPillTextError : styles.statusPillTextSuccess}>
                            {isFalha ? 'Falha' : 'Entregue'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyLeadsBox}>
                  <Text style={styles.emptyLeadsText}>Nenhum detalhe individual de lead registrado para este histórico.</Text>
                </View>
              )}
            </View>

          </ScrollView>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '92%', maxWidth: 780, height: '90%', backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden', ...Platform.select({ web: { boxShadow: '0px 20px 40px rgba(0,0,0,0.2)' } }) },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 16, color: '#334155', fontWeight: 'bold' },

  content: { flex: 1, padding: 24 },

  metricsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  metricCard: { flex: 1, backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  metricLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  metricValue: { fontSize: 18, fontWeight: '800', color: '#0f172a' },

  sectionContainer: { marginBottom: 24, backgroundColor: '#f8fafc', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoItem: { width: '48%', backgroundColor: '#ffffff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  infoLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  infoVal: { fontSize: 13, color: '#0f172a', fontWeight: '700', marginTop: 2 },

  msgContainer: { backgroundColor: '#ffffff', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  msgText: { fontSize: 13, color: '#334155', fontStyle: 'italic', lineHeight: 18 },

  leadsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  leadsCountBadge: { backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  
  tableHeader: { flexDirection: 'row', backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginBottom: 4 },
  th: { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  rowEven: { backgroundColor: '#ffffff' },
  rowOdd: { backgroundColor: '#f8fafc' },
  td: { fontSize: 13, color: '#1e293b' },

  statusPillSuccess: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusPillTextSuccess: { color: '#16a34a', fontSize: 11, fontWeight: '700' },

  statusPillError: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusPillTextError: { color: '#dc2626', fontSize: 11, fontWeight: '700' },

  emptyLeadsBox: { padding: 20, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 8 },
  emptyLeadsText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }
});