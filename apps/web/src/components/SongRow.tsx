import React, { useState } from "react";
import type { SongMetadata, SongDetail } from "../types";
import { usePlayer } from "../context/PlayerContext";
import { SongCoverArt } from "./SongCoverArt";
import { Play, Pause, Plus, Check } from "lucide-react";

interface SongRowProps {
    song: SongMetadata | SongDetail;
    index: number;
    playlistId?: string;
    dateAdded?: string;
    onRemoveFromPlaylist?: (playlistId: string, songId: string) => void;
    onAddToPlaylist?: (song: SongMetadata) => void;
    allSongs?: (SongMetadata | SongDetail)[];
}

import { formatDuration, formatDateAdded } from "@music-cloud/utils";

export const SongRow: React.FC<SongRowProps> = ({
    song,
    index,
    playlistId,
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
                {playlistId && onRemoveFromPlaylist ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemoveFromPlaylist(playlistId, song.id);
                        }}
                        title="Remove from playlist"
                        style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <div
                            style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: "#1ed760",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "transform 0.15s ease, opacity 0.15s ease",
                                opacity: isHovered ? 1 : 0.85,
                                transform: isHovered ? "scale(1.08)" : "scale(1)",
                            }}
                        >
                            <Check size={13} strokeWidth={3} color="#000000" />
                        </div>
                    </button>
                ) : onAddToPlaylist && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddToPlaylist(song);
                        }}
                        title="Add to playlist"
                        style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: isHovered ? 1 : 0,
                            transition: "opacity 0.15s ease",
                        }}
                    >
                        <div
                            style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                border: "1.5px solid rgba(255, 255, 255, 0.4)",
                                background: "transparent",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "rgba(255, 255, 255, 0.85)",
                                transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "#ffffff";
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                                e.currentTarget.style.color = "#ffffff";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.4)";
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color = "rgba(255, 255, 255, 0.85)";
                            }}
                        >
                            <Plus size={12} strokeWidth={2.5} />
                        </div>
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
