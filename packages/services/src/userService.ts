import apiClient from "./api";
import type { User } from "@music-cloud/types";

export const userService = {
    getCurrentProfile: async (): Promise<User> => {
        const response = await apiClient.get<User>("/api/v1/users/me");
        return response.data;
    },

    heartbeat: async (): Promise<void> => {
        try {
            await apiClient.post("/api/v1/users/heartbeat");
        } catch {
            // Silently discard errors, don't interrupt client flow
        }
    },
};
