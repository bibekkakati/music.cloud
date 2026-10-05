import React, { useState, useEffect } from "react";
import { playlistService } from "../services/playlistService";
import type { PlaylistSummary, SongMetadata } from "../types";
import { useToast } from "../context/ToastContext";
import { X, FolderPlus, ListPlus, Loader2, Music, Check } from "lucide-react";

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
    const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
    const [loadingPlaylists, setLoadingPlaylists] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) {
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
                if (songToAdd) {
                    await playlistService.addSongToPlaylist({
                        playlist_id: newPl.id,
                        song_id: songToAdd.id,
                    });
                    showToast(
                        "Added to Playlist",
                        "success",
                        `Added "${songToAdd.title}" to "${newPl.label}"`,
                    );
                }
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
        try {
            setSubmitting(true);
            await playlistService.addSongToPlaylist({
                playlist_id: playlistId,
                song_id: songToAdd.id,
            });
            showToast(
                "Added to Playlist",
                "success",
                `Added "${songToAdd.title}" to "${playlistName}"`,
            );
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
            window.dispatchEvent(new CustomEvent("playlist-mutation"));
            onSuccess?.();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Could not add song to playlist";
            showToast("Error", "error", msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveFromExistingPlaylist = async (
        playlistId: string,
        playlistName: string,
    ) => {
        if (!songToAdd) return;
        try {
            setSubmitting(true);
            await playlistService.removeSongFromPlaylistBySongId(
                playlistId,
                songToAdd.id,
            );
            showToast(
                "Removed from Playlist",
                "info",
                `Removed "${songToAdd.title}" from "${playlistName}"`,
            );
            setPlaylists((prev) =>
                prev.map((p) =>
                    p.id === playlistId
                        ? {
                              ...p,
                              contains_song: false,
                              songs_count: Math.max(
                                  0,
                                  (p.songs_count ?? 1) - 1,
                              ),
                          }
                        : p,
                ),
            );
            window.dispatchEvent(new CustomEvent("playlist-mutation"));
            onSuccess?.();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Could not remove song from playlist";
            showToast("Error", "error", msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                backdropFilter: "blur(8px)",
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
                    maxWidth: 480,
                    borderRadius: 8,
                    padding: 32,
                    position: "relative",
                    background: "#282828",
                    boxShadow: "0 24px 48px rgba(0, 0, 0, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="app-btn-ghost"
                    style={{ position: "absolute", top: 16, right: 16 }}
                >
                    <X size={20} />
                </button>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        marginBottom: 24,
                    }}
                >
                    <div
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 4,
                            background: "#181818",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--app-green)",
                        }}
                    >
                        {mode === "add_song" ? (
                            <ListPlus size={24} />
                        ) : (
                            <FolderPlus size={24} />
                        )}
                    </div>
                    <div>
                        <h3
                            style={{
                                fontSize: 20,
                                fontWeight: 800,
                                color: "#ffffff",
                            }}
                        >
                            {mode === "edit"
                                ? "Edit details"
                                : mode === "add_song"
                                  ? "Add to playlist"
                                  : "Create playlist"}
                        </h3>
                        {songToAdd && (
                            <p
                                style={{
                                    fontSize: 13,
                                    color: "var(--app-subtext)",
                                    marginTop: 2,
                                }}
                            >
                                Track:{" "}
                                <span
                                    style={{ color: "#fff", fontWeight: 600 }}
                                >
                                    {songToAdd.title}
                                </span>
                            </p>
                        )}
                    </div>
                </div>

                {mode === "add_song" && (
                    <div style={{ marginBottom: 24 }}>
                        <div
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "var(--app-subtext)",
                                marginBottom: 10,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            Select existing playlist
                        </div>

                        {loadingPlaylists ? (
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    padding: 20,
                                }}
                            >
                                <Loader2
                                    size={24}
                                    className="animate-spin"
                                    color="var(--app-green)"
                                />
                            </div>
                        ) : playlists.length === 0 ? (
                            <div
                                style={{
                                    padding: 16,
                                    borderRadius: 4,
                                    background: "#181818",
                                    textAlign: "center",
                                    fontSize: 13,
                                    color: "var(--app-subtext)",
                                }}
                            >
                                No existing playlists found. Create one below.
                            </div>
                        ) : (
                            <div
                                style={{
                                    maxHeight: 180,
                                    overflowY: "auto",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                }}
                            >
                                {playlists.map((pl) => {
                                    const isAlreadyAdded = !!pl.contains_song;

                                    return (
                                        <div
                                            key={pl.id}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                                padding: "10px 14px",
                                                background: isAlreadyAdded
                                                    ? "rgba(29, 185, 84, 0.08)"
                                                    : "#181818",
                                                border: isAlreadyAdded
                                                    ? "1px solid rgba(29, 185, 84, 0.3)"
                                                    : "1px solid transparent",
                                                borderRadius: 4,
                                                color: "#ffffff",
                                                transition: "all 0.15s ease",
                                            }}
                                        >
                                            <Music
                                                size={16}
                                                color={
                                                    isAlreadyAdded
                                                        ? "var(--app-green)"
                                                        : "var(--app-subtext)"
                                                }
                                            />
                                            <div
                                                style={{ flex: 1, minWidth: 0 }}
                                            >
                                                <div
                                                    style={{
                                                        fontWeight: 600,
                                                        fontSize: 14,
                                                        overflow: "hidden",
                                                        textOverflow:
                                                            "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {pl.label}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--app-subtext)",
                                                    }}
                                                >
                                                    {pl.songs_count ?? 0}{" "}
                                                    {pl.songs_count === 1
                                                        ? "song"
                                                        : "songs"}
                                                </div>
                                            </div>

                                            {isAlreadyAdded ? (
                                                <button
                                                    type="button"
                                                    disabled={submitting}
                                                    onClick={() =>
                                                        handleRemoveFromExistingPlaylist(
                                                            pl.id,
                                                            pl.label,
                                                        )
                                                    }
                                                    className="app-btn-ghost"
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 5,
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: "var(--app-green)",
                                                        padding: "6px 10px",
                                                        borderRadius:
                                                            "var(--radius-pill)",
                                                        background:
                                                            "rgba(29, 185, 84, 0.15)",
                                                        cursor: "pointer",
                                                        transition:
                                                            "all 0.15s ease",
                                                    }}
                                                    title="Click to remove from playlist"
                                                >
                                                    <Check
                                                        size={14}
                                                        strokeWidth={2.6}
                                                    />
                                                    <span>Added</span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={submitting}
                                                    onClick={() =>
                                                        handleAddToExistingPlaylist(
                                                            pl.id,
                                                            pl.label,
                                                        )
                                                    }
                                                    className="app-btn-ghost"
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 4,
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        color: "var(--app-green)",
                                                        padding: "6px 12px",
                                                        borderRadius:
                                                            "var(--radius-pill)",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    <span>+ Add</span>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                margin: "20px 0 16px",
                                color: "var(--app-muted)",
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.05em",
                            }}
                        >
                            <div
                                style={{
                                    flex: 1,
                                    height: 1,
                                    background: "rgba(255, 255, 255, 0.1)",
                                }}
                            />
                            <span>OR CREATE NEW</span>
                            <div
                                style={{
                                    flex: 1,
                                    height: 1,
                                    background: "rgba(255, 255, 255, 0.1)",
                                }}
                            />
                        </div>
                    </div>
                )}

                <form onSubmit={handleCreateOrEdit}>
                    <div style={{ marginBottom: 24 }}>
                        <label
                            style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#ffffff",
                                marginBottom: 8,
                            }}
                        >
                            Name
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="My Playlist"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "12px 14px",
                                fontSize: 14,
                                borderRadius: 4,
                                background: "#121212",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                color: "#fff",
                                outline: "none",
                            }}
                            onFocus={(e) =>
                                (e.currentTarget.style.borderColor = "#fff")
                            }
                            onBlur={(e) =>
                                (e.currentTarget.style.borderColor =
                                    "rgba(255, 255, 255, 0.2)")
                            }
                        />
                    </div>

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 12,
                        }}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            className="app-btn-pill"
                            style={{
                                background: "transparent",
                                color: "#fff",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !label.trim()}
                            className="app-btn-green"
                        >
                            {submitting ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : null}
                            <span>
                                {mode === "edit"
                                    ? "Save"
                                    : mode === "add_song"
                                      ? "Create & Add"
                                      : "Create"}
                            </span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
