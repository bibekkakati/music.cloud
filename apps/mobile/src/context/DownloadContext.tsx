import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
} from "react";
import type { SongMetadata } from "@music-cloud/types";
import { downloadService, type DownloadedSong } from "../services/downloadService";

interface DownloadContextValue {
    downloadedSongIds: Set<string>;
    downloadsCount: number;
    downloadingSongIds: Set<string>;
    isDownloaded: (songId: string) => boolean;
    isDownloading: (songId: string) => boolean;
    downloadSong: (song: SongMetadata) => Promise<DownloadedSong>;
    deleteDownloadedSong: (songId: string) => Promise<void>;
    refreshDownloads: () => Promise<void>;
}

const DownloadContext = createContext<DownloadContextValue | undefined>(undefined);

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [downloadedSongIds, setDownloadedSongIds] = useState<Set<string>>(new Set());
    const [downloadsCount, setDownloadsCount] = useState<number>(0);
    const [downloadingSongIds, setDownloadingSongIds] = useState<Set<string>>(new Set());

    const refreshDownloads = useCallback(async () => {
        try {
            const all = await downloadService.getAllDownloadedSongs();
            setDownloadedSongIds(new Set(all.map((s) => s.id)));
            setDownloadsCount(all.length);
        } catch (err) {
            console.warn("Failed to refresh downloads:", err);
        }
    }, []);

    useEffect(() => {
        refreshDownloads();
        // Subscribe to changes in downloadService (e.g. download started/finished, deleted)
        const unsubscribe = downloadService.subscribe(() => {
            refreshDownloads();
        });
        return () => {
            unsubscribe();
        };
    }, [refreshDownloads]);

    const isDownloaded = useCallback(
        (songId: string) => downloadedSongIds.has(String(songId)),
        [downloadedSongIds],
    );

    const isDownloading = useCallback(
        (songId: string) => downloadingSongIds.has(String(songId)),
        [downloadingSongIds],
    );

    const downloadSong = useCallback(
        async (song: SongMetadata): Promise<DownloadedSong> => {
            const songId = String(song.id);
            setDownloadingSongIds((prev) => new Set(prev).add(songId));
            try {
                const result = await downloadService.downloadSong(song);
                await refreshDownloads();
                return result;
            } finally {
                setDownloadingSongIds((prev) => {
                    const next = new Set(prev);
                    next.delete(songId);
                    return next;
                });
            }
        },
        [refreshDownloads],
    );

    const deleteDownloadedSong = useCallback(
        async (songId: string): Promise<void> => {
            await downloadService.deleteDownloadedSong(songId);
            await refreshDownloads();
        },
        [refreshDownloads],
    );

    return (
        <DownloadContext.Provider
            value={{
                downloadedSongIds,
                downloadsCount,
                downloadingSongIds,
                isDownloaded,
                isDownloading,
                downloadSong,
                deleteDownloadedSong,
                refreshDownloads,
            }}
        >
            {children}
        </DownloadContext.Provider>
    );
};

export const useDownload = (): DownloadContextValue => {
    const context = useContext(DownloadContext);
    if (!context) {
        throw new Error("useDownload must be used within a DownloadProvider");
    }
    return context;
};
