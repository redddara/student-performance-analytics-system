import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store';

interface AuthContextType {
  initializeAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const initializeAuth = useStore((state) => state.initializeAuth);

  useEffect(() => {
    // Initial check
    initializeAuth();

    // Supabase auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        initializeAuth();
      } else {
        useStore.getState().setAuthStatus('unauthenticated');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth]);

  return (
    <AuthContext.Provider value={{ initializeAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

