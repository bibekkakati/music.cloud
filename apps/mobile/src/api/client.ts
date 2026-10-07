import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appConfig } from '../config';

let onUnauthorizedCallback: (() => void) | null = null;

export const setUnauthorizedHandler = (callback: () => void) => {
  onUnauthorizedCallback = callback;
};

export const apiClient: AxiosInstance = axios.create({
  baseURL: appConfig.api.baseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Update baseURL dynamically (e.g. if user changes backend IP in dev settings)
export const updateApiBaseUrl = (newUrl: string) => {
  apiClient.defaults.baseURL = newUrl;
};

// Request interceptor to attach Bearer token from AsyncStorage
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await AsyncStorage.getItem(appConfig.storageKeys.authToken);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Storage read failure, continue without token
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove([
        appConfig.storageKeys.authToken,
        appConfig.storageKeys.streamToken,
        appConfig.storageKeys.playerState,
      ]);
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
