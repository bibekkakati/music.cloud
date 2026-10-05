import apiClient from '../api';
import type { SongMetadata } from '../types';

export const songService = {
  getAllSongs: async (cursor?: string): Promise<SongMetadata[]> => {
    const params: Record<string, string> = {};
    if (cursor && cursor !== '0') {
      params.cursor = cursor;
    }
    const response = await apiClient.get<SongMetadata[]>('/api/v1/song/all', {
      params,
    });
    return response.data;
  },

  searchSuggestions: async (query: string, limit = 20): Promise<SongMetadata[]> => {
    if (!query || query.trim().length <= 2) {
      return [];
    }
    const response = await apiClient.get<SongMetadata[]>('/api/v1/song/search/suggestions', {
      params: { q: query.trim(), limit },
    });
    return response.data;
  },
};
