import apiClient, { getAuthStorageAdapter } from "./api";
import type { LoginPayload, SessionResponse } from "@music-cloud/types";

export const authService = {
    login: async (payload: LoginPayload): Promise<SessionResponse> => {
        const response = await apiClient.post<SessionResponse>(
            "/api/v1/auth/login",
            {
                login_data: payload,
            },
        );
        if (response.data.access_token) {
            await getAuthStorageAdapter().setToken(response.data.access_token);
        }
        return response.data;
    },

    logout: async (): Promise<void> => {
        try {
            await apiClient.post("/api/v1/auth/logout");
        } finally {
            await getAuthStorageAdapter().clearToken();
        }
    },

    refreshToken: async (): Promise<SessionResponse> => {
        const response = await apiClient.post<SessionResponse>(
            "/api/v1/auth/refresh",
        );
        if (response.data.access_token) {
            await getAuthStorageAdapter().setToken(response.data.access_token);
        }
        return response.data;
    },

    getToken: (): string | null => {
        const res = getAuthStorageAdapter().getToken();
        if (res instanceof Promise) {
            return null;
        }
        return res;
    },

    getTokenAsync: async (): Promise<string | null> => {
        return await getAuthStorageAdapter().getToken();
    },

    isAuthenticated: (): boolean => {
        const res = getAuthStorageAdapter().getToken();
        if (res instanceof Promise) {
            return false;
        }
        return !!res;
    },

    isAuthenticatedAsync: async (): Promise<boolean> => {
        const token = await getAuthStorageAdapter().getToken();
        return !!token;
    },
};
