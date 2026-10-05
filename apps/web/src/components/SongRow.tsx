import React, { useState } from "react";
import type { SongMetadata, SongDetail } from "../types";
import { usePlayer } from "../context/PlayerContext";
import { SongCoverArt } from "./SongCoverArt";
import { Play, Pause, Plus, Trash2 } from "lucide-react";

interface SongRowProps {
    song: SongMetadata | SongDetail;
    index: number;
    playlistSongId?: string;
    dateAdded?: string;
    onRemoveFromPlaylist?: (playlistSongId: string) => void;
    onAddToPlaylist?: (song: SongMetadata) => void;
    allSongs?: (SongMetadata | SongDetail)[];
}

const formatDuration = (seconds?: number): string => {
    if (!seconds || isNaN(seconds)) return "3:20";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const formatDateAdded = (dateStr?: string): string => {
    if (!dateStr) return "—";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "—";
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHours = Math.floor(diffMin / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMin < 1) return "Just now";
        if (diffMin < 60) return `${diffMin} min ago`;
        if (diffHours < 24)
            return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year:
                date.getFullYear() !== now.getFullYear()
                    ? "numeric"
                    : undefined,
        });
    } catch {
        return "—";
    }
};

export const SongRow: React.FC<SongRowProps> = ({
    song,
    index,
    playlistSongId,
    dateAdded,
    onRemoveFromPlaylist,
    onAddToPlaylist,
    allSongs,
}) => {
    const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
    const [isHovered, setIsHovered] = useState(false);

    const isThisPlaying = currentSong?.id === song.id && isPlaying;
    const isCurrentTrack = currentSong?.id === song.id;
    const durationSec = (song as SongDetail).duration_sec;

    const handleRowClick = () => {
        if (isCurrentTrack) {
            togglePlay();
        } else {
            playSong(song, allSongs);
        }
    };

    return (
        <div
            className={`app-table-row ${isCurrentTrack ? "active" : ""}`}
            onClick={handleRowClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* 1. Track Index or Play Icon */}
            <div
                className="songrow-col-index"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {isHovered || isCurrentTrack ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick();
                        }}
                        style={{
                            background: "none",
                            border: "none",
                            color: isCurrentTrack
                                ? "var(--app-green)"
                                : "#ffffff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {isThisPlaying ? (
                            <Pause size={16} fill="currentColor" />
                        ) : (
                            <Play size={16} fill="currentColor" />
                        )}
                    </button>
                ) : (
                    <span style={{ fontSize: 14, color: "var(--app-subtext)" }}>
                        {index + 1}
                    </span>
                )}
            </div>

            {/* 2. Track Title & Artist with Thumbnail */}
            <div
                className="songrow-col-main"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    minWidth: 0,
                    paddingRight: 12,
                }}
            >
                <SongCoverArt
                    src={song.cover_art_url}
                    alt={song.title}
                    size={40}
                    borderRadius={4}
                    iconSize={18}
                    style={{ flexShrink: 0 }}
                />

                <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                        className="track-title"
                        style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: isCurrentTrack
                                ? "var(--app-green)"
                                : "#ffffff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {song.title}
                    </div>
                    <div
                        style={{
                            fontSize: 12,
                            color: "var(--app-subtext)",
                            marginTop: 2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {song.artist}
                    </div>
                </div>
            </div>

            {/* 3. Date Added or Stream Format (Desktop / Large Tablet) */}
            {dateAdded !== undefined ? (
                <div
                    className="songrow-col-date"
                    style={{
                        fontSize: 13,
                        color: "var(--app-subtext)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        paddingRight: 16,
                    }}
                >
                    {formatDateAdded(dateAdded)}
                </div>
            ) : (
                <div
                    className="songrow-col-album"
                    style={{
                        fontSize: 13,
                        color: "var(--app-subtext)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        paddingRight: 16,
                    }}
                >
                    HLS Stream
                </div>
            )}

            {/* 4. Duration & Actions */}
            <div
                className="songrow-col-duration"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 10,
                }}
            >
                {onAddToPlaylist && isHovered && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddToPlaylist(song);
                        }}
                        className="app-btn-ghost"
                        title="Add to Playlist"
                        style={{ padding: 4 }}
                    >
                        <Plus size={16} />
                    </button>
                )}

                {playlistSongId && onRemoveFromPlaylist && isHovered && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemoveFromPlaylist(playlistSongId);
                        }}
                        className="app-btn-ghost"
                        title="Remove from Playlist"
                        style={{ padding: 4, color: "#f87171" }}
                    >
                        <Trash2 size={16} />
                    </button>
                )}

                <span
                    style={{
                        fontSize: 13,
                        color: "var(--app-subtext)",
                        minWidth: 36,
                        textAlign: "right",
                    }}
                >
                    {formatDuration(durationSec)}
                </span>
            </div>
        </div>
    );
};
