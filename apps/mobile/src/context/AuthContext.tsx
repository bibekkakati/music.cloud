import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoginPayload, User } from '@music-cloud/types';
import { authService, userService } from '@music-cloud/services';
import { setUnauthorizedHandler } from '../api/client';
import { streamService } from '../services/streamService';
import { useNetwork } from './NetworkContext';
import { appConfig } from '../config';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalVisible: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOffline } = useNetwork();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalVisible, setIsAuthModalVisible] = useState<boolean>(false);

  // Keep a ref to token to avoid circular dependencies in callbacks
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  const openAuthModal = useCallback(() => setIsAuthModalVisible(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalVisible(false), []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network failures on logout
    } finally {
      await AsyncStorage.multiRemove([
        appConfig.storageKeys.authToken,
        appConfig.storageKeys.userProfile,
        appConfig.storageKeys.streamToken,
        appConfig.storageKeys.playerState,
      ]).catch(() => {});
      await streamService.clearToken();
      setToken(null);
      setUser(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentToken = tokenRef.current || (await authService.getTokenAsync());
    if (!currentToken) return;

    try {
      const currentUser = await userService.getCurrentProfile();
      setUser(currentUser);
      await AsyncStorage.setItem(
        appConfig.storageKeys.userProfile,
        JSON.stringify(currentUser),
      ).catch(() => {});
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      // ONLY log out if backend explicitly rejected credentials with 401 Unauthorized.
      // Do NOT log out on network disconnects, timeouts, or server cold-starts.
      if (status === 401) {
        await logout();
      } else {
        console.warn('Could not refresh profile due to network or server error:', err);
      }
    }
  }, [logout]);

  const loadInitialAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const [storedToken, storedProfileRaw] = await Promise.all([
        authService.getTokenAsync(),
        AsyncStorage.getItem(appConfig.storageKeys.userProfile).catch(() => null),
      ]);

      if (storedToken) {
        setToken(storedToken);

        if (storedProfileRaw) {
          try {
            const parsedUser: User = JSON.parse(storedProfileRaw);
            setUser(parsedUser);
          } catch {
            // Ignore corrupted cached json
          }
        }

        // Hydration done, release initial loading state immediately
        setIsLoading(false);

        // Concurrently attempt to verify/update profile from backend
        try {
          const currentUser = await userService.getCurrentProfile();
          setUser(currentUser);
          await AsyncStorage.setItem(
            appConfig.storageKeys.userProfile,
            JSON.stringify(currentUser),
          ).catch(() => {});
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 401) {
            await logout();
          } else {
            console.warn('Could not refresh user profile on launch (offline or network error):', err);
          }
        }
      } else {
        setToken(null);
        setUser(null);
        setIsLoading(false);
      }
    } catch (err) {
      console.warn('Error loading initial auth:', err);
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    loadInitialAuth();

    // Hook into 401 unauthorized from API client interceptor
    setUnauthorizedHandler(async () => {
      await AsyncStorage.multiRemove([
        appConfig.storageKeys.authToken,
        appConfig.storageKeys.userProfile,
        appConfig.storageKeys.streamToken,
        appConfig.storageKeys.playerState,
      ]).catch(() => {});
      setToken(null);
      setUser(null);
      streamService.clearToken();
    });
  }, [loadInitialAuth]);

  // When network reconnects (offline -> online), refresh profile in background if logged in
  useEffect(() => {
    if (!isOffline && token) {
      refreshProfile();
    }
  }, [isOffline, token, refreshProfile]);

  // Periodic session heartbeat (every 30s) while authenticated, online, and app is active in foreground
  useEffect(() => {
    if (!token || isOffline) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startHeartbeat = () => {
      if (intervalId) clearInterval(intervalId);
      userService.heartbeat();
      intervalId = setInterval(() => {
        userService.heartbeat();
      }, 30000);
    };

    const stopHeartbeat = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    if (AppState.currentState === 'active') {
      startHeartbeat();
    }

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    });

    return () => {
      stopHeartbeat();
      subscription.remove();
    };
  }, [token, isOffline]);

  const login = async (payload: LoginPayload) => {
    const session = await authService.login(payload);
    setToken(session.access_token);
    try {
      const currentUser = await userService.getCurrentProfile();
      setUser(currentUser);
      await AsyncStorage.setItem(
        appConfig.storageKeys.userProfile,
        JSON.stringify(currentUser),
      ).catch(() => {});
    } catch (err) {
      console.warn('Could not fetch user profile after login:', err);
    }
    closeAuthModal();
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
        refreshProfile,
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
