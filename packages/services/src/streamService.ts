import { songService } from "./songService";

export interface StreamStorageAdapter {
    getItem: (key: string) => string | null | Promise<string | null>;
    setItem: (key: string, value: string) => void | Promise<void>;
    removeItem: (key: string) => void | Promise<void>;
}

export interface StreamServiceConfig {
    storageKey?: string;
    refreshMarginMs?: number; // Default 10 minutes (600,000ms)
    fallbackLifetimeMs?: number; // Default 4 hours (14,400,000ms)
    storageAdapter?: StreamStorageAdapter;
}

const DEFAULT_REFRESH_MARGIN_MS = 600000; // 10 minutes
const DEFAULT_FALLBACK_LIFETIME_MS = 14400000; // 4 hours
const DEFAULT_STORAGE_KEY = "mc_stream_token";

/**
 * Universal base64url JWT payload decoder (works in Web, React Native, Node)
 */
function decodeJwtPayload(token: string): { exp?: number; [key: string]: any } | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        let str = base64.replace(/=+$/, "");
        let output = "";

        for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++)); ) {
            const idx = chars.indexOf(buffer);
            if (~idx) {
                bs = bc % 4 ? bs * 64 + idx : idx;
                if (bc++ % 4) {
                    output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
                }
            }
        }

        return JSON.parse(output);
    } catch {
        return null;
    }
}

export class StreamService {
    // Tier 1: In-Memory Cache
    private currentToken: string | null = null;
    private expiresAt: number | null = null;

    // Config & Adapters
    private storageAdapter: StreamStorageAdapter | null = null;
    private storageKey: string = DEFAULT_STORAGE_KEY;
    private refreshMarginMs: number = DEFAULT_REFRESH_MARGIN_MS;
    private fallbackLifetimeMs: number = DEFAULT_FALLBACK_LIFETIME_MS;

    // Concurrency & Listeners
    private refreshTimer: any = null;
    private listeners: ((token: string) => void)[] = [];
    private pendingRequest: Promise<string> | null = null;
    private initPromise: Promise<void> | null = null;

    constructor(config?: StreamServiceConfig) {
        if (config) {
            this.configure(config);
        }
    }

    /**
     * Configure or re-configure storage adapter and options
     */
    public configure(config: StreamServiceConfig): void {
        if (config.storageKey) this.storageKey = config.storageKey;
        if (config.refreshMarginMs) this.refreshMarginMs = config.refreshMarginMs;
        if (config.fallbackLifetimeMs) this.fallbackLifetimeMs = config.fallbackLifetimeMs;
        if (config.storageAdapter) {
            this.storageAdapter = config.storageAdapter;
            this.initPromise = this.initFromStorage();
        }
    }

    /**
     * Set or replace storage adapter (e.g. AsyncStorage in mobile, localStorage in web)
     */
    public setStorageAdapter(adapter: StreamStorageAdapter, storageKey?: string): void {
        this.storageAdapter = adapter;
        if (storageKey) this.storageKey = storageKey;
        this.initPromise = this.initFromStorage();
    }

    /**
     * Inspect existing Stream token in storage on initialization
     */
    private async initFromStorage(): Promise<void> {
        if (!this.storageAdapter) return;
        try {
            const token = await this.storageAdapter.getItem(this.storageKey);
            if (token) {
                const payload = decodeJwtPayload(token);
                if (payload?.exp) {
                    const expMs = payload.exp * 1000;
                    if (expMs > Date.now() + this.refreshMarginMs) {
                        this.currentToken = token;
                        this.expiresAt = expMs;
                        this.scheduleAutoRefresh();
                        return;
                    }
                }
                // Expired or invalid token in storage: clean up
                await this.storageAdapter.removeItem(this.storageKey);
            }
        } catch {
            // Ignore storage read errors
        } finally {
            this.initPromise = null;
        }
    }

    /**
     * Check if the currently held memory token is expired or close to expiry
     */
    public isNearExpiry(): boolean {
        if (!this.currentToken || !this.expiresAt) return true;
        const remainingTime = this.expiresAt - Date.now();
        return remainingTime <= this.refreshMarginMs;
    }

    /**
     * Fetch a fresh stream JWT token from the shared songService API
     */
    public async requestNewToken(): Promise<string> {
        try {
            const response = await songService.getStreamToken();
            const { token, expires_at } = response;
            this.currentToken = token;

            const parsedExpiry = new Date(expires_at).getTime();
            this.expiresAt = !isNaN(parsedExpiry)
                ? parsedExpiry
                : Date.now() + this.fallbackLifetimeMs;

            // Persist to storage in background (L2 cache)
            if (this.storageAdapter) {
                Promise.resolve(this.storageAdapter.setItem(this.storageKey, token)).catch(() => {});
            }

            this.notifyListeners(token);
            this.scheduleAutoRefresh();

            return token;
        } catch (err) {
            console.warn("Stream token request failed:", err);
            throw err;
        }
    }

    /**
     * Multi-tier token resolution:
     * 1. Memory Cache check (0ms instant return if app already running with valid token)
     * 2. Storage Adapter fallback (if memory is empty, e.g. after cold launch)
     * 3. Network API fetch (deduplicated across concurrent calls)
     */
    public async getValidStreamToken(): Promise<string> {
        // Tier 1: Check In-Memory Cache first (Instant 0ms, no async overhead)
        if (this.currentToken && !this.isNearExpiry()) {
            return this.currentToken;
        }

        // Tier 2: If memory token is missing, await storage hydration
        if (this.initPromise) {
            await this.initPromise;
            if (this.currentToken && !this.isNearExpiry()) {
                return this.currentToken;
            }
        }

        // Tier 3: Network API fetch with in-flight deduplication
        if (this.pendingRequest) {
            return this.pendingRequest;
        }

        this.pendingRequest = this.requestNewToken().finally(() => {
            this.pendingRequest = null;
        });

        return this.pendingRequest;
    }

    /**
     * Background pre-warm to load stream token into memory cache
     */
    public async preloadToken(): Promise<void> {
        try {
            await this.getValidStreamToken();
        } catch {}
    }

    /**
     * Synchronously returns the currently held in-memory token, or null if none
     */
    public getCurrentToken(): string | null {
        return this.currentToken;
    }

    /**
     * Clear token from memory and persistent storage on logout
     */
    public async clearToken(): Promise<void> {
        this.currentToken = null;
        this.expiresAt = null;
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        if (this.storageAdapter) {
            try {
                await this.storageAdapter.removeItem(this.storageKey);
            } catch {}
        }
    }

    /**
     * Register a listener for token renewals
     */
    public onTokenRenewed(callback: (token: string) => void): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== callback);
        };
    }

    private notifyListeners(token: string): void {
        this.listeners.forEach((listener) => {
            try {
                listener(token);
            } catch (e) {
                console.error("Error in stream token listener:", e);
            }
        });
    }

    /**
     * Schedule automatic renewal when token is near expiry
     */
    private scheduleAutoRefresh(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        if (!this.expiresAt) return;

        const timeUntilNearExpiry = Math.max(
            1000,
            this.expiresAt - Date.now() - this.refreshMarginMs,
        );

        this.refreshTimer = setTimeout(async () => {
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
export default streamService;
