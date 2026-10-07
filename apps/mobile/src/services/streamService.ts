import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { appConfig } from '../config';
import type { StreamTokenResponse } from '@music-cloud/types';

const REFRESH_MARGIN_MS = appConfig.streaming.token_refresh_margin_ms;
const FALLBACK_LIFETIME_MS = appConfig.streaming.token_fallback_lifetime_ms;
const STREAM_TOKEN_STORAGE_KEY = appConfig.storageKeys.streamToken;

// Safe base64 decoding for React Native
function decodeBase64(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input.replace(/=+$/, '');
  let output = '';

  if (str.length % 4 === 1) {
    throw new Error('Invalid base64 string');
  }

  for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++)); ) {
    const idx = chars.indexOf(buffer);
    if (~idx) {
      bs = bc % 4 ? bs * 64 + idx : idx;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
      }
    }
  }

  return output;
}

class StreamService {
  private currentToken: string | null = null;
  private expiresAt: number | null = null;
  private refreshTimer: any = null;
  private listeners: ((token: string) => void)[] = [];

  constructor() {
    this.initFromStorage();
  }

  private async initFromStorage() {
    try {
      const token = await AsyncStorage.getItem(STREAM_TOKEN_STORAGE_KEY);
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeBase64(base64);
          const payload = JSON.parse(jsonPayload);
          if (payload.exp) {
            const expMs = payload.exp * 1000;
            if (expMs > Date.now() + REFRESH_MARGIN_MS) {
              this.currentToken = token;
              this.expiresAt = expMs;
              this.scheduleAutoRefresh();
            } else {
              await AsyncStorage.removeItem(STREAM_TOKEN_STORAGE_KEY);
            }
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  public async requestNewToken(): Promise<string> {
    try {
      const response = await apiClient.get<StreamTokenResponse>('/api/v1/song/stream/token');
      const { token, expires_at } = response.data;
      this.currentToken = token;

      const parsedExpiry = new Date(expires_at).getTime();
      this.expiresAt = !isNaN(parsedExpiry) ? parsedExpiry : Date.now() + FALLBACK_LIFETIME_MS;

      await AsyncStorage.setItem(STREAM_TOKEN_STORAGE_KEY, token);

      this.notifyListeners(token);
      this.scheduleAutoRefresh();

      return token;
    } catch (err) {
      console.warn('Stream token request failed:', err);
      throw err;
    }
  }

  public isNearExpiry(): boolean {
    if (!this.currentToken || !this.expiresAt) return true;
    const remainingTime = this.expiresAt - Date.now();
    return remainingTime <= REFRESH_MARGIN_MS;
  }

  public async getValidStreamToken(): Promise<string> {
    if (this.isNearExpiry() || !this.currentToken) {
      return await this.requestNewToken();
    }
    return this.currentToken;
  }

  public getCurrentToken(): string | null {
    return this.currentToken;
  }

  public async clearToken(): Promise<void> {
    this.currentToken = null;
    this.expiresAt = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    await AsyncStorage.removeItem(STREAM_TOKEN_STORAGE_KEY);
  }

  public onTokenRenewed(callback: (token: string) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners(token: string) {
    this.listeners.forEach((listener) => {
      try {
        listener(token);
      } catch (e) {
        console.error('Error in stream token listener:', e);
      }
    });
  }

  private scheduleAutoRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    if (!this.expiresAt) return;

    const timeUntilNearExpiry = Math.max(1000, this.expiresAt - Date.now() - REFRESH_MARGIN_MS);

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.requestNewToken();
      } catch (e) {
        console.error('Auto-refresh of stream JWT failed:', e);
      }
    }, timeUntilNearExpiry);
  }
}

export const streamService = new StreamService();
