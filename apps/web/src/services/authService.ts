import apiClient, { TOKEN_STORAGE_KEY } from '../api';
import type { LoginPayload, SessionResponse } from '../types';

export const authService = {
  login: async (payload: LoginPayload): Promise<SessionResponse> => {
    const response = await apiClient.post<SessionResponse>('/api/v1/auth/login', {
      login_data: payload,
    });
    if (response.data.access_token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, response.data.access_token);
    }
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/api/v1/auth/logout');
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem('music_cloud_player_state');
    }
  },

  refreshToken: async (): Promise<SessionResponse> => {
    const response = await apiClient.post<SessionResponse>('/api/v1/auth/refresh');
    if (response.data.access_token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, response.data.access_token);
    }
    return response.data;
  },

  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(TOKEN_STORAGE_KEY);
  },
};
