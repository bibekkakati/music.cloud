import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePlayer, type PlayableSong } from "../context/PlayerContext";
import { SongCoverArt } from "./SongCoverArt";
import { formatTime } from "@music-cloud/utils";
import { X, Play, Pause, Trash2, ListMusic, Music } from "lucide-react";

interface QueueModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const QueueModal: React.FC<QueueModalProps> = ({ isOpen, onClose }) => {
    const {
        currentSong,
        queue,
        isPlaying,
        togglePlay,
        playSong,
        removeFromQueue,
        currentCollectionId,
    } = usePlayer();

    // Close on Escape key press
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const currentIdx = currentSong
        ? queue.findIndex((s) => s.id === currentSong.id)
        : -1;

    // Split into upcoming songs and past songs if needed
    const upcomingSongs =
        currentIdx >= 0 ? queue.slice(currentIdx + 1) : queue;

    const handlePlayItem = (song: PlayableSong) => {
        playSong(song, queue, 0, currentCollectionId || undefined);
    };

    const handleRemoveItem = (e: React.MouseEvent, songId: string) => {
        e.stopPropagation();
        removeFromQueue(songId);
    };

    return createPortal(
        <div
            className="animate-fade-in"
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth: 580,
                    maxHeight: "82vh",
                    backgroundColor: "#181818",
                    borderRadius: 16,
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.8)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "18px 24px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <ListMusic size={20} color="var(--app-green)" />
                        <h2
                            style={{
                                fontSize: 18,
                                fontWeight: 700,
                                color: "#ffffff",
                                margin: 0,
                            }}
                        >
                            Playback Queue
                        </h2>
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 12,
                                backgroundColor: "rgba(255, 255, 255, 0.1)",
                                color: "var(--app-subtext)",
                            }}
                        >
                            {queue.length} {queue.length === 1 ? "track" : "tracks"}
                        </span>
                    </div>

                    <button
                        onClick={onClose}
                        className="app-btn-ghost"
                        style={{ padding: 6, color: "var(--app-subtext)" }}
                        title="Close queue"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div
                    style={{
                        padding: "16px 24px",
                        overflowY: "auto",
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 20,
                    }}
                >
                    {/* Now Playing Section */}
                    {currentSong ? (
                        <div>
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    letterSpacing: "0.08em",
                                    color: "var(--app-subtext)",
                                    textTransform: "uppercase",
                                    marginBottom: 10,
                                }}
                            >
                                Now Playing
                            </div>

                            <div
                                onClick={togglePlay}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 14,
                                    padding: "10px 14px",
                                    borderRadius: 10,
                                    backgroundColor: "rgba(255, 255, 255, 0.06)",
                                    border: "1px solid rgba(29, 185, 84, 0.3)",
                                    cursor: "pointer",
                                }}
                            >
                                <div style={{ position: "relative" }}>
                                    <SongCoverArt
                                        src={currentSong.cover_art_url}
                                        alt={currentSong.title}
                                        size={44}
                                        borderRadius={6}
                                        iconSize={20}
                                    />
                                    <div
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            backgroundColor: "rgba(0, 0, 0, 0.4)",
                                            borderRadius: 6,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "#ffffff",
                                        }}
                                    >
                                        {isPlaying ? (
                                            <Pause size={16} fill="#ffffff" />
                                        ) : (
                                            <Play size={16} fill="#ffffff" style={{ marginLeft: 2 }} />
                                        )}
                                    </div>
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: "var(--app-green)",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {currentSong.title}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "var(--app-subtext)",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            marginTop: 2,
                                        }}
                                    >
                                        {currentSong.artist}
                                    </div>
                                </div>

                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--app-subtext)",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {formatTime(currentSong.duration_sec || 0)}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* Up Next Section */}
                    <div>
                        <div
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                color: "var(--app-subtext)",
                                textTransform: "uppercase",
                                marginBottom: 10,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span>Up Next ({upcomingSongs.length})</span>
                        </div>

                        {upcomingSongs.length === 0 ? (
                            <div
                                style={{
                                    padding: "36px 16px",
                                    textAlign: "center",
                                    color: "var(--app-subtext)",
                                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                                    borderRadius: 10,
                                    border: "1px dashed rgba(255, 255, 255, 0.1)",
                                }}
                            >
                                <Music
                                    size={32}
                                    style={{ opacity: 0.3, margin: "0 auto 8px" }}
                                />
                                <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>
                                    No upcoming tracks in queue
                                </p>
                                <p style={{ fontSize: 12, opacity: 0.6, margin: "4px 0 0" }}>
                                    Use "Play next" or "Add to queue" to build your upcoming tracklist.
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {upcomingSongs.map((song, idx) => (
                                    <div
                                        key={`${song.id}-${idx}`}
                                        onClick={() => handlePlayItem(song)}
                                        className="app-table-row-hover"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                            padding: "8px 12px",
                                            borderRadius: 8,
                                            cursor: "pointer",
                                            transition: "background-color 0.15s ease",
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 12,
                                                color: "var(--app-subtext)",
                                                width: 20,
                                                textAlign: "center",
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {idx + 1}
                                        </span>

                                        <SongCoverArt
                                            src={song.cover_art_url}
                                            alt={song.title}
                                            size={38}
                                            borderRadius={4}
                                            iconSize={18}
                                        />

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 500,
                                                    color: "#ffffff",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {song.title}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: "var(--app-subtext)",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    marginTop: 1,
                                                }}
                                            >
                                                {song.artist}
                                            </div>
                                        </div>

                                        <span
                                            style={{
                                                fontSize: 12,
                                                color: "var(--app-subtext)",
                                                fontVariantNumeric: "tabular-nums",
                                                marginRight: 6,
                                            }}
                                        >
                                            {formatTime(song.duration_sec || 0)}
                                        </span>

                                        <button
                                            onClick={(e) => handleRemoveItem(e, song.id)}
                                            className="app-btn-ghost"
                                            title="Remove from queue"
                                            style={{
                                                padding: 6,
                                                color: "var(--app-subtext)",
                                                opacity: 0.7,
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.color = "#f87171";
                                                e.currentTarget.style.opacity = "1";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.color = "var(--app-subtext)";
                                                e.currentTarget.style.opacity = "0.7";
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
};
