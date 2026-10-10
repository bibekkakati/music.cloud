import apiClient from "./api";
import type {
    SongMetadata,
    SongListResponse,
    StreamTokenResponse,
} from "@music-cloud/types";

export const songService = {
    getAllSongs: async (cursor?: string): Promise<SongListResponse> => {
        const params: Record<string, string> = {};
        if (cursor && cursor !== "0") {
            params.cursor = cursor;
        }
        const response = await apiClient.get<SongListResponse>(
            "/api/v1/song/all",
            {
                params,
            },
        );
        const data = response.data;
        if (Array.isArray(data)) {
            return { songs: data, cursor: null };
        }
        return {
            songs: data?.songs || [],
            cursor: data?.cursor ?? null,
        };
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
