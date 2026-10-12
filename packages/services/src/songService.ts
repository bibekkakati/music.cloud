import apiClient from "./api";
import type {
    SongMetadata,
    StreamTokenResponse,
    SongDownloadUrlResponse,
} from "@music-cloud/types";

export const songService = {

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

    getDownloadUrl: async (
        songId: string,
    ): Promise<SongDownloadUrlResponse> => {
        const response = await apiClient.get<SongDownloadUrlResponse>(
            `/api/v1/song/${encodeURIComponent(songId)}/download-url`,
        );
        return response.data;
    },
};
