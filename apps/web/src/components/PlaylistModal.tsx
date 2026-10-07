import React, { useState, useEffect } from "react";
import { playlistService } from "../services/playlistService";
import type { PlaylistSummary, SongMetadata } from "../types";
import { useToast } from "../context/ToastContext";
import {
    Search,
    Plus,
    Check,
    Heart,
    Pin,
    Music,
    Loader2,
} from "lucide-react";
import { isLikedPlaylist } from "@music-cloud/utils";

interface PlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: "create" | "add_song" | "edit";
    songToAdd?: SongMetadata | null;
    playlistToEdit?: PlaylistSummary | null;
    onSuccess?: () => void;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
    isOpen,
    onClose,
    mode,
    songToAdd,
    playlistToEdit,
    onSuccess,
}) => {
    const [label, setLabel] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
    const [loadingPlaylists, setLoadingPlaylists] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setSearchQuery("");
            setIsCreatingNew(false);
            setNewPlaylistName("");

            if (mode === "edit" && playlistToEdit) {
                setLabel(playlistToEdit.label);
            } else {
                setLabel("");
            }

            if (mode === "add_song") {
                loadUserPlaylists();
            }
        }
    }, [isOpen, mode, playlistToEdit, songToAdd?.id]);

    const loadUserPlaylists = async () => {
        try {
            setLoadingPlaylists(true);
            const data = await playlistService.getAllPlaylists(songToAdd?.id);
            setPlaylists(data);
        } catch {
            showToast("Error", "error", "Could not load playlists");
        } finally {
            setLoadingPlaylists(false);
        }
    };

    if (!isOpen) return null;

    const handleCreateOrEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!label.trim()) return;

        try {
            setSubmitting(true);
            if (mode === "create") {
                const newPl = await playlistService.createPlaylist({
                    label: label.trim(),
                });
                showToast(
                    "Playlist Created",
                    "success",
                    `Created "${newPl.label}"`,
                );
            } else if (mode === "edit" && playlistToEdit) {
                if (playlistToEdit.is_deletable === false) {
                    showToast("Error", "error", "This playlist cannot be edited");
                    return;
                }
                await playlistService.updatePlaylist({
                    id: playlistToEdit.id,
                    label: label.trim(),
                });
                showToast(
                    "Playlist Updated",
                    "success",
                    `Renamed to "${label.trim()}"`,
                );
            }
            window.dispatchEvent(new CustomEvent("playlist-mutation"));
            onSuccess?.();
            onClose();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to save playlist";
            showToast("Error", "error", msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddToExistingPlaylist = async (
        playlistId: string,
        playlistName: string,
    ) => {
        if (!songToAdd) return;
        // Optimistic update
        setPlaylists((prev) =>
            prev.map((p) =>
                p.id === playlistId
                    ? {
                          ...p,
                          contains_song: true,
                          songs_count: (p.songs_count ?? 0) + 1,
                      }
                    : p,
            ),
        );

        try {
            await playlistService.addSongToPlaylist({
                playlist_id: playlistId,
                song_id: songToAdd.id,
            });
            showToast(
                "Added to Playlist",
                "success",
                `Added to "${playlistName}"`,
            );
            window.dispatchEvent(
                new CustomEvent("playlist-mutation", {
                    detail: {
                        playlistId,
                        songId: songToAdd.id,
                        action: "add",
                        song: songToAdd,
                    },
                }),
            );
            onSuccess?.();
        } catch (err: unknown) {
            // Revert on error
            setPlaylists((prev) =>
                prev.map((p) =>
                    p.id === playlistId
                        ? {
                              ...p,
                              contains_song: false,
                              songs_count: Math.max(0, (p.songs_count ?? 1) - 1),
                          }
                        : p,
                ),
            );
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Could not add song to playlist";
            showToast("Error", "error", msg);
        }
    };

    const handleRemoveFromExistingPlaylist = async (
        playlistId: string,
        playlistName: string,
    ) => {
        if (!songToAdd) return;
        // Optimistic update
        setPlaylists((prev) =>
            prev.map((p) =>
                p.id === playlistId
                    ? {
                          ...p,
                          contains_song: false,
                          songs_count: Math.max(0, (p.songs_count ?? 1) - 1),
                      }
                    : p,
            ),
        );

        try {
            await playlistService.removeSongFromPlaylistBySongId(
                playlistId,
                songToAdd.id,
            );
            showToast(
                "Removed from Playlist",
                "info",
                `Removed from "${playlistName}"`,
            );
            window.dispatchEvent(
                new CustomEvent("playlist-mutation", {
                    detail: {
                        playlistId,
                        songId: songToAdd.id,
                        action: "remove",
                        song: songToAdd,
                    },
                }),
            );
            onSuccess?.();
        } catch (err: unknown) {
            // Revert on error
            setPlaylists((prev) =>
                prev.map((p) =>
                    p.id === playlistId
                        ? {
                              ...p,
                              contains_song: true,
                              songs_count: (p.songs_count ?? 0) + 1,
                          }
                        : p,
                ),
            );
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Could not remove song from playlist";
            showToast("Error", "error", msg);
        }
    };

    const handleCreateAndAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPlaylistName.trim() || !songToAdd) return;

        try {
            setSubmitting(true);
            const newPl = await playlistService.createPlaylist({
                label: newPlaylistName.trim(),
            });
            await playlistService.addSongToPlaylist({
                playlist_id: newPl.id,
                song_id: songToAdd.id,
            });
            showToast(
                "Added to Playlist",
                "success",
                `Added "${songToAdd.title}" to "${newPl.label}"`,
            );
            const now = new Date().toISOString();
            setPlaylists((prev) => [
                {
                    id: newPl.id,
                    label: newPl.label,
                    is_deletable: newPl.is_deletable,
                    contains_song: true,
                    songs_count: 1,
                    created_at: now,
                    updated_at: now,
                },
                ...prev,
            ]);
            setNewPlaylistName("");
            setIsCreatingNew(false);
            window.dispatchEvent(
                new CustomEvent("playlist-mutation", {
                    detail: {
                        playlistId: newPl.id,
                        songId: songToAdd.id,
                        action: "add",
                        song: songToAdd,
                    },
                }),
            );
            onSuccess?.();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to create playlist";
            showToast("Error", "error", msg);
        } finally {
            setSubmitting(false);
        }
    };

    const filteredPlaylists = playlists.filter((p) =>
        p.label.toLowerCase().includes(searchQuery.toLowerCase().trim()),
    );

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.72)",
                backdropFilter: "blur(4px)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
            onClick={onClose}
        >
            <div
                className="animate-fade-in"
                style={{
                    width: "100%",
                    maxWidth: mode === "add_song" ? 330 : 360,
                    borderRadius: 8,
                    padding: mode === "add_song" ? "16px 16px 10px 16px" : "22px 22px 16px 22px",
                    position: "relative",
                    background: "#242424",
                    boxShadow: "0 20px 48px rgba(0, 0, 0, 0.75)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {mode === "add_song" ? (
                    <div>
                        {/* 1. Header */}
                        <div
                            style={{
                                fontSize: 15,
                                fontWeight: 700,
                                color: "#ffffff",
                                marginBottom: 14,
                            }}
                        >
                            Add to playlist
                        </div>

                        {/* 2. Find a playlist Search Input */}
                        <div style={{ position: "relative", marginBottom: 12 }}>
                            <Search
                                size={15}
                                style={{
                                    position: "absolute",
                                    left: 10,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "rgba(255, 255, 255, 0.55)",
                                    pointerEvents: "none",
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Find a playlist"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: "100%",
                                    height: 36,
                                    padding: "0 12px 0 34px",
                                    background: "#333333",
                                    border: "1px solid transparent",
                                    borderRadius: 4,
                                    color: "#ffffff",
                                    fontSize: 13,
                                    outline: "none",
                                    boxSizing: "border-box",
                                    transition: "border-color 0.15s ease",
                                }}
                                onFocus={(e) =>
                                    (e.currentTarget.style.borderColor =
                                        "rgba(255, 255, 255, 0.3)")
                                }
                                onBlur={(e) =>
                                    (e.currentTarget.style.borderColor =
                                        "transparent")
                                }
                            />
                        </div>

                        {/* 3. New Playlist Action Row */}
                        {isCreatingNew ? (
                            <form
                                onSubmit={handleCreateAndAdd}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "4px 0",
                                    marginBottom: 6,
                                }}
                            >
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Playlist name"
                                    value={newPlaylistName}
                                    onChange={(e) =>
                                        setNewPlaylistName(e.target.value)
                                    }
                                    style={{
                                        flex: 1,
                                        height: 32,
                                        padding: "0 10px",
                                        background: "#181818",
                                        border: "1px solid rgba(255, 255, 255, 0.25)",
                                        borderRadius: 4,
                                        color: "#ffffff",
                                        fontSize: 13,
                                        outline: "none",
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={
                                        submitting || !newPlaylistName.trim()
                                    }
                                    className="app-btn-green"
                                    style={{
                                        height: 32,
                                        padding: "0 12px",
                                        fontSize: 12,
                                        borderRadius: "var(--radius-pill)",
                                    }}
                                >
                                    {submitting ? (
                                        <Loader2
                                            size={12}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        "Create"
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreatingNew(false);
                                        setNewPlaylistName("");
                                    }}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "var(--app-subtext)",
                                        cursor: "pointer",
                                        fontSize: 12,
                                        padding: "4px 6px",
                                    }}
                                >
                                    ✕
                                </button>
                            </form>
                        ) : (
                            <div
                                onClick={() => setIsCreatingNew(true)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "8px 6px",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    color: "#ffffff",
                                    transition: "background 0.15s ease",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.background =
                                        "rgba(255, 255, 255, 0.08)")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.background =
                                        "transparent")
                                }
                            >
                                <Plus size={18} strokeWidth={2.2} />
                                <span
                                    style={{ fontSize: 14, fontWeight: 600 }}
                                >
                                    New playlist
                                </span>
                            </div>
                        )}

                        {/* 4. Subtle Divider */}
                        <div
                            style={{
                                height: 1,
                                background: "rgba(255, 255, 255, 0.1)",
                                margin: "6px 0 8px 0",
                            }}
                        />

                        {/* 5. Playlists List */}
                        {loadingPlaylists ? (
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    padding: "30px 0",
                                }}
                            >
                                <Loader2
                                    size={22}
                                    className="animate-spin"
                                    color="var(--app-green)"
                                />
                            </div>
                        ) : filteredPlaylists.length === 0 ? (
                            <div
                                style={{
                                    padding: "24px 0",
                                    textAlign: "center",
                                    fontSize: 13,
                                    color: "var(--app-subtext)",
                                }}
                            >
                                {searchQuery
                                    ? "No matching playlists"
                                    : "No playlists available"}
                            </div>
                        ) : (
                            <div
                                style={{
                                    maxHeight: 250,
                                    overflowY: "auto",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2,
                                    paddingRight: 2,
                                }}
                            >
                                {filteredPlaylists.map((pl) => {
                                    const isAdded = !!pl.contains_song;
                                    const isLikedSongs = isLikedPlaylist(
                                        pl.label,
                                        pl.is_deletable,
                                    );

                                    return (
                                        <div
                                            key={pl.id}
                                            onClick={() => {
                                                if (isAdded) {
                                                    handleRemoveFromExistingPlaylist(
                                                        pl.id,
                                                        pl.label,
                                                    );
                                                } else {
                                                    handleAddToExistingPlaylist(
                                                        pl.id,
                                                        pl.label,
                                                    );
                                                }
                                            }}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "6px 6px",
                                                borderRadius: 4,
                                                cursor: "pointer",
                                                transition:
                                                    "background 0.15s ease",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background =
                                                    "rgba(255, 255, 255, 0.08)";
                                                const circle =
                                                    e.currentTarget.querySelector(
                                                        ".circular-checkbox-unchecked",
                                                    ) as HTMLElement | null;
                                                if (circle) {
                                                    circle.style.borderColor =
                                                        "rgba(255, 255, 255, 0.8)";
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background =
                                                    "transparent";
                                                const circle =
                                                    e.currentTarget.querySelector(
                                                        ".circular-checkbox-unchecked",
                                                    ) as HTMLElement | null;
                                                if (circle) {
                                                    circle.style.borderColor =
                                                        "rgba(255, 255, 255, 0.35)";
                                                }
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 12,
                                                    minWidth: 0,
                                                    flex: 1,
                                                    paddingRight: 10,
                                                }}
                                            >
                                                {/* Cover art thumbnail */}
                                                {isLikedSongs ? (
                                                    <div
                                                        style={{
                                                            width: 36,
                                                            height: 36,
                                                            borderRadius: 4,
                                                            background:
                                                                "linear-gradient(135deg, #450af5, #8e8ee5)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent:
                                                                "center",
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        <Heart
                                                            size={16}
                                                            fill="#ffffff"
                                                            color="#ffffff"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div
                                                        style={{
                                                            width: 36,
                                                            height: 36,
                                                            borderRadius: 4,
                                                            background: "#282828",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent:
                                                                "center",
                                                            flexShrink: 0,
                                                            color: "rgba(255, 255, 255, 0.6)",
                                                        }}
                                                    >
                                                        <Music size={18} />
                                                    </div>
                                                )}

                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 6,
                                                        minWidth: 0,
                                                        flex: 1,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 14,
                                                            fontWeight: 600,
                                                            color: "#ffffff",
                                                            overflow: "hidden",
                                                            textOverflow:
                                                                "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {pl.label}
                                                    </span>
                                                    {isLikedSongs && (
                                                        <Pin
                                                            size={13}
                                                            fill="#1ed760"
                                                            color="#1ed760"
                                                            style={{
                                                                transform:
                                                                    "rotate(45deg)",
                                                                flexShrink: 0,
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Circular Checkbox */}
                                            {isAdded ? (
                                                <div
                                                    style={{
                                                        width: 20,
                                                        height: 20,
                                                        borderRadius: "50%",
                                                        background: "#1ed760",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                        flexShrink: 0,
                                                        boxShadow:
                                                            "0 2px 4px rgba(0, 0, 0, 0.2)",
                                                    }}
                                                >
                                                    <Check
                                                        size={13}
                                                        strokeWidth={3}
                                                        color="#000000"
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className="circular-checkbox-unchecked"
                                                    style={{
                                                        width: 20,
                                                        height: 20,
                                                        borderRadius: "50%",
                                                        border: "2px solid rgba(255, 255, 255, 0.35)",
                                                        background:
                                                            "transparent",
                                                        flexShrink: 0,
                                                        transition:
                                                            "border-color 0.15s ease",
                                                    }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* 6. Bottom Cancel Footer */}
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                marginTop: 10,
                                paddingTop: 4,
                            }}
                        >
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "#b3b3b3",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    padding: "6px 8px",
                                    cursor: "pointer",
                                    transition: "color 0.15s ease",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.color = "#ffffff")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.color = "#b3b3b3")
                                }
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Create or Edit Mode */
                    <form onSubmit={handleCreateOrEdit}>
                        <div
                            style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: "#ffffff",
                                marginBottom: 16,
                            }}
                        >
                            {mode === "edit"
                                ? "Edit details"
                                : "Create playlist"}
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <input
                                type="text"
                                required
                                autoFocus
                                placeholder="My Playlist"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                style={{
                                    width: "100%",
                                    height: 38,
                                    padding: "0 12px",
                                    fontSize: 14,
                                    borderRadius: 4,
                                    background: "#333333",
                                    border: "1px solid transparent",
                                    color: "#fff",
                                    outline: "none",
                                    boxSizing: "border-box",
                                    transition: "border-color 0.15s ease",
                                }}
                                onFocus={(e) =>
                                    (e.currentTarget.style.borderColor =
                                        "rgba(255, 255, 255, 0.3)")
                                }
                                onBlur={(e) =>
                                    (e.currentTarget.style.borderColor =
                                        "transparent")
                                }
                            />
                        </div>

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                alignItems: "center",
                                gap: 12,
                            }}
                        >
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "#b3b3b3",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    padding: "8px 12px",
                                    cursor: "pointer",
                                    transition: "color 0.15s ease",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.color = "#ffffff")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.color = "#b3b3b3")
                                }
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || !label.trim()}
                                className="app-btn-green"
                                style={{
                                    height: 36,
                                    padding: "0 20px",
                                    fontSize: 13,
                                    borderRadius: "var(--radius-pill)",
                                }}
                            >
                                {submitting ? (
                                    <Loader2
                                        size={14}
                                        className="animate-spin"
                                    />
                                ) : mode === "edit" ? (
                                    "Save"
                                ) : (
                                    "Create"
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
