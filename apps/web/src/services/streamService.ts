import apiClient from "../api";
import { appConfig } from "../config";

export interface StreamTokenResponse {
    token: string;
    token_type?: string;
    expires_at: string; // ISO date string or unix timestamp
    url?: string;
}

const REFRESH_MARGIN_MS = appConfig.streaming.token_refresh_margin_ms;
const FALLBACK_LIFETIME_MS = appConfig.streaming.token_fallback_lifetime_ms;
const STREAM_TOKEN_STORAGE_KEY = appConfig.ui.localStorage_keys.stream_token;

class StreamService {
    private currentToken: string | null = null;
    private expiresAt: number | null = null; // timestamp in ms
    private refreshTimer: number | null = null;
    private listeners: ((token: string) => void)[] = [];

    constructor() {
        this.initFromStorage();
    }

    /**
     * Inspect existing Stream token in localStorage on initialization
     */
    private initFromStorage() {
        try {
            const token = localStorage.getItem(STREAM_TOKEN_STORAGE_KEY);
            if (token) {
                const parts = token.split(".");
                if (parts.length === 3) {
                    const payloadStr = atob(
                        parts[1].replace(/-/g, "+").replace(/_/g, "/"),
                    );
                    const payload = JSON.parse(payloadStr);
                    if (payload.exp) {
                        const expMs = payload.exp * 1000;
                        if (expMs > Date.now() + REFRESH_MARGIN_MS) {
                            this.currentToken = token;
                            this.expiresAt = expMs;
                            this.scheduleAutoRefresh();
                        } else {
                            localStorage.removeItem(STREAM_TOKEN_STORAGE_KEY);
                        }
                    }
                }
            }
        } catch {
            // Ignore decoding errors
        }
    }

    /**
     * Fetch a fresh stream JWT token from FastAPI backend
     */
    public async requestNewToken(): Promise<string> {
        try {
            const response = await apiClient.get<StreamTokenResponse>(
                "/api/v1/song/stream/token",
            );

            const { token, expires_at } = response.data;
            this.currentToken = token;

            const parsedExpiry = new Date(expires_at).getTime();
            this.expiresAt = !isNaN(parsedExpiry)
                ? parsedExpiry
                : Date.now() + FALLBACK_LIFETIME_MS;

            // Store in local storage for mobile/web persistence
            localStorage.setItem(STREAM_TOKEN_STORAGE_KEY, token);

            this.notifyListeners(token);
            this.scheduleAutoRefresh();

            return token;
        } catch (err) {
            console.warn("Stream token request failed:", err);
            throw err;
        }
    }

    /**
     * Check if the current token is missing, expired, or near expiry
     */
    public isNearExpiry(): boolean {
        if (!this.currentToken || !this.expiresAt) return true;
        const remainingTime = this.expiresAt - Date.now();
        return remainingTime <= REFRESH_MARGIN_MS;
    }

    /**
     * Get an active, valid stream token. If expired or missing, requests a new one.
     */
    public async getValidStreamToken(): Promise<string> {
        if (this.isNearExpiry() || !this.currentToken) {
            return await this.requestNewToken();
        }
        return this.currentToken;
    }

    /**
     * Construct the R2 Worker HLS master playlist URL with attached token query param
     */
    public getHlsStreamUrl(masterUrl: string): string {
        if (!this.currentToken) return masterUrl;
        if (masterUrl.includes("token=")) return masterUrl;
        const separator = masterUrl.includes("?") ? "&" : "?";
        return `${masterUrl}${separator}token=${encodeURIComponent(this.currentToken)}`;
    }

    /**
     * Clear token and timers on logout
     */
    public clearToken(): void {
        this.currentToken = null;
        this.expiresAt = null;
        if (this.refreshTimer) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        localStorage.removeItem(STREAM_TOKEN_STORAGE_KEY);
    }

    /**
     * Listen for token renewals
     */
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
                console.error("Error in stream token listener:", e);
            }
        });
    }

    /**
     * Schedule automatic renewal when token is within refresh margin of expiry
     */
    private scheduleAutoRefresh() {
        if (this.refreshTimer) {
            window.clearTimeout(this.refreshTimer);
        }

        if (!this.expiresAt) return;

        const timeUntilNearExpiry = Math.max(
            1000,
            this.expiresAt - Date.now() - REFRESH_MARGIN_MS,
        );

        this.refreshTimer = window.setTimeout(async () => {
            try {
                await this.requestNewToken();
            } catch (e) {
                console.error("Auto-refresh of stream JWT failed:", e);
            }
        }, timeUntilNearExpiry);
    }

    /**
     * Get remaining seconds before token expires
     */
    public getRemainingSeconds(): number {
        if (!this.expiresAt) return 0;
        return Math.max(0, Math.floor((this.expiresAt - Date.now()) / 1000));
    }
}

export const streamService = new StreamService();
