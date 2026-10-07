import React from "react";
import type { SongMetadata, SongDetail } from "../types";
import { usePlayer } from "../context/PlayerContext";
import { Play, Pause, Plus } from "lucide-react";

interface SongCardProps {
    song: SongMetadata | SongDetail;
    onAddToPlaylist?: (song: SongMetadata) => void;
    allSongs?: (SongMetadata | SongDetail)[];
}

import { SongCoverArt, DEFAULT_COVER_BG } from "./SongCoverArt";

export const getSongGradient = (_id?: string): string => {
    return DEFAULT_COVER_BG;
};

export const SongCard: React.FC<SongCardProps> = ({
    song,
    onAddToPlaylist,
    allSongs,
}) => {
    const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
    const isThisPlaying = currentSong?.id === song.id && isPlaying;
    const isCurrentTrack = currentSong?.id === song.id;

    const handleCardClick = () => {
        if (isCurrentTrack) {
            togglePlay();
        } else {
            playSong(song, allSongs);
        }
    };

    const handlePlayButtonClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isCurrentTrack) {
            togglePlay();
        } else {
            playSong(song, allSongs);
        }
    };

    return (
        <div className="app-card app-music-card" onClick={handleCardClick}>
            {/* Artwork Box with Floating Play Button */}
            <SongCoverArt
                src={song.cover_art_url}
                alt={song.title}
                size="100%"
                borderRadius={6}
                iconSize={32}
                style={{
                    marginBottom: 10,
                    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.45)",
                }}
            >
                {/* Floating Green Play Button on Hover */}
                <div
                    className="play-button-overlay"
                    style={{
                        position: "absolute",
                        right: 8,
                        bottom: 8,
                        opacity: isCurrentTrack ? 1 : undefined,
                        transform: isCurrentTrack ? "translateY(0)" : undefined,
                        pointerEvents: "auto",
                    }}
                >
                    <button
                        onClick={handlePlayButtonClick}
                        className="app-play-btn"
                        style={{ width: 38, height: 38 }}
                        title={isThisPlaying ? "Pause" : "Play"}
                    >
                        {isThisPlaying ? (
                            <Pause size={18} fill="#000000" color="#000000" />
                        ) : (
                            <Play
                                size={18}
                                fill="#000000"
                                color="#000000"
                                style={{ marginLeft: 2 }}
                            />
                        )}
                    </button>
                </div>
            </SongCoverArt>

            {/* Track Title and Artist */}
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 6,
                    width: "100%",
                    minWidth: 0,
                }}
            >
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                        className="card-song-title"
                        style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: isCurrentTrack
                                ? "var(--app-green)"
                                : "#ffffff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            marginBottom: 3,
                        }}
                    >
                        {song.title}
                    </div>
                    <div
                        className="card-song-artist"
                        style={{
                            fontSize: 12,
                            color: "var(--app-subtext)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {song.artist}
                    </div>
                </div>

                {onAddToPlaylist && (
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
                            flexShrink: 0,
                        }}
                    >
                        <div
                            style={{
                                width: 22,
                                height: 22,
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
                                e.currentTarget.style.background =
                                    "rgba(255, 255, 255, 0.1)";
                                e.currentTarget.style.color = "#ffffff";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor =
                                    "rgba(255, 255, 255, 0.4)";
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color =
                                    "rgba(255, 255, 255, 0.85)";
                            }}
                        >
                            <Plus size={12} strokeWidth={2.5} />
                        </div>
                    </button>
                )}
            </div>
        </div>
    );
};
