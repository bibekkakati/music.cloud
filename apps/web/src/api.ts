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

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Platform-level initialization of shared services
initApiClient({
    baseURL: BASE_URL,
    storage: webStorageAdapter,
    onUnauthorized: () => {
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    },
});

export { apiClient };
export default apiClient;
