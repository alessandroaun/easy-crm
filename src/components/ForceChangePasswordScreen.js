import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView, Modal } from 'react-native';
import { supabase } from '../services/supabaseClient';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

const validatePassword = (pwd) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;
  return regex.test(pwd);
};

export default function ForceChangePasswordScreen({ onPasswordChanged }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Estados do Modal de Alerta Customizado
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (title, message) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setIsAlertModalVisible(true);
  };

  const handleAlertConfirm = () => {
    setIsAlertModalVisible(false);
    if (alertTitle === 'Sucesso') {
      if (onPasswordChanged) onPasswordChanged();
    }
  };

  const handleSubmit = async () => {
    if (!validatePassword(newPassword)) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres, incluindo letra maiúscula, minúscula, número e caractere especial.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      setErrorMessage('Erro ao atualizar senha: ' + error.message);
    } else {
      showAlert('Sucesso', 'Senha atualizada com sucesso! Bem-vindo ao CRM.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.headerContainer}>
            <Text style={styles.logoText3D}>ALÊ CRM</Text>
            <Text style={styles.title}>Atualização de Segurança</Text>
            <Text style={styles.subtitle}>
              Sua conta está utilizando uma senha temporária. Por segurança, crie uma nova senha forte que contenha letras maiúsculas, minúsculas, números e caracteres especiais.
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nova Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Senha@123"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmar Nova Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirme a nova senha"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

          <TouchableOpacity style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Salvar e Acessar CRM</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL DE ALERTA CUSTOMIZADO COM FADE */}
      <Modal animationType="fade" transparent={true} visible={isAlertModalVisible} onRequestClose={() => setIsAlertModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{alertTitle}</Text>
            <Text style={styles.modalSubtitle}>{alertMessage}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={handleAlertConfirm}>
              <Text style={styles.modalBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#ffffff', borderRadius: 24, padding: 32, ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 40px rgba(0, 0, 0, 0.08)' }, default: { elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 } }) },
  headerContainer: { alignItems: 'center', marginBottom: 24 },
  logoText3D: { fontFamily: MODERN_FONT, fontSize: 28, fontWeight: '900', color: '#1e3a8a', fontStyle: 'italic', letterSpacing: -1, marginBottom: 8, ...Platform.select({ web: { textShadow: '1px 1px 0px #3b82f6, 2px 2px 0px #2563eb' } }) },
  title: { fontFamily: MODERN_FONT, fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontFamily: MODERN_FONT, fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', padding: 12, borderRadius: 8, marginBottom: 20 },
  errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  inputGroup: { marginBottom: 20 },
  label: { fontFamily: MODERN_FONT, fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', fontFamily: MODERN_FONT, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  primaryButton: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...Platform.select({ web: { transition: 'background-color 0.2s ease' } }) },
  primaryButtonDisabled: { backgroundColor: '#93c5fd' },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700', fontFamily: MODERN_FONT },

  // Estilos do Modal de Alerta
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center', ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 20px rgba(0,0,0,0.15)' } }) },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  modalBtn: { width: '100%', backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 }
});