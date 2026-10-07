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
import { isLikedPlaylist } from "@music-cloud/utils";

interface PlaylistPageProps {
    onEditPlaylist: (playlist: {
        id: string;
        label: string;
        is_deletable?: boolean;
    }) => void;
    onPlaylistDeleted: () => void;
}

export const PlaylistPage: React.FC<PlaylistPageProps> = ({
    onEditPlaylist,
    onPlaylistDeleted,
}) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
    const { showToast } = useToast();

    const loadPlaylistData = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await playlistService.getPlaylistSongs(id);
            setPlaylist(data);
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Could not load playlist.";
            showToast("Error", "error", msg);
        } finally {
            setLoading(false);
        }
    }, [id, showToast]);

    const refreshPlaylistSilent = useCallback(async () => {
        if (!id) return;
        try {
            const data = await playlistService.getPlaylistSongs(id);
            setPlaylist(data);
        } catch {
            // Silently ignore background refresh errors
        }
    }, [id]);

    useEffect(() => {
        loadPlaylistData();
    }, [loadPlaylistData]);

    // Listen for additions/removals to dynamically update the currently opened playlist
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

            const isCurrentLiked = isLikedPlaylist(
                playlist?.label,
                playlist?.is_deletable,
            );

            const matchesCurrent =
                (detail?.playlistId && detail.playlistId === id) ||
                (detail?.isLikedPlaylist && isCurrentLiked);

            if (matchesCurrent && detail?.action) {
                if (detail.action === "add" && detail.song) {
                    setPlaylist((prev) => {
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
                    setPlaylist((prev) => {
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
                refreshPlaylistSilent();
            }
        };

        window.addEventListener("playlist-mutation", handleMutation);
        return () => {
            window.removeEventListener("playlist-mutation", handleMutation);
        };
    }, [id, playlist?.label, playlist?.is_deletable, refreshPlaylistSilent]);

    const playableTracks: SongMetadata[] = playlist?.songs || [];

    const isPlaylistPlaying =
        playableTracks.length > 0 &&
        playableTracks.some((t) => t.id === currentSong?.id) &&
        isPlaying;

    const handlePlayToggle = () => {
        if (playableTracks.length === 0) return;
        if (isPlaylistPlaying) {
            togglePlay();
        } else {
            playSong(playableTracks[0], playableTracks);
        }
    };

    const handleRemoveSong = async (playlistId: string, songId: string) => {
        const previousPlaylist = playlist;

        // Dynamically update playlist state without component reload or refetching
        setPlaylist((prev) => {
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
            // Not a critical action
        }
    };

    const handleDeletePlaylist = async () => {
        if (
            !playlist ||
            !window.confirm(
                `Are you sure you want to delete "${playlist.label}"?`,
            )
        ) {
            return;
        }

        try {
            setDeleting(true);
            await playlistService.removePlaylist(playlist.id);
            showToast(
                "Playlist Deleted",
                "info",
                `Deleted "${playlist.label}"`,
            );
            onPlaylistDeleted();
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

    if (!playlist) {
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
                    Playlist not found
                </p>
                <button onClick={() => navigate("/")} className="app-btn-pill">
                    Back to Home
                </button>
            </div>
        );
    }

    const isLiked = isLikedPlaylist(playlist.label, playlist.is_deletable);

    return (
        <div className="playlist-page-container" style={{ paddingBottom: 120 }}>
            {/* 1. Massive Gradient Header */}
            <div
                className="playlist-hero-header"
                style={
                    isLiked
                        ? {
                              background:
                                  "linear-gradient(180deg, #5038a0 0%, #121212 100%)",
                          }
                        : undefined
                }
            >
                {/* Playlist Cover Art */}
                <div
                    className="playlist-cover-box"
                    style={
                        isLiked
                            ? {
                                  background:
                                      "linear-gradient(135deg, #450af5, #8e8ee5)",
                                  boxShadow:
                                      "0 8px 32px rgba(80, 56, 160, 0.45)",
                              }
                            : undefined
                    }
                >
                    {isLiked ? (
                        <Heart size={64} fill="#ffffff" color="#ffffff" />
                    ) : (
                        <Music size={64} color="var(--app-subtext)" />
                    )}
                </div>

                {/* Metadata Details */}
                <div className="playlist-meta-details">
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: "#ffffff",
                            letterSpacing: "0.08em",
                        }}
                    >
                        Public Playlist
                    </span>

                    <h1 className="playlist-title">{playlist.label}</h1>

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
                            {playlist.songs.length} song
                            {playlist.songs.length === 1 ? "" : "s"}
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. Action Bar with Big Green Play Button */}
            <div className="playlist-action-bar">
                <button
                    onClick={handlePlayToggle}
                    disabled={playlist.songs.length === 0}
                    className="app-play-btn"
                    style={{ width: 52, height: 52 }}
                    title={isPlaylistPlaying ? "Pause" : "Play"}
                >
                    {isPlaylistPlaying ? (
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

                {playlist.is_deletable && (
                    <button
                        onClick={() =>
                            onEditPlaylist({
                                id: playlist.id,
                                label: playlist.label,
                                is_deletable: playlist.is_deletable,
                            })
                        }
                        className="app-btn-ghost"
                        title="Rename playlist"
                    >
                        <Edit2 size={20} />
                    </button>
                )}

                {playlist.is_deletable && (
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
                {playlist.songs.length === 0 ? (
                    <div
                        style={{
                            padding: "48px 0",
                            textAlign: "center",
                            color: "var(--app-subtext)",
                            fontSize: 14,
                        }}
                    >
                        Let's find some songs for your playlist. Click '+' on
                        any track in Home or Search to add it here.
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {playlist.songs.map((song, index) => {
                            return (
                                <SongRow
                                    key={song.id}
                                    playlistId={playlist.id}
                                    song={song}
                                    index={index}
                                    dateAdded={song.created_at}
                                    onRemoveFromPlaylist={handleRemoveSong}
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
