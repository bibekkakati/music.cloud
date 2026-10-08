import apiClient from "./api";
import type { SongMetadata, StreamTokenResponse } from "@music-cloud/types";

export const songService = {
    getAllSongs: async (cursor?: string): Promise<SongMetadata[]> => {
        const params: Record<string, string> = {};
        if (cursor && cursor !== "0") {
            params.cursor = cursor;
        }
        const response = await apiClient.get<SongMetadata[]>(
            "/api/v1/song/all",
            {
                params,
            },
        );
        return response.data;
    },

    searchSuggestions: async (
        query: string,
        limit = 20,
    ): Promise<SongMetadata[]> => {
        if (!query || query.trim().length <= 2) {
            return [];
        }
        const response = await apiClient.get<SongMetadata[]>(
            "/api/v1/song/search/suggestions",
            {
                params: { q: query.trim(), limit },
            },
        );
        return response.data;
    },

    getSongById: async (songId: string): Promise<SongMetadata> => {
        const response = await apiClient.get<SongMetadata>(
            `/api/v1/song/${encodeURIComponent(songId)}`,
        );
        return response.data;
    },

    getStreamToken: async (): Promise<StreamTokenResponse> => {
        const response = await apiClient.get<StreamTokenResponse>(
            "/api/v1/song/stream/token",
        );
        return response.data;
    },
};
