import apiClient from '../api';
import type {
  PlaylistSummary,
  PlaylistDetail,
  CreatePlaylistPayload,
  UpdatePlaylistPayload,
  AddPlaylistSongPayload,
  PlaylistSongItem,
} from '../types';

export const playlistService = {
  getAllPlaylists: async (songId?: string): Promise<PlaylistSummary[]> => {
    const url = songId ? `/api/v1/playlist/all?song_id=${encodeURIComponent(songId)}` : '/api/v1/playlist/all';
    const response = await apiClient.get<PlaylistSummary[]>(url);
    return response.data;
  },

  createPlaylist: async (payload: CreatePlaylistPayload): Promise<PlaylistSummary> => {
    const response = await apiClient.post<PlaylistSummary>('/api/v1/playlist', payload);
    return response.data;
  },

  updatePlaylist: async (payload: UpdatePlaylistPayload): Promise<PlaylistSummary> => {
    const response = await apiClient.put<PlaylistSummary>('/api/v1/playlist', payload);
    return response.data;
  },

  removePlaylist: async (id: string): Promise<void> => {
    await apiClient.delete('/api/v1/playlist', {
      data: { id },
    });
  },

  getPlaylistSongs: async (playlistId: string): Promise<PlaylistDetail> => {
    const response = await apiClient.get<PlaylistDetail>(`/api/v1/playlist/${playlistId}/songs`);
    return response.data;
  },

  addSongToPlaylist: async (payload: AddPlaylistSongPayload): Promise<PlaylistSongItem> => {
    const response = await apiClient.post<PlaylistSongItem>('/api/v1/playlist/song/add', payload);
    return response.data;
  },

  removeSongFromPlaylist: async (playlistSongId: string): Promise<void> => {
    await apiClient.post('/api/v1/playlist/song/remove', {
      id: playlistSongId,
    });
  },

  removeSongFromPlaylistBySongId: async (playlistId: string, songId: string): Promise<void> => {
    await apiClient.post('/api/v1/playlist/song/remove-by-song', {
      playlist_id: playlistId,
      song_id: songId,
    });
  },

  toggleLikeSong: async (songId: string): Promise<{ liked: boolean; playlist_id: string; song_id: string }> => {
    const response = await apiClient.post<{ liked: boolean; playlist_id: string; song_id: string }>(
      '/api/v1/playlist/like/toggle',
      { song_id: songId }
    );
    return response.data;
  },

  getSongLikedStatus: async (songId: string): Promise<boolean> => {
    const response = await apiClient.get<{ liked: boolean }>(`/api/v1/playlist/like/status/${songId}`);
    return response.data.liked;
  },
};
