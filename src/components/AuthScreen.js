import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, 
  ActivityIndicator, KeyboardAvoidingView, ScrollView 
} from 'react-native';
import { supabase } from '../services/supabaseClient';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

export default function AuthScreen({ onRequirePasswordChange }) {
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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.headerContainer}>
            <Text style={styles.logoText3D}>ALÊ CRM</Text>
            <Text style={styles.subtitle}>
              {isForgotPass ? 'Solicite a recuperação informando seu e-mail.' : 'Bem-vindo! Acesse seu painel administrativo.'}
            </Text>
          </View>

          {errorMessage ? <View style={styles.errorBox}><Text style={styles.errorText}>{errorMessage}</Text></View> : null}
          {successMessage ? <View style={styles.successBox}><Text style={styles.successText}>{successMessage}</Text></View> : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="done"
              onSubmitEditing={handleAuth}
              blurOnSubmit={false}
            />
          </View>

          {!isForgotPass && (
            <View style={styles.inputGroup}>
              <View style={styles.passwordHeader}>
                <Text style={styles.label}>Senha</Text>
                <TouchableOpacity onPress={() => { setIsForgotPass(true); setErrorMessage(''); setSuccessMessage(''); }}>
                  <Text style={styles.forgotPassText}>Esqueceu a senha?</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={handleAuth}
                blurOnSubmit={false}
              />
            </View>
          )}

          <TouchableOpacity style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={handleAuth} disabled={loading}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{isForgotPass ? 'Enviar Solicitação' : 'Entrar no Sistema'}</Text>}
          </TouchableOpacity>

          {isForgotPass && (
            <View style={styles.toggleContainer}>
              <TouchableOpacity onPress={() => { setIsForgotPass(false); setErrorMessage(''); setSuccessMessage(''); }}>
                <Text style={styles.toggleLink}>Voltar para o Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#ffffff', borderRadius: 24, padding: 32, ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 10px 40px rgba(0, 0, 0, 0.08)' }, default: { elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 } }) },
  headerContainer: { alignItems: 'center', marginBottom: 32 },
  logoText3D: { fontFamily: MODERN_FONT, fontSize: 28, fontWeight: '900', color: '#1e3a8a', fontStyle: 'italic', letterSpacing: -1, marginBottom: 8, ...Platform.select({ web: { textShadow: '1px 1px 0px #3b82f6, 2px 2px 0px #2563eb' } }) },
  subtitle: { fontFamily: MODERN_FONT, fontSize: 14, color: '#64748b', textAlign: 'center' },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', padding: 12, borderRadius: 8, marginBottom: 20 },
  errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  successBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', padding: 12, borderRadius: 8, marginBottom: 20 },
  successText: { color: '#16a34a', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  inputGroup: { marginBottom: 20 },
  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontFamily: MODERN_FONT, fontSize: 13, fontWeight: '600', color: '#475569' },
  forgotPassText: { fontFamily: MODERN_FONT, fontSize: 12, fontWeight: '600', color: '#2563eb' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', fontFamily: MODERN_FONT, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  primaryButton: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...Platform.select({ web: { transition: 'background-color 0.2s ease' } }) },
  primaryButtonDisabled: { backgroundColor: '#93c5fd' },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700', fontFamily: MODERN_FONT },
  toggleContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  toggleLink: { color: '#2563eb', fontSize: 14, fontWeight: '700', fontFamily: MODERN_FONT }
});