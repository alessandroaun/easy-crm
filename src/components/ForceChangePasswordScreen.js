import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView, Modal, Image } from 'react-native';
import { supabase } from '../services/supabaseClient';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

const validatePassword = (pwd) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;
  return regex.test(pwd);
};

export default function ForceChangePasswordScreen({ onPasswordChanged, isDarkMode }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Estados do Modal de Alerta Customizado
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Ref para controlar se a senha já foi alterada com sucesso antes de atualizar a página
  const passwordChangedRef = useRef(false);

  // Efeito para interceptar o F5/Refresh e deslogar o usuário caso ele tente pular essa tela
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleBeforeUnload = () => {
        if (!passwordChangedRef.current) {
          // Desloga o usuário limpando a sessão antes da página recarregar
          supabase.auth.signOut();
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, []);

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
      passwordChangedRef.current = true; // Marca como sucesso para não ser deslogado ao recarregar a página no futuro
      showAlert('Sucesso', 'Senha atualizada com sucesso! Bem-vindo ao CRM.');
    }
  };

  const handleKeyPress = (e) => {
    if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter') {
      handleSubmit();
    }
  };

  const currentTheme = isDarkMode ? darkStyles : lightStyles;

  return (
    <KeyboardAvoidingView style={[styles.container, currentTheme.container]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, currentTheme.card]}>
          
          <View style={styles.headerContainer}>
            <Image 
                source={require('../../assets/logo_A11_sem_fundo.png')} 
                style={styles.logoImage} 
                resizeMode="contain" 
            />
            <Text style={[styles.title, currentTheme.title]}>Atualização de Segurança</Text>
            <Text style={[styles.subtitle, currentTheme.subtitle]}>
              Sua conta está utilizando uma senha temporária. Por segurança, crie uma nova senha forte que contenha letras maiúsculas, minúsculas, números e caracteres especiais.
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, currentTheme.label]}>Nova Senha</Text>
            <TextInput
              style={[styles.input, currentTheme.input]}
              placeholder="Ex: Senha@123"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              onSubmitEditing={handleSubmit}
              onKeyPress={handleKeyPress}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, currentTheme.label]}>Confirmar Nova Senha</Text>
            <TextInput
              style={[styles.input, currentTheme.input]}
              placeholder="Confirme a nova senha"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onSubmitEditing={handleSubmit}
              onKeyPress={handleKeyPress}
            />
          </View>

          <TouchableOpacity style={[styles.primaryButton, currentTheme.primaryButton, loading && styles.primaryButtonDisabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Salvar e Acessar CRM</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL DE ALERTA CUSTOMIZADO COM FADE */}
      <Modal animationType="fade" transparent={true} visible={isAlertModalVisible} onRequestClose={() => setIsAlertModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, currentTheme.modalContent]}>
            <Text style={[styles.modalTitle, currentTheme.modalTitle]}>{alertTitle}</Text>
            <Text style={[styles.modalSubtitle, currentTheme.modalSubtitle]}>{alertMessage}</Text>
            <TouchableOpacity style={[styles.modalBtn, currentTheme.modalBtn]} onPress={handleAlertConfirm}>
              <Text style={styles.modalBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, borderRadius: 24, padding: 32, position: 'relative' },
  headerContainer: { alignItems: 'center', marginBottom: 24 },
  logoImage: { width: 130, height: 130, marginBottom: 8 },
  title: { fontFamily: MODERN_FONT, fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontFamily: MODERN_FONT, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', padding: 12, borderRadius: 8, marginBottom: 20 },
  errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  inputGroup: { marginBottom: 20 },
  label: { fontFamily: MODERN_FONT, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 12, padding: 14, fontSize: 15, fontFamily: MODERN_FONT, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  primaryButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...Platform.select({ web: { transition: 'background-color 0.2s ease' } }) },
  primaryButtonDisabled: { backgroundColor: '#93c5fd' },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700', fontFamily: MODERN_FONT },

  // Estilos do Modal de Alerta
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  modalBtn: { width: '100%', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 }
});

const lightStyles = StyleSheet.create({
  container: { backgroundColor: '#f1f5f9' },
  card: { backgroundColor: '#ffffff', ...Platform.select({ web: { boxShadow: '0px 10px 40px rgba(0, 0, 0, 0.08)' }, default: { elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 } }) },
  title: { color: '#0f172a' },
  subtitle: { color: '#64748b' },
  label: { color: '#475569' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a' },
  primaryButton: { backgroundColor: '#2563eb' },
  modalContent: { backgroundColor: '#ffffff', ...Platform.select({ web: { boxShadow: '0px 10px 20px rgba(0,0,0,0.15)' } }) },
  modalTitle: { color: '#1e293b' },
  modalSubtitle: { color: '#64748b' },
  modalBtn: { backgroundColor: '#2563eb' }
});

const darkStyles = StyleSheet.create({
  container: { backgroundColor: '#0f172a' },
  card: { backgroundColor: '#1e293b', ...Platform.select({ web: { boxShadow: '0px 10px 40px rgba(0,0,0,0.4)' }, default: { elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 } }) },
  title: { color: '#f8fafc' },
  subtitle: { color: '#94a3b8' },
  label: { color: '#cbd5e1' },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', color: '#f8fafc' },
  primaryButton: { backgroundColor: '#3b82f6' },
  modalContent: { backgroundColor: '#1e293b', ...Platform.select({ web: { boxShadow: '0px 10px 20px rgba(0,0,0,0.4)' } }) },
  modalTitle: { color: '#f8fafc' },
  modalSubtitle: { color: '#94a3b8' },
  modalBtn: { backgroundColor: '#3b82f6' }
});