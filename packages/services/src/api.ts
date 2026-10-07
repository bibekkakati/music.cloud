import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

export interface AuthStorageAdapter {
    getToken: () => string | null | Promise<string | null>;
    setToken: (token: string) => void | Promise<void>;
    clearToken: () => void | Promise<void>;
}

export interface ApiClientConfig {
    baseURL: string;
    storage: AuthStorageAdapter;
    onUnauthorized?: () => void;
}

// In-memory fallback if not yet initialized
let inMemoryToken: string | null = null;
const memoryStorageAdapter: AuthStorageAdapter = {
    getToken: () => inMemoryToken,
    setToken: (token: string) => {
        inMemoryToken = token;
    },
    clearToken: () => {
        inMemoryToken = null;
    },
};

let activeConfig: ApiClientConfig = {
    baseURL: "",
    storage: memoryStorageAdapter,
};

export const apiClient: AxiosInstance = axios.create({
    baseURL: "",
    headers: {
        "Content-Type": "application/json",
    },
});

export const initApiClient = (config: ApiClientConfig): void => {
    activeConfig = config;
    apiClient.defaults.baseURL = config.baseURL;
};

export const getAuthStorageAdapter = (): AuthStorageAdapter => {
    return activeConfig.storage;
};

// Request interceptor to attach Bearer token via storage adapter
apiClient.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        try {
            const token = await activeConfig.storage.getToken();
            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch {
            // Storage retrieval errors should not crash the request
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// Response interceptor to handle 401 Unauthorized via adapter and callback
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            try {
                await activeConfig.storage.clearToken();
            } catch {
                // Ignore clearing error
            }
            if (activeConfig.onUnauthorized) {
                activeConfig.onUnauthorized();
            }
        }
        return Promise.reject(error);
    },
);

export default apiClient;
