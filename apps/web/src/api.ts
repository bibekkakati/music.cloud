import {
    apiClient,
    initApiClient,
    type AuthStorageAdapter,
} from "@music-cloud/services";

export const WEB_TOKEN_KEY = "music_cloud_token";

export const webStorageAdapter: AuthStorageAdapter = {
    getToken: () => {
        try {
            return localStorage.getItem(WEB_TOKEN_KEY);
        } catch {
            return null;
        }
    },
    setToken: (token: string) => {
        try {
            localStorage.setItem(WEB_TOKEN_KEY, token);
        } catch {
            // Ignore quota errors in storage
        }
    },
    clearToken: () => {
        try {
            localStorage.removeItem(WEB_TOKEN_KEY);
            localStorage.removeItem("music_cloud_player_state");
        } catch {
            // Ignore storage removal errors
        }
    },
};

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
export const WEB_API_BASE_URL_KEY = "music_cloud_api_base_url";

/**
 * Returns default API base URL from Vite environment
 */
export const getDefaultApiBaseUrl = (): string => {
    return DEFAULT_BASE_URL;
};

/**
 * Returns active API base URL (custom persisted URL or env default)
 */
export const getActiveApiBaseUrl = (): string => {
    try {
        const stored = localStorage.getItem(WEB_API_BASE_URL_KEY);
        if (stored && stored.trim().length > 0) {
            return stored.trim();
        }
    } catch {
        // Fall back to env
    }
    return DEFAULT_BASE_URL;
};

/**
 * Persists and applies a new Backend URL across all API calls
 */
export const updateApiBaseUrl = (newUrl: string): string => {
    const trimmed = newUrl.trim().replace(/\/+$/, "");
    if (!trimmed || trimmed === DEFAULT_BASE_URL.replace(/\/+$/, "")) {
        try {
            localStorage.removeItem(WEB_API_BASE_URL_KEY);
        } catch {
            // ignore
        }
        apiClient.defaults.baseURL = DEFAULT_BASE_URL;
        window.dispatchEvent(
            new CustomEvent("api:base_url_changed", {
                detail: { baseURL: DEFAULT_BASE_URL },
            }),
        );
        return DEFAULT_BASE_URL;
    }

    try {
        localStorage.setItem(WEB_API_BASE_URL_KEY, trimmed);
    } catch {
        // ignore
    }
    apiClient.defaults.baseURL = trimmed;
    window.dispatchEvent(
        new CustomEvent("api:base_url_changed", {
            detail: { baseURL: trimmed },
        }),
    );
    return trimmed;
};

// Platform-level initialization of shared services with active URL
initApiClient({
    baseURL: getActiveApiBaseUrl(),
    storage: webStorageAdapter,
    onUnauthorized: () => {
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    },
});

export { apiClient };
export default apiClient;

