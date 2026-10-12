import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import type { SongMetadata } from "@music-cloud/types";
import { songService } from "@music-cloud/services";

export interface DownloadedSong {
    id: string;
    title: string;
    artist: string;
    duration_sec: number;
    album: string | null;
    year: number | null;
    cover_art_url: string | null;
    local_audio_path: string;
    local_cover_path: string | null;
    file_size: number | null;
    created_at: string;
}

type DownloadListener = () => void;

class DownloadService {
    private dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
    private listeners: Set<DownloadListener> = new Set();
    private activeDownloads: Map<string, FileSystem.DownloadResumable> = new Map();

    private getDb(): Promise<SQLite.SQLiteDatabase> {
        if (!this.dbPromise) {
            this.dbPromise = (async () => {
                const db = await SQLite.openDatabaseAsync("music_cloud_downloads.db");
                await db.execAsync(`
                    PRAGMA journal_mode = WAL;
                    CREATE TABLE IF NOT EXISTS downloaded_songs (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        artist TEXT NOT NULL,
                        duration_sec INTEGER,
                        album TEXT,
                        year INTEGER,
                        cover_art_url TEXT,
                        local_audio_path TEXT NOT NULL,
                        local_cover_path TEXT,
                        file_size INTEGER,
                        created_at TEXT NOT NULL
                    );
                `);
                return db;
            })();
        }
        return this.dbPromise;
    }

    public subscribe(listener: DownloadListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(): void {
        this.listeners.forEach((listener) => {
            try {
                listener();
            } catch (err) {
                console.warn("Download listener error:", err);
            }
        });
    }

    public resolveLocalPath(storedPath: string): string {
        if (!storedPath) return storedPath;
        if (storedPath.includes("downloads/")) {
            const relativePart = storedPath.substring(storedPath.indexOf("downloads/"));
            return `${FileSystem.documentDirectory}${relativePart}`;
        }
        return storedPath.startsWith("file://") ? storedPath : `file://${storedPath}`;
    }

    public async isSongDownloaded(songId: string): Promise<boolean> {
        if (!songId) return false;
        try {
            const db = await this.getDb();
            const idStr = String(songId).trim().toLowerCase();
            const row = await db.getFirstAsync<{ id: string; local_audio_path: string }>(
                "SELECT id, local_audio_path FROM downloaded_songs WHERE LOWER(TRIM(id)) = ? LIMIT 1",
                [idStr],
            );
            if (!row) return false;
            const resolvedPath = this.resolveLocalPath(row.local_audio_path);
            const fileInfo = await FileSystem.getInfoAsync(resolvedPath).catch(() => ({ exists: false }));
            return Boolean(fileInfo.exists);
        } catch (err) {
            console.warn("isSongDownloaded check error:", err);
            return false;
        }
    }

    public async getDownloadedSong(songId: string): Promise<DownloadedSong | null> {
        if (!songId) return null;
        try {
            const db = await this.getDb();
            const idStr = String(songId).trim().toLowerCase();
            const row = await db.getFirstAsync<DownloadedSong>(
                "SELECT * FROM downloaded_songs WHERE LOWER(TRIM(id)) = ? LIMIT 1",
                [idStr],
            );
            if (!row) return null;

            const resolvedAudioPath = this.resolveLocalPath(row.local_audio_path);
            const fileInfo = await FileSystem.getInfoAsync(resolvedAudioPath).catch(() => ({ exists: false }));
            if (!fileInfo.exists) {
                console.warn(`Downloaded file not found on disk: ${resolvedAudioPath}`);
                return null;
            }

            const resolvedCoverPath = row.local_cover_path
                ? this.resolveLocalPath(row.local_cover_path)
                : null;

            return {
                ...row,
                local_audio_path: resolvedAudioPath,
                local_cover_path: resolvedCoverPath,
            };
        } catch (err) {
            console.warn("getDownloadedSong error:", err);
            return null;
        }
    }

    public async getAllDownloadedSongs(): Promise<DownloadedSong[]> {
        try {
            const db = await this.getDb();
            const rows = await db.getAllAsync<DownloadedSong>(
                "SELECT * FROM downloaded_songs ORDER BY created_at DESC",
            );
            if (!rows) return [];
            return rows.map((row) => ({
                ...row,
                local_audio_path: this.resolveLocalPath(row.local_audio_path),
                local_cover_path: row.local_cover_path
                    ? this.resolveLocalPath(row.local_cover_path)
                    : null,
            }));
        } catch (err) {
            console.warn("getAllDownloadedSongs error:", err);
            return [];
        }
    }

    public async getDownloadedSongsCount(): Promise<number> {
        try {
            const db = await this.getDb();
            const row = await db.getFirstAsync<{ count: number }>(
                "SELECT COUNT(*) as count FROM downloaded_songs",
            );
            return row?.count ?? 0;
        } catch (err) {
            console.warn("getDownloadedSongsCount error:", err);
            return 0;
        }
    }

    public isDownloading(songId: string): boolean {
        return this.activeDownloads.has(songId);
    }

    public async downloadSong(
        song: SongMetadata,
        onProgress?: (progressFraction: number) => void,
    ): Promise<DownloadedSong> {
        const songId = String(song.id);

        // 1. Prevent duplicate download
        const alreadyDownloaded = await this.isSongDownloaded(songId);
        if (alreadyDownloaded) {
            const existing = await this.getDownloadedSong(songId);
            if (existing) return existing;
        }

        if (this.activeDownloads.has(songId)) {
            throw new Error("Download is already in progress.");
        }

        // 2. Fetch pre-signed download URL from backend
        const downloadInfo = await songService.getDownloadUrl(songId);
        if (!downloadInfo?.url) {
            throw new Error("Failed to obtain download URL from server.");
        }

        // 3. Ensure audio directory exists
        const downloadsDir = `${FileSystem.documentDirectory}downloads/`;
        const audioDir = `${downloadsDir}audio/`;
        const coversDir = `${downloadsDir}covers/`;

        await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true }).catch(() => {});
        await FileSystem.makeDirectoryAsync(coversDir, { intermediates: true }).catch(() => {});

        // Extract extension or default to .m4a/.mp3
        const key = downloadInfo.key || "";
        const ext = key.includes(".") ? key.split(".").pop() : "mp3";
        const localAudioPath = `${audioDir}${songId}.${ext}`;

        // 4. Download audio file
        const downloadResumable = FileSystem.createDownloadResumable(
            downloadInfo.url,
            localAudioPath,
            {},
            (downloadProgress) => {
                if (downloadProgress.totalBytesExpectedToWrite > 0 && onProgress) {
                    const fraction =
                        downloadProgress.totalBytesWritten /
                        downloadProgress.totalBytesExpectedToWrite;
                    onProgress(fraction);
                }
            },
        );

        this.activeDownloads.set(songId, downloadResumable);
        this.notifyListeners();

        try {
            const result = await downloadResumable.downloadAsync();
            if (!result || result.status < 200 || result.status >= 300) {
                throw new Error(`Failed to download audio file. HTTP status: ${result?.status}`);
            }

            // 5. Optionally cache cover image locally if available
            let localCoverPath: string | null = null;
            if (song.cover_art_url && song.cover_art_url.startsWith("http")) {
                try {
                    const coverPath = `${coversDir}${songId}.jpg`;
                    const coverResult = await FileSystem.downloadAsync(
                        song.cover_art_url,
                        coverPath,
                    );
                    if (coverResult?.status === 200) {
                        localCoverPath = coverResult.uri;
                    }
                } catch {
                    // Non-fatal if cover fails to download
                }
            }

            // Get file size
            let fileSize: number | null = null;
            try {
                const info = await FileSystem.getInfoAsync(result.uri);
                if (info.exists && "size" in info) {
                    fileSize = info.size ?? null;
                }
            } catch {}

            // 6. Save in SQLite with UNIQUE constraint
            const db = await this.getDb();
            const now = new Date().toISOString();
            await db.runAsync(
                `INSERT OR REPLACE INTO downloaded_songs (
                    id, title, artist, duration_sec, album, year,
                    cover_art_url, local_audio_path, local_cover_path, file_size, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    songId,
                    song.title || "Unknown Title",
                    song.artist || "Unknown Artist",
                    song.duration_sec ?? 0,
                    song.album ?? null,
                    song.year ?? null,
                    song.cover_art_url ?? null,
                    result.uri,
                    localCoverPath,
                    fileSize,
                    now,
                ],
            );

            const record: DownloadedSong = {
                id: songId,
                title: song.title || "Unknown Title",
                artist: song.artist || "Unknown Artist",
                duration_sec: song.duration_sec ?? 0,
                album: song.album ?? null,
                year: song.year ?? null,
                cover_art_url: song.cover_art_url ?? null,
                local_audio_path: result.uri,
                local_cover_path: localCoverPath,
                file_size: fileSize,
                created_at: now,
            };

            return record;
        } finally {
            this.activeDownloads.delete(songId);
            this.notifyListeners();
        }
    }

    public async deleteDownloadedSong(songId: string): Promise<void> {
        const idStr = String(songId);
        try {
            const db = await this.getDb();
            const song = await this.getDownloadedSong(idStr);

            if (song) {
                // Delete audio file
                if (song.local_audio_path) {
                    await FileSystem.deleteAsync(song.local_audio_path, {
                        idempotent: true,
                    }).catch(() => {});
                }
                // Delete cover file
                if (song.local_cover_path) {
                    await FileSystem.deleteAsync(song.local_cover_path, {
                        idempotent: true,
                    }).catch(() => {});
                }
            }

            // Remove from SQLite
            await db.runAsync("DELETE FROM downloaded_songs WHERE id = ?", [idStr]);
        } catch (err) {
            console.warn("Failed to delete downloaded song:", err);
            throw err;
        } finally {
            this.notifyListeners();
        }
    }
}

export const downloadService = new DownloadService();
