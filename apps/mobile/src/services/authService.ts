import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { appConfig } from '../config';
import type { LoginPayload, SessionResponse, User } from '@music-cloud/types';

export const authService = {
  login: async (payload: LoginPayload): Promise<SessionResponse> => {
    const response = await apiClient.post<SessionResponse>('/api/v1/auth/login', {
      login_data: payload,
    });
    if (response.data.access_token) {
      await AsyncStorage.setItem(appConfig.storageKeys.authToken, response.data.access_token);
    }
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/api/v1/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      await AsyncStorage.multiRemove([
        appConfig.storageKeys.authToken,
        appConfig.storageKeys.streamToken,
        appConfig.storageKeys.playerState,
      ]);
    }
  },

  refreshToken: async (): Promise<SessionResponse> => {
    const response = await apiClient.post<SessionResponse>('/api/v1/auth/refresh');
    if (response.data.access_token) {
      await AsyncStorage.setItem(appConfig.storageKeys.authToken, response.data.access_token);
    }
    return response.data;
  },

  getToken: async (): Promise<string | null> => {
    return AsyncStorage.getItem(appConfig.storageKeys.authToken);
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      const response = await apiClient.get<User>('/api/v1/auth/me');
      return response.data;
    } catch {
      return null;
    }
  },
};
