import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, 
  ActivityIndicator, KeyboardAvoidingView, ScrollView, Image 
} from 'react-native';
import { supabase } from '../services/supabaseClient';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function AuthScreen({ onRequirePasswordChange, isDarkMode, toggleDarkMode }) {
  const [isForgotPass, setIsForgotPass] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleAuth = async () => {
    if (!email || (!password && !isForgotPass)) {
      setErrorMessage('Por favor, preencha os campos obrigatórios.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (isForgotPass) {
        const { error } = await supabase.rpc('request_password_reset', { request_email: email });
        if (error) throw error;
        setSuccessMessage('Solicitação enviada ao Administrador! Aguarde o reset.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Se a senha for a padrão, aciona a função que força a troca no App.js
        if (password === 'Senha123!') {
          if (onRequirePasswordChange) onRequirePasswordChange();
        }
      }
    } catch (error) {
      console.error(error);
      let msg = error.message || 'Erro de conexão.';
      if (msg === '{}' || typeof msg === 'object') msg = 'Falha interna no servidor.';
      setErrorMessage(msg === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : msg);
    } finally {
      setLoading(false);
    }
  };

  // Cores dinâmicas com base no estado do modo escuro
  const currentTheme = isDarkMode ? darkStyles : lightStyles;

  return (
    <KeyboardAvoidingView style={[styles.container, currentTheme.container]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, currentTheme.card]}>
          
          {/* Botão de Alternância do Modo Escuro / Claro */}
          <TouchableOpacity 
            style={[styles.themeToggleButton, currentTheme.themeToggleButton]} 
           onPress={() => toggleDarkMode(!isDarkMode)}
            activeOpacity={0.7}
          >
            <Text style={styles.themeToggleIcon}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <Image 
                source={require('../../assets/logo_A11_sem_fundo.png')} 
                style={styles.logoImage} 
                resizeMode="contain" 
            />
            <Text style={[styles.subtitle, currentTheme.subtitle]}>
              Conecte. Relacione. Maximize.
            </Text>
          </View>

          {errorMessage ? <View style={styles.errorBox}><Text style={styles.errorText}>{errorMessage}</Text></View> : null}
          {successMessage ? <View style={styles.successBox}><Text style={styles.successText}>{successMessage}</Text></View> : null}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, currentTheme.label]}>E-mail</Text>
            <TextInput
              style={[styles.input, currentTheme.input]}
              placeholder="seu@email.com"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="done"
              onSubmitEditing={handleAuth}
              blurOnSubmit={false}
            />
          </View>

          {/* BLOCO CONDICIONAL DE ALTURA FIXA: Evita qualquer deslocamento da logo ou do botão */}
          <View style={styles.dynamicSectionContainer}>
            {!isForgotPass ? (
              <View style={styles.passwordFullGroup}>
                <Text style={[styles.label, currentTheme.label]}>Senha</Text>
                <TextInput
                  style={[styles.input, currentTheme.input]}
                  placeholder="••••••••"
                  placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleAuth}
                  blurOnSubmit={false}
                />
                <TouchableOpacity style={styles.forgotPassContainer} onPress={() => { setIsForgotPass(true); setErrorMessage(''); setSuccessMessage(''); }}>
                  <Text style={[styles.forgotPassText, currentTheme.forgotPassText]}>Esqueceu a senha?</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.infoBalloon, currentTheme.infoBalloon]}>
                <Text style={[styles.infoBalloonText, currentTheme.infoBalloonText]}>
                  ℹ️ Para recuperar seu acesso, insira seu e-mail de usuário e clique em "Enviar Solicitação". A recuperação dependerá da aprovação de um administrador. A resposta e os procedimentos chegarão no e-mail informado.
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={[styles.primaryButton, currentTheme.primaryButton, loading && styles.primaryButtonDisabled]} onPress={handleAuth} disabled={loading}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{isForgotPass ? 'Enviar Solicitação' : 'Entrar no Sistema'}</Text>}
          </TouchableOpacity>

          {/* RODAPÉ CONDICIONAL DE ALTURA FIXA PARA O LINK DE RETORNO */}
          <View style={styles.bottomToggleContainer}>
            {isForgotPass && (
              <TouchableOpacity onPress={() => { setIsForgotPass(false); setErrorMessage(''); setSuccessMessage(''); }}>
                <Text style={[styles.toggleLink, currentTheme.toggleLink]}>Voltar para o Login</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 24, justifyContent: 'center', position: 'relative' },
  headerContainer: { alignItems: 'center', marginBottom: 20 },
  logoImage: { width: 140, height: 140, marginBottom: 4 },
  subtitle: { fontFamily: MODERN_FONT, fontSize: 16, textAlign: 'center', marginTop: 4, fontWeight: '500' },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', padding: 10, borderRadius: 8, marginBottom: 16 },
  errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  successBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', padding: 10, borderRadius: 8, marginBottom: 16 },
  successText: { color: '#16a34a', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  inputGroup: { marginBottom: 16 },
  label: { fontFamily: MODERN_FONT, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  
  /* Seção dinâmica com altura fixa garantindo que o card e todos os elementos fiquem estáticos */
  dynamicSectionContainer: { height: 88, justifyContent: 'flex-start', marginBottom: 16 },
  passwordFullGroup: { width: '100%' },
  forgotPassContainer: { alignItems: 'flex-end', marginTop: 6 },
  forgotPassText: { fontFamily: MODERN_FONT, fontSize: 12, fontWeight: '600' },
  
  /* Balão de notificação explicativo preenchendo o espaço */
  infoBalloon: { borderRadius: 10, padding: 10, justifyContent: 'center', borderWidth: 1 },
  infoBalloonText: { fontFamily: MODERN_FONT, fontSize: 11.5, lineHeight: 16, textAlign: 'center' },

  input: { borderRadius: 12, padding: 12, fontSize: 15, fontFamily: MODERN_FONT, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  primaryButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4, ...Platform.select({ web: { transition: 'background-color 0.2s ease' } }) },
  primaryButtonDisabled: { backgroundColor: '#93c5fd' },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700', fontFamily: MODERN_FONT },
  
  bottomToggleContainer: { height: 28, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  toggleLink: { fontSize: 14, fontWeight: '700', fontFamily: MODERN_FONT },

  themeToggleButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  themeToggleIcon: {
    fontSize: 16,
  }
});

/* Estilos específicos para o Modo Claro */
const lightStyles = StyleSheet.create({
  container: { backgroundColor: '#f1f5f9' },
  card: { 
    backgroundColor: '#ffffff', 
    ...Platform.select({ 
      web: { boxShadow: '0px 10px 40px rgba(0, 0, 0, 0.08)' }, 
      default: { elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 } 
    }) 
  },
  themeToggleButton: { backgroundColor: '#f1f5f9' },
  subtitle: { color: '#64748b' },
  label: { color: '#475569' },
  forgotPassText: { color: '#2563eb' },
  infoBalloon: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  infoBalloonText: { color: '#1e40af' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a' },
  primaryButton: { backgroundColor: '#2563eb' },
  toggleLink: { color: '#2563eb' }
});

/* Estilos específicos para o Modo Escuro */
const darkStyles = StyleSheet.create({
  container: { backgroundColor: '#0f172a' },
  card: { 
    backgroundColor: '#1e293b', 
    ...Platform.select({ 
      web: { boxShadow: '0px 10px 40px rgba(0, 0, 0, 0.4)' }, 
      default: { elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 } 
    }) 
  },
  themeToggleButton: { backgroundColor: '#334155' },
  subtitle: { color: '#94a3b8' },
  label: { color: '#cbd5e1' },
  forgotPassText: { color: '#60a5fa' },
  infoBalloon: { backgroundColor: '#172554', borderColor: '#1e3a8a' },
  infoBalloonText: { color: '#93c5fd' },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', color: '#f8fafc' },
  primaryButton: { backgroundColor: '#3b82f6' },
  toggleLink: { color: '#60a5fa' }
});