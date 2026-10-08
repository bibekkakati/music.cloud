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
};

// Dynamic update of API baseURL (e.g., from dev settings in AuthModal)
export const updateApiBaseUrl = (newUrl: string) => {
    apiClient.defaults.baseURL = newUrl;
};

// Initialize mobile API on startup
initMobileApi();

export { apiClient };
export default apiClient;
