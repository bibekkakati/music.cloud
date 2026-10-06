import React, { useState, useEffect, useCallback } from "react";
import { adminService } from "../../services/adminService";
import type { SongDetail } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { usePlayer } from "../../context/PlayerContext";
import { Radio, RefreshCw, Upload, Layers, Loader2 } from "lucide-react";

import { AdminAccessDenied } from "../../components/admin/AdminAccessDenied";
import { AdminUploadPanel } from "../../components/admin/AdminUploadPanel";
import { AdminCatalogTable } from "../../components/admin/AdminCatalogTable";
import { AdminSongInspectorModal } from "../../components/admin/AdminSongInspectorModal";
import { AdminSongEditModal } from "../../components/admin/AdminSongEditModal";

export const AdminPage: React.FC = () => {
    const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
    const { showToast } = useToast();
    const { playSong } = usePlayer();

    // Active Tab
    const [activeTab, setActiveTab] = useState<"upload" | "catalog">("upload");

    // --- Catalog State & Bounded Pagination ---
    const PAGE_SIZE = 20;
    const [songs, setSongs] = useState<SongDetail[]>([]);
    const [loadingSongs, setLoadingSongs] = useState(false);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageCursors, setPageCursors] = useState<{ [page: number]: string | undefined }>({
        1: undefined,
    });
    const [hasNextPage, setHasNextPage] = useState<boolean>(false);
    const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);

    // Track in-flight row operations
    const [refreshingSongIds, setRefreshingSongIds] = useState<Set<string>>(new Set());
    const [reprocessingSongIds, setReprocessingSongIds] = useState<Set<string>>(new Set());
    const [togglingVisibilityIds, setTogglingVisibilityIds] = useState<Set<string>>(new Set());

    // --- Modals State ---
    const [inspectingSong, setInspectingSong] = useState<SongDetail | null>(null);
    const [editingSong, setEditingSong] = useState<SongDetail | null>(null);

    // Load Catalog Page
    const fetchCatalogPage = useCallback(
        async (page: number, cursor?: string) => {
            try {
                setLoadingSongs(true);
                const data = await adminService.getAllSongs(cursor);
                setSongs(data);
                const hasNext = data.length >= PAGE_SIZE;
                setHasNextPage(hasNext);
                setCurrentPage(page);

                // If this page returned a full batch, cache the cursor for page + 1
                if (hasNext && data.length > 0) {
                    const nextCursor = data[data.length - 1].id;
                    setPageCursors((prev) => ({ ...prev, [page + 1]: nextCursor }));
                }
            } catch (err: unknown) {
                const msg =
                    (err as { response?: { data?: { detail?: string } } })?.response
                        ?.data?.detail || "Failed to load catalog page";
                showToast("Catalog Error", "error", msg);
            } finally {
                setLoadingSongs(false);
            }
        },
        [showToast],
    );

    const handleNextPage = () => {
        if (!hasNextPage || loadingSongs) return;
        const nextPage = currentPage + 1;
        const nextCursor = pageCursors[nextPage];
        fetchCatalogPage(nextPage, nextCursor);
    };

    const handlePrevPage = () => {
        if (currentPage <= 1 || loadingSongs) return;
        const prevPage = currentPage - 1;
        const prevCursor = pageCursors[prevPage];
        fetchCatalogPage(prevPage, prevCursor);
    };

    const handleRefreshCurrentPage = async () => {
        if (isRefreshingCatalog || loadingSongs) return;
        setIsRefreshingCatalog(true);
        const startTime = Date.now();
        try {
            const curCursor = pageCursors[currentPage];
            await fetchCatalogPage(currentPage, curCursor);
        } finally {
            const elapsed = Date.now() - startTime;
            if (elapsed < 500) {
                await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
            }
            setIsRefreshingCatalog(false);
        }
    };

    const handleResetToFirstPage = () => {
        setPageCursors({ 1: undefined });
        fetchCatalogPage(1, undefined);
    };

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            fetchCatalogPage(1, undefined);
        }
    }, [isAuthenticated, isAdmin, fetchCatalogPage]);

    // Refresh Song Processing Status (single row)
    const handleRefreshSongStatus = async (songId: string) => {
        if (refreshingSongIds.has(songId)) return;
        const startTime = Date.now();
        try {
            setRefreshingSongIds((prev) => new Set(prev).add(songId));
            const res = await adminService.getSongProcessStatus(songId);
            const updatedStatus = res.status;

            setSongs((prev) =>
                prev.map((s) => (s.id === songId ? { ...s, status: updatedStatus } : s)),
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
                await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
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
        if (input === null) return; // User pressed Cancel

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

            // Optimistically update song status in the list
            setSongs((prev) =>
                prev.map((s) => (s.id === song.id ? { ...s, status: "UPLOADED" } : s)),
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

            showToast("Metadata Updated", "success", `Updated "${updated.title}"`);
            setEditingSong(null);

            setSongs((prev) =>
                prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
            );
            if (inspectingSong?.id === updated.id) {
                setInspectingSong((prev) => (prev ? { ...prev, ...updated } : null));
            }
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to update metadata";
            showToast("Error", "error", msg);
            throw err;
        }
    };

    // Toggle Song Visibility (Public / Private)
    const handleToggleVisibility = async (song: SongDetail) => {
        const nextIsPublic = song.is_public === false ? true : false;
        setTogglingVisibilityIds((prev) => new Set(prev).add(song.id));
        try {
            const updated = await adminService.updateSongVisibility(song.id, nextIsPublic);
            setSongs((prev) =>
                prev.map((s) =>
                    s.id === song.id ? { ...s, ...updated, is_public: updated.is_public } : s,
                ),
            );
            if (inspectingSong?.id === song.id) {
                setInspectingSong((prev) =>
                    prev ? { ...prev, ...updated, is_public: updated.is_public } : null,
                );
            }
            showToast(
                nextIsPublic ? "Song is now Public" : "Song is now Private",
                "success",
                `"${song.title}" is ${
                    nextIsPublic ? "visible to normal users" : "hidden from normal users"
                }`,
            );
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to update song visibility";
            showToast("Error", "error", msg);
        } finally {
            setTogglingVisibilityIds((prev) => {
                const next = new Set(prev);
                next.delete(song.id);
                return next;
            });
        }
    };

    if (isLoading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "65vh",
                }}
            >
                <Loader2 size={36} className="animate-spin" color="var(--app-green)" />
            </div>
        );
    }

    if (!isAuthenticated || !isAdmin) {
        return (
            <AdminAccessDenied
                userEmail={user?.email}
                isAuthenticated={isAuthenticated}
            />
        );
    }

    return (
        <div className="admin-page-container">
            {/* Header */}
            <div className="admin-header-row">
                <div>
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: "var(--app-green)",
                            letterSpacing: "0.06em",
                            marginBottom: 4,
                        }}
                    >
                        <Radio size={14} color="var(--app-green)" />
                        <span>Admin Console</span>
                    </div>
                    <h1
                        style={{
                            fontSize: 28,
                            fontWeight: 800,
                            color: "var(--app-text)",
                        }}
                    >
                        Song Management & Ingestion
                    </h1>
                </div>

                {/* Tab Switcher & Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {activeTab === "catalog" && (
                        <button
                            type="button"
                            onClick={handleRefreshCurrentPage}
                            disabled={isRefreshingCatalog || loadingSongs}
                            className="app-tag-pill"
                            style={{
                                padding: "8px 16px",
                                fontSize: 13,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                background: "rgba(255, 255, 255, 0.08)",
                                color: "var(--app-text)",
                                cursor:
                                    isRefreshingCatalog || loadingSongs
                                        ? "not-allowed"
                                        : "pointer",
                            }}
                            title="Refresh Catalog Page"
                        >
                            <RefreshCw
                                size={14}
                                className={
                                    isRefreshingCatalog || loadingSongs
                                        ? "animate-spin"
                                        : ""
                                }
                            />
                            <span>Refresh</span>
                        </button>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => setActiveTab("upload")}
                            className={`app-tag-pill ${activeTab === "upload" ? "active" : ""}`}
                            style={{
                                padding: "8px 18px",
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <Upload size={15} />
                            <span>Upload Track</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("catalog")}
                            className={`app-tag-pill ${activeTab === "catalog" ? "active" : ""}`}
                            style={{
                                padding: "8px 18px",
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <Layers size={15} />
                            <span>Catalog {currentPage > 1 ? `(p.${currentPage})` : ""}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* --- TAB 1: UPLOAD & PROCESS (SPLIT LAYOUT) --- */}
            <div style={{ display: activeTab === "upload" ? "block" : "none" }}>
                <AdminUploadPanel onUploadSuccess={handleResetToFirstPage} />
            </div>

            {/* --- TAB 2: CATALOG MANAGEMENT --- */}
            <div style={{ display: activeTab === "catalog" ? "block" : "none" }}>
                <AdminCatalogTable
                    songs={songs}
                    loadingSongs={loadingSongs}
                    refreshingSongIds={refreshingSongIds}
                    reprocessingSongIds={reprocessingSongIds}
                    togglingVisibilityIds={togglingVisibilityIds}
                    currentPage={currentPage}
                    hasNextPage={hasNextPage}
                    onPlaySong={playSong}
                    onInspectSong={setInspectingSong}
                    onEditSong={setEditingSong}
                    onToggleVisibility={handleToggleVisibility}
                    onReprocessSong={handleReprocessSong}
                    onRefreshSongStatus={handleRefreshSongStatus}
                    onNextPage={handleNextPage}
                    onPrevPage={handlePrevPage}
                    onSwitchToUpload={() => setActiveTab("upload")}
                />
            </div>

            {/* --- MODAL 1: INSPECTOR MODAL --- */}
            <AdminSongInspectorModal
                song={inspectingSong}
                onClose={() => setInspectingSong(null)}
            />

            {/* --- MODAL 2: EDIT METADATA MODAL --- */}
            <AdminSongEditModal
                song={editingSong}
                onClose={() => setEditingSong(null)}
                onSave={handleSaveMetadata}
            />
        </div>
    );
};
