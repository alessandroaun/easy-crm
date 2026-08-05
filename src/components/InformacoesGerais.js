import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function InformacoesGerais() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Informações Gerais</Text>
      <View style={styles.card}>
        <Text style={styles.text}>Esta tela está pronta para receber os gráficos gerais, relatórios exportáveis e configurações avançadas do seu sistema.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#F9FAFB' },
  title: { fontFamily: MODERN_FONT, fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 24 },
  card: { 
    backgroundColor: '#ffffff', 
    padding: 24, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    ...Platform.select({ web: { boxShadow: '0px 4px 10px rgba(0,0,0,0.03)' } })
  },
  text: { fontFamily: MODERN_FONT, fontSize: 15, color: '#475569', lineHeight: 22 }
});