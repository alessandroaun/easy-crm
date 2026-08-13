import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, ActivityIndicator } from 'react-native';
import { supabase } from './src/services/supabaseClient';

import DashboardScreen from './src/screens/DashboardScreen';
import AuthScreen from './src/components/AuthScreen';
import ForceChangePasswordScreen from './src/components/ForceChangePasswordScreen'; // Vamos criar este componente abaixo

export default function App() {
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {session && session.user ? (
        // Se o usuário precisa trocar a senha obrigatoriamente, exibe a tela de troca e bloqueia o CRM
        mustChangePassword ? (
          <ForceChangePasswordScreen onPasswordChanged={() => setMustChangePassword(false)} />
        ) : (
          <DashboardScreen />
        )
      ) : (
        <AuthScreen 
          onRequirePasswordChange={() => setMustChangePassword(true)} 
        />
      )}

    </SafeAreaView>
  );
}