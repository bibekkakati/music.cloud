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

export interface PresignedUploadOptions {
    signal?: AbortSignal;
    maxRetries?: number;
    onRetry?: (attempt: number, maxRetries: number, error: unknown) => void;
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
        options?: PresignedUploadOptions,
    ): Promise<void> => {
        const maxRetries = options?.maxRetries ?? 5;
        let attempt = 0;

        while (true) {
            try {
                await axios.put(presignedUrl, file, {
                    headers: {
                        "Content-Type": file.type || "audio/mpeg",
                    },
                    signal: options?.signal,
                    onUploadProgress: (progressEvent) => {
                        if (progressEvent.total && onProgress) {
                            const percent = Math.round(
                                (progressEvent.loaded * 100) / progressEvent.total,
                            );
                            onProgress(percent);
                        }
                    },
                });
                return;
            } catch (err: unknown) {
                // If cancelled by AbortSignal, throw immediately without retrying
                if (axios.isCancel(err) || options?.signal?.aborted) {
                    throw err;
                }

                attempt++;
                if (attempt > maxRetries) {
                    throw err;
                }

                // Notify retry callback so UI can show retry message
                options?.onRetry?.(attempt, maxRetries, err);

                // If browser reports offline, wait for the 'online' event (with fallback timeout)
                if (
                    typeof window !== "undefined" &&
                    typeof navigator !== "undefined" &&
                    !navigator.onLine
                ) {
                    await new Promise<void>((resolve) => {
                        let timeoutId: any;
                        const handleOnline = () => {
                            window.removeEventListener("online", handleOnline);
                            clearTimeout(timeoutId);
                            // Short grace period for network connectivity to stabilize
                            setTimeout(resolve, 1000);
                        };
                        window.addEventListener("online", handleOnline);
                        timeoutId = setTimeout(() => {
                            window.removeEventListener("online", handleOnline);
                            resolve();
                        }, 20000);
                    });
                } else {
                    // Exponential backoff: 2s, 4s, 8s, 10s...
                    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
    },

    deleteSong: async (songId: string): Promise<void> => {
        await apiClient.delete(`/api/v1/admin/song/${songId}`);
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

    getAllSongs: async (
        limit: number,
        cursor?: string,
        status?: string,
    ): Promise<AdminSongListResponse> => {
        const params: Record<string, string> = {
            limit: limit.toString(),
        };

        if (cursor) {
            params.cursor = cursor;
        }
        if (status && status.trim() && status.toUpperCase() !== "ALL") {
            params.status = status.toLowerCase().trim();
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

    syncSongProperties: async (songId: string): Promise<SongDetail> => {
        const response = await apiClient.post<SongDetail>(
            `/api/v1/admin/song/${songId}/sync-properties`,
        );
        return response.data;
    },

    rebuildSearchIndex: async (): Promise<{ message: string; total_indexed: number }> => {
        const response = await apiClient.post<{ message: string; total_indexed: number }>(
            "/api/v1/admin/song/search/rebuild",
        );
        return response.data;
    },
};

