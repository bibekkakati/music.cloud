import axios from "axios";
import apiClient from "./api";
import type {
    SongDetail,
    AdminSongListResponse,
    SongUploadResponse,
    SongProcessPayload,
    SongMetadataUpdatePayload,
    CoverArtUploadResponse,
} from "@music-cloud/types";

export interface GetUploadUrlParams {
    extension: string;
    content_type: string;
    title: string;
    artist: string;
}

export interface GetCoverArtUploadUrlParams {
    songId: string;
    extension: string;
    contentType: string;
}

export const adminService = {
    getUploadUrl: async (
        params: GetUploadUrlParams,
    ): Promise<SongUploadResponse> => {
        const response = await apiClient.get<SongUploadResponse>(
            "/api/v1/admin/song/upload/url",
            {
                params,
            },
        );
        return response.data;
    },

    uploadFileToPresignedUrl: async (
        presignedUrl: string,
        file: Blob | File | any,
        onProgress?: (percentage: number) => void,
    ): Promise<void> => {
        await axios.put(presignedUrl, file, {
            headers: {
                "Content-Type": file.type || "audio/mpeg",
            },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total && onProgress) {
                    const percent = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total,
                    );
                    onProgress(percent);
                }
            },
        });
    },

    processSong: async (payload: SongProcessPayload): Promise<void> => {
        await apiClient.post("/api/v1/admin/song/process", {
            payload: {
                song_id: payload.song_id,
                trim_start_sec: payload.trim_start_sec ?? 0,
            },
        });
    },

    getSongProcessStatus: async (
        songId: string,
    ): Promise<{ status: string }> => {
        const response = await apiClient.get<{ status: string }>(
            "/api/v1/admin/song/process/status",
            {
                params: { song_id: songId },
            },
        );
        return response.data;
    },

    getAllSongs: async (cursor?: string): Promise<AdminSongListResponse> => {
        const params: Record<string, string> = {};
        if (cursor && cursor !== "0") {
            params.cursor = cursor;
        }
        const response = await apiClient.get<AdminSongListResponse>(
            "/api/v1/admin/song/all",
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

    getSongById: async (songId: string): Promise<SongDetail> => {
        const response = await apiClient.get<SongDetail>(
            `/api/v1/admin/song/${songId}`,
        );
        return response.data;
    },

    updateSongMetadata: async (
        payload: SongMetadataUpdatePayload,
    ): Promise<SongDetail> => {
        const response = await apiClient.put<SongDetail>(
            "/api/v1/admin/song/metadata",
            {
                payload,
            },
        );
        return response.data;
    },

    updateSongVisibility: async (
        songId: string,
        isPublic: boolean,
    ): Promise<SongDetail> => {
        const response = await apiClient.put<SongDetail>(
            "/api/v1/admin/song/visibility",
            {
                payload: {
                    song_id: songId,
                    is_public: isPublic,
                },
            },
        );
        return response.data;
    },

    getCoverArtUploadUrl: async (
        params: GetCoverArtUploadUrlParams,
    ): Promise<CoverArtUploadResponse> => {
        const response = await apiClient.get<CoverArtUploadResponse>(
            `/api/v1/admin/song/${params.songId}/cover-art/upload-url`,
            {
                params: {
                    extension: params.extension,
                    content_type: params.contentType,
                },
            },
        );
        return response.data;
    },

    uploadCoverArtToPresignedUrl: async (
        presignedUrl: string,
        file: Blob | File | any,
        contentType?: string,
    ): Promise<void> => {
        await axios.put(presignedUrl, file, {
            headers: {
                "Content-Type": contentType || file.type || "image/jpeg",
            },
        });
    },

    updateSongCoverArt: async (
        songId: string,
        coverArtKey: string,
    ): Promise<SongDetail> => {
        const response = await apiClient.put<SongDetail>(
            `/api/v1/admin/song/${songId}/cover-art`,
            {
                payload: {
                    cover_art_key: coverArtKey,
                },
            },
        );
        return response.data;
    },
};
