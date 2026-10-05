import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { streamService } from '../services/streamService';
import type { User, LoginPayload } from '../types';
import { useToast } from './ToastContext';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(authService.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { showToast } = useToast();

  const refreshProfile = useCallback(async () => {
    if (!authService.getToken()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await userService.getCurrentProfile();
      setUser(profile);
    } catch {
      // If fetching profile fails (token expired), clear token and player state
      setUser(null);
      setToken(null);
      localStorage.removeItem('music_cloud_token');
      localStorage.removeItem('music_cloud_player_state');
      streamService.clearToken();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Listen for unauthorized events from API interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      localStorage.removeItem('music_cloud_token');
      localStorage.removeItem('music_cloud_player_state');
      streamService.clearToken();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (payload: LoginPayload) => {
    try {
      setIsLoading(true);
      const session = await authService.login(payload);
      setToken(session.access_token);
      const profile = await userService.getCurrentProfile();
      setUser(profile);
      showToast('Welcome back!', 'success', `Logged in as ${profile.email}`);
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Login failed. Please check your credentials.';
      showToast('Authentication Error', 'error', errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // ignore
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('music_cloud_token');
      localStorage.removeItem('music_cloud_player_state');
      streamService.clearToken();
      window.dispatchEvent(new CustomEvent('auth:logout'));
      showToast('Logged out', 'info', 'You have been signed out.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isAdmin: !!user?.is_admin,
        isLoading,
        login,
        logout,
        refreshProfile,
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
