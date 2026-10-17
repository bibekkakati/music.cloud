import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    apiClient,
    initApiClient,
    type AuthStorageAdapter,
} from "@music-cloud/services";
import { appConfig } from "../config";

let onUnauthorizedCallback: (() => void) | null = null;

export const setUnauthorizedHandler = (callback: () => void) => {
    onUnauthorizedCallback = callback;
};

export const mobileStorageAdapter: AuthStorageAdapter = {
    getToken: async () => {
        try {
            return await AsyncStorage.getItem(appConfig.storageKeys.authToken);
        } catch {
            return null;
        }
    },
    setToken: async (token: string) => {
        try {
            await AsyncStorage.setItem(appConfig.storageKeys.authToken, token);
        } catch {
            // Ignore storage write error
        }
    },
    clearToken: async () => {
        try {
            await AsyncStorage.multiRemove([
                appConfig.storageKeys.authToken,
                appConfig.storageKeys.userProfile,
                appConfig.storageKeys.streamToken,
                appConfig.storageKeys.playerState,
            ]);
        } catch {
            // Ignore storage removal errors
        }
    },
};

// Platform-level initialization of shared services with mobile storage adapter
export const initMobileApi = (baseUrl: string = appConfig.api.baseUrl) => {
    initApiClient({
        baseURL: baseUrl,
        storage: mobileStorageAdapter,
        onUnauthorized: () => {
            if (onUnauthorizedCallback) {
                onUnauthorizedCallback();
            }
        },
    });
    apiClient.defaults.timeout = 15000;

    // Hydrate persisted baseURL from AsyncStorage if available
    AsyncStorage.getItem(appConfig.storageKeys.apiBaseUrl)
        .then((storedUrl) => {
            if (storedUrl && storedUrl.trim()) {
                apiClient.defaults.baseURL = storedUrl.trim();
            }
        })
        .catch(() => {});
};

// Retrieve active API baseURL (from storage or env default)
export const getActiveApiBaseUrl = async (): Promise<string> => {
    try {
        const stored = await AsyncStorage.getItem(appConfig.storageKeys.apiBaseUrl);
        if (stored && stored.trim()) {
            return stored.trim();
        }
    } catch {}
    return appConfig.api.baseUrl || "";
};

// Dynamic update and persistence of API baseURL
export const updateApiBaseUrl = async (newUrl: string): Promise<string> => {
    let normalized = newUrl.trim();
    if (normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
    }
    apiClient.defaults.baseURL = normalized;
    try {
        if (normalized && normalized !== appConfig.api.baseUrl) {
            await AsyncStorage.setItem(appConfig.storageKeys.apiBaseUrl, normalized);
        } else {
            await AsyncStorage.removeItem(appConfig.storageKeys.apiBaseUrl);
        }
    } catch (e) {
        console.warn("Failed to persist apiBaseUrl:", e);
    }
    return normalized;
};

// Initialize mobile API on startup
initMobileApi();

export { apiClient };
export default apiClient;
