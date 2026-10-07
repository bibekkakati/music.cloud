import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { LoginPayload, User } from '@music-cloud/types';
import { authService } from '../services/authService';
import { setUnauthorizedHandler } from '../api/client';
import { streamService } from '../services/streamService';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalVisible: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalVisible, setIsAuthModalVisible] = useState<boolean>(false);

  const openAuthModal = useCallback(() => setIsAuthModalVisible(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalVisible(false), []);

  const loadInitialAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedToken = await authService.getToken();
      if (storedToken) {
        setToken(storedToken);
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } else {
        setToken(null);
        setUser(null);
      }
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialAuth();

    // Hook into 401 unauthorized
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
      streamService.clearToken();
    });
  }, [loadInitialAuth]);

  const login = async (payload: LoginPayload) => {
    const session = await authService.login(payload);
    setToken(session.access_token);
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
    closeAuthModal();
  };

  const logout = async () => {
    await authService.logout();
    await streamService.clearToken();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        isAuthModalVisible,
        login,
        logout,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
