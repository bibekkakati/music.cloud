import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { adminService } from "../../services/adminService";
import type { SongDetail } from "../../types";
import { useToast } from "../../context/ToastContext";
import { usePlayer } from "../../context/PlayerContext";

import { AdminCatalogTable } from "../../components/admin/AdminCatalogTable";
import { AdminSongInspectorModal } from "../../components/admin/AdminSongInspectorModal";
import { AdminSongEditModal } from "../../components/admin/AdminSongEditModal";
import { appConfig } from "../../config";

export const AdminCatalogPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { playSong } = usePlayer();

    // URL Search Parameters
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const selectedStatus = (searchParams.get("status") || "ALL").toUpperCase();
    const urlCursor = searchParams.get("cursor") || undefined;

    // --- Catalog State & Cursors ---
    const [songs, setSongs] = useState<SongDetail[]>([]);
    const [loadingSongs, setLoadingSongs] = useState(false);
    const [pageCursors, setPageCursors] = useState<{
        [page: number]: string | undefined;
    }>({
        1: undefined,
        ...(urlCursor && currentPage > 1 ? { [currentPage]: urlCursor } : {}),
    });
    const [hasNextPage, setHasNextPage] = useState<boolean>(false);
    const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);

    // Track in-flight row operations
    const [refreshingSongIds, setRefreshingSongIds] = useState<Set<string>>(
        new Set(),
    );
    const [reprocessingSongIds, setReprocessingSongIds] = useState<Set<string>>(
        new Set(),
    );
    const [resyncingSongIds, setResyncingSongIds] = useState<Set<string>>(
        new Set(),
    );

    // --- Modals State ---
    const [inspectingSong, setInspectingSong] = useState<SongDetail | null>(
        null,
    );
    const [editingSong, setEditingSong] = useState<SongDetail | null>(null);

    // Fetch Catalog Page
    const fetchCatalog = useCallback(
        async (page: number, cursor?: string, statusFilter?: string) => {
            try {
                setLoadingSongs(true);
                const filter = statusFilter !== undefined ? statusFilter : selectedStatus;
                const data = await adminService.getAllSongs(
                    appConfig.songs_limit,
                    cursor,
                    filter,
                );
                const songList = data?.songs || [];
                setSongs(songList);
                const nextCursor = data?.cursor;
                const hasNext =
                    typeof nextCursor === "string" && nextCursor.trim() !== "";
                setHasNextPage(hasNext);

                // Cache next cursor for page + 1
                if (hasNext && nextCursor) {
                    setPageCursors((prev) => ({
                        ...prev,
                        [page + 1]: nextCursor.trim(),
                    }));
                }
            } catch (err: unknown) {
                const msg =
                    (err as { response?: { data?: { detail?: string } } })
                        ?.response?.data?.detail || "Failed to load catalog page";
                showToast("Catalog Error", "error", msg);
            } finally {
                setLoadingSongs(false);
            }
        },
        [selectedStatus, showToast],
    );

    // Sync with URL changes
    useEffect(() => {
        const cursorToUse = pageCursors[currentPage] || urlCursor;
        fetchCatalog(currentPage, cursorToUse, selectedStatus);
    }, [currentPage, selectedStatus]); // eslint-disable-line react-hooks/exhaustive-deps

    // Status Filter Handler -> Resets to page 1 with new status in URL
    const handleStatusFilterChange = (newStatus: string) => {
        const updatedStatus = newStatus.toUpperCase();
        setPageCursors({ 1: undefined });
        const params: Record<string, string> = {
            page: "1",
            status: updatedStatus,
        };
        setSearchParams(params);
    };

    // Next Page Handler
    const handleNextPage = () => {
        if (!hasNextPage || loadingSongs) return;
        const nextPage = currentPage + 1;
        const nextCursor = pageCursors[nextPage];

        const params: Record<string, string> = {
            page: String(nextPage),
            status: selectedStatus,
        };
        if (nextCursor) {
            params.cursor = nextCursor;
        }
        setSearchParams(params);
    };

    // Previous Page Handler
    const handlePrevPage = () => {
        if (currentPage <= 1 || loadingSongs) return;
        const prevPage = currentPage - 1;
        const prevCursor = pageCursors[prevPage];

        const params: Record<string, string> = {
            page: String(prevPage),
            status: selectedStatus,
        };
        if (prevCursor) {
            params.cursor = prevCursor;
        }
        setSearchParams(params);
    };

    // Manual Refresh
    const handleRefreshCurrentPage = async () => {
        if (isRefreshingCatalog || loadingSongs) return;
        setIsRefreshingCatalog(true);
        const startTime = Date.now();
        try {
            const curCursor = pageCursors[currentPage] || urlCursor;
            await fetchCatalog(currentPage, curCursor, selectedStatus);
        } finally {
            const elapsed = Date.now() - startTime;
            if (elapsed < 500) {
                await new Promise((resolve) =>
                    setTimeout(resolve, 500 - elapsed),
                );
            }
            setIsRefreshingCatalog(false);
        }
    };

    // Refresh Song Processing Status (single row)
    const handleRefreshSongStatus = async (songId: string) => {
        if (refreshingSongIds.has(songId)) return;
        const startTime = Date.now();
        try {
            setRefreshingSongIds((prev) => new Set(prev).add(songId));
            const res = await adminService.getSongProcessStatus(songId);
            const updatedStatus = res.status;

            setSongs((prev) =>
                prev.map((s) =>
                    s.id === songId ? { ...s, status: updatedStatus } : s,
                ),
            );

            if (updatedStatus?.toUpperCase() === "DONE") {
                try {
                    const fullSong = await adminService.getSongById(songId);
                    setSongs((prev) =>
                        prev.map((s) => (s.id === songId ? fullSong : s)),
                    );
                } catch {
                    // ignore
                }
            }
        } catch (err: unknown) {
            console.error("Failed to refresh song status:", err);
        } finally {
            const elapsed = Date.now() - startTime;
            if (elapsed < 500) {
                await new Promise((resolve) =>
                    setTimeout(resolve, 500 - elapsed),
                );
            }
            setRefreshingSongIds((prev) => {
                const next = new Set(prev);
                next.delete(songId);
                return next;
            });
        }
    };

    // Reprocess Song
    const handleReprocessSong = async (song: SongDetail) => {
        const input = window.prompt(
            `Reprocess "${song.title}"\n\nEnter trim start seconds:`,
            "0",
        );
        if (input === null) return;

        const trimSec = parseFloat(input.trim());
        if (isNaN(trimSec) || trimSec < 0) {
            showToast(
                "Invalid Input",
                "error",
                "Trim start seconds must be a positive number or 0.",
            );
            return;
        }

        try {
            setReprocessingSongIds((prev) => new Set(prev).add(song.id));
            await adminService.processSong({
                song_id: song.id,
                trim_start_sec: trimSec,
            });

            setSongs((prev) =>
                prev.map((s) =>
                    s.id === song.id ? { ...s, status: "UPLOADED" } : s,
                ),
            );

            showToast(
                "Processing Triggered",
                "success",
                `Reprocessing queued for "${song.title}" (trim: ${trimSec}s)`,
            );
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to trigger reprocessing";
            showToast("Reprocess Failed", "error", msg);
        } finally {
            setReprocessingSongIds((prev) => {
                const next = new Set(prev);
                next.delete(song.id);
                return next;
            });
        }
    };

    // Delete Song
    const handleDeleteSong = async (song: SongDetail) => {
        if (
            !window.confirm(
                `Are you sure you want to delete "${song.title}"? This cannot be undone.`,
            )
        ) {
            return;
        }

        try {
            await adminService.deleteSong(song.id);
            showToast("Track Deleted", "success", `Deleted "${song.title}".`);
            setSongs((prev) => prev.filter((s) => s.id !== song.id));
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to delete song";
            showToast("Delete Failed", "error", msg);
        }
    };

    // Resync Properties (Genre, Moods, Language)
    const handleSyncProperties = async (song: SongDetail) => {
        try {
            setResyncingSongIds((prev) => new Set(prev).add(song.id));
            const updated = await adminService.syncSongProperties(song.id);
            setSongs((prev) =>
                prev.map((s) => (s.id === song.id ? { ...s, ...updated } : s)),
            );
            showToast(
                "Properties Synchronized",
                "success",
                `Updated tags for "${song.title}".`,
            );
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to sync song properties";
            showToast("Sync Failed", "error", msg);
        } finally {
            setResyncingSongIds((prev) => {
                const next = new Set(prev);
                next.delete(song.id);
                return next;
            });
        }
    };

    // Save Edited Metadata
    const handleSaveMetadata = async (
        songId: string,
        title: string,
        artist: string,
        isPublic: boolean,
        coverArtKey?: string,
    ) => {
        try {
            const updated = await adminService.updateSongMetadata({
                song_id: songId,
                title,
                artist,
                is_public: isPublic,
                cover_art_key: coverArtKey,
            });

            showToast(
                "Metadata Updated",
                "success",
                `Updated "${updated.title}"`,
            );
            setEditingSong(null);

            setSongs((prev) =>
                prev.map((s) =>
                    s.id === updated.id ? { ...s, ...updated } : s,
                ),
            );
            if (inspectingSong?.id === updated.id) {
                setInspectingSong((prev) =>
                    prev ? { ...prev, ...updated } : null,
                );
            }
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to update metadata";
            showToast("Error", "error", msg);
            throw err;
        }
    };

    return (
        <div className="admin-page-container">
            {/* Catalog Table */}
            <AdminCatalogTable
                songs={songs}
                loadingSongs={loadingSongs}
                refreshingSongIds={refreshingSongIds}
                reprocessingSongIds={reprocessingSongIds}
                resyncingSongIds={resyncingSongIds}
                currentPage={currentPage}
                hasNextPage={hasNextPage}
                selectedStatus={selectedStatus}
                onStatusChange={handleStatusFilterChange}
                onPlaySong={playSong}
                onInspectSong={setInspectingSong}
                onEditSong={setEditingSong}
                onReprocessSong={handleReprocessSong}
                onRefreshSongStatus={handleRefreshSongStatus}
                onDeleteSong={handleDeleteSong}
                onSyncProperties={handleSyncProperties}
                onNextPage={handleNextPage}
                onPrevPage={handlePrevPage}
                onSwitchToUpload={() => navigate("/admin/upload")}
                onRefresh={handleRefreshCurrentPage}
                isRefreshing={isRefreshingCatalog}
            />

            {/* Modals */}
            <AdminSongInspectorModal
                song={inspectingSong}
                onClose={() => setInspectingSong(null)}
            />

            <AdminSongEditModal
                song={editingSong}
                onClose={() => setEditingSong(null)}
                onSave={handleSaveMetadata}
            />
        </div>
    );
};
