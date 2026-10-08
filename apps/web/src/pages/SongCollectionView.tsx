import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { playlistService } from "../services/playlistService";
import type { PlaylistDetail, PlaylistSongItem, SongMetadata } from "../types";
import { SongRow } from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import { useToast } from "../context/ToastContext";
import {
    Play,
    Pause,
    Trash2,
    Edit2,
    Music,
    Loader2,
    Clock3,
    Heart,
} from "lucide-react";
import { isLikedPlaylist, BROWSE_CATEGORIES } from "@music-cloud/utils";

interface SongCollectionViewProps {
    mode?: "playlist" | "category";
    onEditPlaylist?: (playlist: {
        id: string;
        label: string;
        is_deletable?: boolean;
    }) => void;
    onPlaylistDeleted?: () => void;
}

export const SongCollectionView: React.FC<SongCollectionViewProps> = ({
    mode = "playlist",
    onEditPlaylist,
    onPlaylistDeleted,
}) => {
    const { id, categoryId } = useParams<{
        id?: string;
        categoryId?: string;
    }>();
    const navigate = useNavigate();

    const isCategoryMode = mode === "category" || Boolean(categoryId);
    const resolvedCategory = isCategoryMode
        ? BROWSE_CATEGORIES.find(
              (c) =>
                  c.id.toLowerCase() === (categoryId || id || "").toLowerCase(),
          )
        : null;

    const [collection, setCollection] = useState<PlaylistDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
    const { showToast } = useToast();

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            if (isCategoryMode) {
                const label = resolvedCategory
                    ? resolvedCategory.title
                    : categoryId || id || "Category";
                const data = await playlistService.getCategorySongs(label);
                setCollection(data);
            } else {
                if (!id) return;
                const data = await playlistService.getPlaylistSongs(id);
                setCollection(data);
            }
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail ||
                (isCategoryMode
                    ? "Could not load category."
                    : "Could not load playlist.");
            showToast("Error", "error", msg);
        } finally {
            setLoading(false);
        }
    }, [isCategoryMode, resolvedCategory, categoryId, id, showToast]);

    const refreshDataSilent = useCallback(async () => {
        try {
            if (isCategoryMode) {
                const label = resolvedCategory
                    ? resolvedCategory.title
                    : categoryId || id || "Category";
                const data = await playlistService.getCategorySongs(label);
                setCollection(data);
            } else {
                if (!id) return;
                const data = await playlistService.getPlaylistSongs(id);
                setCollection(data);
            }
        } catch {
            // Silently ignore background refresh errors
        }
    }, [isCategoryMode, resolvedCategory, categoryId, id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Listen for additions/removals to dynamically update the currently opened collection
    useEffect(() => {
        const handleMutation = (e: Event) => {
            const customEvent = e as CustomEvent<{
                playlistId?: string;
                songId?: string;
                action?: "add" | "remove";
                song?: SongMetadata;
                isLikedPlaylist?: boolean;
            }>;
            const detail = customEvent.detail;

            const isCurrentLiked =
                !isCategoryMode &&
                isLikedPlaylist(collection?.label, collection?.is_deletable);

            const matchesCurrent =
                (!isCategoryMode &&
                    detail?.playlistId &&
                    detail.playlistId === id) ||
                (detail?.isLikedPlaylist && isCurrentLiked);

            if (matchesCurrent && detail?.action) {
                if (detail.action === "add" && detail.song) {
                    setCollection((prev) => {
                        if (!prev) return prev;
                        if (prev.songs.some((s) => s.id === detail.song!.id)) {
                            return prev;
                        }
                        const newSongItem: PlaylistSongItem = {
                            ...detail.song!,
                            playlist_song_id: detail.song!.id,
                            created_at: new Date().toISOString(),
                        };
                        return {
                            ...prev,
                            songs: [...prev.songs, newSongItem],
                            songs_count:
                                (prev.songs_count ?? prev.songs.length) + 1,
                        };
                    });
                } else if (detail.action === "remove" && detail.songId) {
                    setCollection((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            songs: prev.songs.filter(
                                (s) => s.id !== detail.songId,
                            ),
                            songs_count: Math.max(
                                0,
                                (prev.songs_count ?? prev.songs.length) - 1,
                            ),
                        };
                    });
                }
            }

            // Also silently fetch latest data in the background (no loading spinner)
            if (!detail?.playlistId || matchesCurrent) {
                refreshDataSilent();
            }
        };

        window.addEventListener("playlist-mutation", handleMutation);
        return () => {
            window.removeEventListener("playlist-mutation", handleMutation);
        };
    }, [
        id,
        isCategoryMode,
        collection?.label,
        collection?.is_deletable,
        refreshDataSilent,
    ]);

    const playableTracks: SongMetadata[] = collection?.songs || [];

    const isCollectionPlaying =
        playableTracks.length > 0 &&
        playableTracks.some((t) => t.id === currentSong?.id) &&
        isPlaying;

    const handlePlayToggle = () => {
        if (playableTracks.length === 0) return;
        if (isCollectionPlaying) {
            togglePlay();
        } else {
            playSong(playableTracks[0], playableTracks);
        }
    };

    const handleRemoveSong = async (playlistId: string, songId: string) => {
        setCollection((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                songs: prev.songs.filter((s) => s.id !== songId),
            };
        });

        try {
            await playlistService.removeSongFromPlaylistBySongId(
                playlistId,
                songId,
            );
            showToast("Song Removed", "info", "Removed track from playlist");
            window.dispatchEvent(
                new CustomEvent("playlist-mutation", {
                    detail: {
                        playlistId,
                        songId,
                        action: "remove",
                    },
                }),
            );
        } catch {
            // Skipping revert
        }
    };

    const handleDeletePlaylist = async () => {
        if (
            !collection ||
            !window.confirm(
                `Are you sure you want to delete "${collection.label}"?`,
            )
        ) {
            return;
        }

        try {
            setDeleting(true);
            await playlistService.removePlaylist(collection.id);
            showToast(
                "Playlist Deleted",
                "info",
                `Deleted "${collection.label}"`,
            );
            if (onPlaylistDeleted) {
                onPlaylistDeleted();
            }
            window.dispatchEvent(new CustomEvent("playlist-mutation"));
            navigate("/");
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Could not delete playlist";
            showToast("Error", "error", msg);
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "60vh",
                }}
            >
                <Loader2
                    size={36}
                    className="animate-spin"
                    color="var(--app-green)"
                />
            </div>
        );
    }

    if (!collection) {
        return (
            <div
                style={{
                    padding: 48,
                    textAlign: "center",
                    color: "var(--app-subtext)",
                }}
            >
                <p
                    style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#fff",
                        marginBottom: 8,
                    }}
                >
                    {isCategoryMode
                        ? "Category not found"
                        : "Playlist not found"}
                </p>
                <button
                    onClick={() => navigate(isCategoryMode ? "/search" : "/")}
                    className="app-btn-pill"
                >
                    {isCategoryMode ? "Back to Search" : "Back to Home"}
                </button>
            </div>
        );
    }

    const isLiked =
        !isCategoryMode &&
        isLikedPlaylist(collection.label, collection.is_deletable);
    const categoryBgColor = resolvedCategory?.color || "#5038a0";

    return (
        <div className="playlist-page-container" style={{ paddingBottom: 120 }}>
            {/* 1. Header (Clean background, artwork styled) */}
            <div className="playlist-hero-header">
                {/* Cover Art Box */}
                <div
                    className="playlist-cover-box"
                    style={
                        isCategoryMode
                            ? {
                                  background: `linear-gradient(135deg, ${categoryBgColor}, #181818)`,
                              }
                            : isLiked
                              ? {
                                    background:
                                        "linear-gradient(135deg, #450af5, #8e8ee5)",
                                }
                              : undefined
                    }
                >
                    {isCategoryMode ? (
                        <Music size={64} color="#ffffff" />
                    ) : isLiked ? (
                        <Heart size={64} fill="#ffffff" color="#ffffff" />
                    ) : (
                        <Music size={64} color="var(--app-subtext)" />
                    )}
                </div>

                {/* Metadata Details */}
                <div className="playlist-meta-details">
                    <h1 className="playlist-title">{collection.label}</h1>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#ffffff",
                        }}
                    >
                        <span
                            style={{
                                color: "var(--app-subtext)",
                                fontWeight: 500,
                            }}
                        >
                            {collection.songs.length} song
                            {collection.songs.length === 1 ? "" : "s"}
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. Action Bar with Big Green Play Button */}
            <div className="playlist-action-bar">
                <button
                    onClick={handlePlayToggle}
                    disabled={collection.songs.length === 0}
                    className="app-play-btn"
                    style={{ width: 52, height: 52 }}
                    title={isCollectionPlaying ? "Pause" : "Play"}
                >
                    {isCollectionPlaying ? (
                        <Pause size={24} fill="#000000" color="#000000" />
                    ) : (
                        <Play
                            size={24}
                            fill="#000000"
                            color="#000000"
                            style={{ marginLeft: 3 }}
                        />
                    )}
                </button>

                {!isCategoryMode &&
                    collection.is_deletable &&
                    onEditPlaylist && (
                        <button
                            onClick={() =>
                                onEditPlaylist({
                                    id: collection.id,
                                    label: collection.label,
                                    is_deletable: collection.is_deletable,
                                })
                            }
                            className="app-btn-ghost"
                            title="Rename playlist"
                        >
                            <Edit2 size={20} />
                        </button>
                    )}

                {!isCategoryMode && collection.is_deletable && (
                    <button
                        onClick={handleDeletePlaylist}
                        disabled={deleting}
                        className="app-btn-ghost"
                        title="Delete playlist"
                        style={{ color: "#f87171" }}
                    >
                        {deleting ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Trash2 size={20} />
                        )}
                    </button>
                )}
            </div>

            {/* 3. Tracklist Table */}
            <div className="playlist-tracklist-container">
                {/* Table Header */}
                <div className="app-table-header">
                    <div
                        className="songrow-col-index"
                        style={{ textAlign: "center" }}
                    >
                        #
                    </div>
                    <div className="songrow-col-main">Title</div>
                    <div className="songrow-col-date">Date added</div>
                    <div
                        className="songrow-col-duration"
                        style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            paddingRight: 6,
                        }}
                    >
                        <Clock3 size={16} />
                    </div>
                </div>

                {/* Rows */}
                {collection.songs.length === 0 ? (
                    <div
                        style={{
                            padding: "48px 0",
                            textAlign: "center",
                            color: "var(--app-subtext)",
                            fontSize: 14,
                        }}
                    >
                        {isCategoryMode
                            ? `No songs found for ${collection.label} yet.`
                            : "Let's find some songs for your playlist. Click '+' on any track in Home or Search to add it here."}
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {collection.songs.map((song, index) => {
                            return (
                                <SongRow
                                    key={song.id}
                                    playlistId={
                                        isCategoryMode
                                            ? undefined
                                            : collection.id
                                    }
                                    song={song}
                                    index={index}
                                    dateAdded={song.created_at}
                                    onRemoveFromPlaylist={
                                        isCategoryMode
                                            ? undefined
                                            : handleRemoveSong
                                    }
                                    allSongs={playableTracks}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
