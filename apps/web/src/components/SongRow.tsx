import React, { useState } from "react";
import type { SongMetadata, SongDetail } from "../types";
import { usePlayer } from "../context/PlayerContext";
import { SongCoverArt } from "./SongCoverArt";
import { SongContextMenu } from "./SongContextMenu";
import { SongShareModal } from "./SongShareModal";
import { Play, Pause, MoreVertical } from "lucide-react";
import { formatDuration, formatDateAdded } from "@music-cloud/utils";

interface SongRowProps {
    song: SongMetadata | SongDetail;
    index: number;
    playlistId?: string;
    onRemoveFromPlaylist?: (playlistId: string, songId: string) => void;
    onAddToPlaylist?: (song: SongMetadata) => void;
    allSongs?: (SongMetadata | SongDetail)[];
}

export const SongRow: React.FC<SongRowProps> = ({
    song,
    index,
    playlistId,
    onRemoveFromPlaylist,
    onAddToPlaylist,
    allSongs,
}) => {
    const { currentSong, isPlaying, playSong, togglePlay, addToQueue } = usePlayer();
    const [isHovered, setIsHovered] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const isThisPlaying = currentSong?.id === song.id && isPlaying;
    const isCurrentTrack = currentSong?.id === song.id;
    const durationSec = (song as SongDetail).duration_sec;

    const handleRowClick = () => {
        if (isCurrentTrack) {
            togglePlay();
        } else {
            playSong(song, allSongs, 0, playlistId);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
    };

    const handleMoreButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setContextMenuPos({
            x: rect.right,
            y: rect.bottom,
        });
    };

    return (
        <>
            <div
                className={`app-table-row ${isCurrentTrack ? "active" : ""}`}
                onClick={handleRowClick}
                onContextMenu={handleContextMenu}
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
                        <span
                            style={{
                                fontSize: 14,
                                color: "var(--app-subtext)",
                            }}
                        >
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

                {/* 3. Album */}
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
                    {song.album || "-"}
                </div>

                {/* 4. Date Added (Desktop / Large Tablet) */}
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
                    {song.created_at
                        ? formatDateAdded(song.created_at)
                        : song.year || "-"}
                </div>

                {/* 5. Duration & Actions */}
                <div
                    className="songrow-col-duration"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 16,
                    }}
                >
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

                    {/* Vertical dots options button */}
                    <button
                        onClick={handleMoreButtonClick}
                        title="More options"
                        style={{
                            background: "none",
                            border: "none",
                            padding: 6,
                            borderRadius: "50%",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: Boolean(contextMenuPos)
                                ? "#ffffff"
                                : "var(--app-subtext)",
                            opacity:
                                isHovered || Boolean(contextMenuPos) ? 1 : 0,
                            transition:
                                "opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#ffffff";
                            e.currentTarget.style.backgroundColor =
                                "rgba(255, 255, 255, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = Boolean(
                                contextMenuPos,
                            )
                                ? "#ffffff"
                                : "var(--app-subtext)";
                            e.currentTarget.style.backgroundColor =
                                "transparent";
                        }}
                    >
                        <MoreVertical size={16} />
                    </button>
                </div>
            </div>

            {/* Context Menu on Right Click or 3-Dots Click */}
            {contextMenuPos && (
                <SongContextMenu
                    isOpen={Boolean(contextMenuPos)}
                    position={contextMenuPos}
                    song={song}
                    isThisPlaying={isThisPlaying}
                    onClose={() => setContextMenuPos(null)}
                    onPlay={handleRowClick}
                    onPlayNext={() => addToQueue(song, "next")}
                    onAddToQueue={() => addToQueue(song, "end")}
                    onAddToPlaylist={() => onAddToPlaylist?.(song)}
                    onRemoveFromPlaylist={
                        playlistId && onRemoveFromPlaylist
                            ? () => onRemoveFromPlaylist(playlistId, song.id)
                            : undefined
                    }
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
