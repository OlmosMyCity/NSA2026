'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AuthUser, LoginInput, RegisterInput } from '../domain/auth/types';
import { authService } from '../services/authService';
import { authStorage } from '@/services/storage';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * React context provider synchronizing user session state with `authStorage`
 * and reacting to cross-component `artemis:auth-change` and `artemis:unauthorized` events.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncAuth = useCallback(() => {
    const storedUser = authStorage.getUser();
    const storedToken = authStorage.getToken();
    setUser(storedUser);
    setToken(storedToken);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    syncAuth();

    const handleAuthChange = () => {
      syncAuth();
    };

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      router.push('/login?expired=true');
    };

    window.addEventListener('artemis:auth-change', handleAuthChange);
    window.addEventListener('artemis:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('artemis:auth-change', handleAuthChange);
      window.removeEventListener('artemis:unauthorized', handleUnauthorized);
    };
  }, [syncAuth, router]);

  const login = async (credentials: LoginInput) => {
    const res = await authService.login(credentials);
    setUser(res.user);
    setToken(res.token);
  };

  const register = async (input: RegisterInput) => {
    const res = await authService.register(input);
    setUser(res.user);
    setToken(res.token);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
    router.push('/login');
  };

  const isAuthenticated = !!token && !!user;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}

