import React, { useState } from "react";
import type { SongMetadata, SongDetail } from "../types";
import { usePlayer } from "../context/PlayerContext";
import { Play, Pause } from "lucide-react";
import { SongCoverArt, DEFAULT_COVER_BG } from "./SongCoverArt";
import { SongContextMenu } from "./SongContextMenu";
import { SongShareModal } from "./SongShareModal";

interface SongCardProps {
    song: SongMetadata | SongDetail;
    onAddToPlaylist?: (song: SongMetadata) => void;
    allSongs?: (SongMetadata | SongDetail)[];
}

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

    const [contextMenuPos, setContextMenuPos] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

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

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
    };

    return (
        <>
            <div
                className="app-card app-music-card"
                onClick={handleCardClick}
                onContextMenu={handleContextMenu}
            >
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
                            transform: isCurrentTrack
                                ? "translateY(0)"
                                : undefined,
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
                                <Pause
                                    size={18}
                                    fill="#000000"
                                    color="#000000"
                                />
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
                </div>
            </div>

            {/* Context Menu on Right Click */}
            {contextMenuPos && (
                <SongContextMenu
                    isOpen={Boolean(contextMenuPos)}
                    position={contextMenuPos}
                    song={song}
                    isThisPlaying={isThisPlaying}
                    onClose={() => setContextMenuPos(null)}
                    onPlay={handleCardClick}
                    onAddToPlaylist={() => onAddToPlaylist?.(song)}
                    onShare={() => setIsShareModalOpen(true)}
                />
            )}

            {/* Share Modal Popup */}
            <SongShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                song={song}
            />
        </>
    );
};
