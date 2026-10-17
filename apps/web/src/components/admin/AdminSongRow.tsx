import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { SongDetail } from "../../types";
import { usePlayer } from "../../context/PlayerContext";
import { SongCoverArt } from "../SongCoverArt";
import {
    Play,
    Pause,
    MoreHorizontal,
    Edit3,
    Sparkles,
    Eye,
    RotateCw,
    Trash2,
    RefreshCw,
    CheckCircle2,
    Clock,
    AlertCircle,
    Globe,
    Lock,
    Loader2,
} from "lucide-react";
import { formatDuration } from "@music-cloud/utils";

interface AdminSongRowProps {
    song: SongDetail;
    index: number;
    allSongs: SongDetail[];
    isRefreshing?: boolean;
    isReprocessing?: boolean;
    isSyncingProperties?: boolean;
    onEditSong: (song: SongDetail) => void;
    onInspectSong: (song: SongDetail) => void;
    onReprocessSong: (song: SongDetail) => void;
    onRefreshSongStatus: (song: SongDetail) => void;
    onDeleteSong?: (song: SongDetail) => void;
    onSyncProperties: (song: SongDetail) => void;
}

export const AdminSongRow: React.FC<AdminSongRowProps> = ({
    song,
    index,
    allSongs,
    isRefreshing = false,
    isReprocessing = false,
    isSyncingProperties = false,
    onEditSong,
    onInspectSong,
    onReprocessSong,
    onRefreshSongStatus,
    onDeleteSong,
    onSyncProperties,
}) => {
    const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
    const [isHovered, setIsHovered] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const isThisPlaying = currentSong?.id === song.id && isPlaying;
    const isCurrentTrack = currentSong?.id === song.id;
    const isDone = song.status?.toUpperCase() === "DONE";
    const isPrivateAndDone = song.is_public === false && isDone;

    const handleRowClick = () => {
        if (!isDone) return;
        if (isCurrentTrack) {
            togglePlay();
        } else {
            playSong(song, allSongs);
        }
    };

    const handleMoreButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setContextMenuPos({
            x: Math.max(10, Math.min(rect.right - 210, window.innerWidth - 220)),
            y: Math.min(rect.bottom + 4, window.innerHeight - 280),
        });
    };

    // Close menu on outside click or scroll
    useEffect(() => {
        if (!contextMenuPos) return;

        const handleClose = (e: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setContextMenuPos(null);
            }
        };

        const handleScroll = () => setContextMenuPos(null);

        window.addEventListener("click", handleClose);
        window.addEventListener("contextmenu", handleClose);
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", handleScroll);

        return () => {
            window.removeEventListener("click", handleClose);
            window.removeEventListener("contextmenu", handleClose);
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", handleScroll);
        };
    }, [contextMenuPos]);

    return (
        <>
            <tr
                style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    transition: "all 0.15s ease",
                    opacity: isPrivateAndDone ? 0.6 : 1,
                    filter: isPrivateAndDone ? "grayscale(0.35)" : "none",
                    background: isCurrentTrack
                        ? "rgba(30, 215, 96, 0.08)"
                        : isHovered
                          ? "rgba(255, 255, 255, 0.04)"
                          : "transparent",
                    cursor: isDone ? "pointer" : "default",
                }}
                onClick={handleRowClick}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenuPos({
                        x: Math.min(e.clientX, window.innerWidth - 220),
                        y: Math.min(e.clientY, window.innerHeight - 280),
                    });
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* 1. Track Index / Play Button */}
                <td
                    style={{
                        padding: "12px 14px",
                        textAlign: "center",
                        width: 48,
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                >
                    {isDone && (isHovered || isCurrentTrack) ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick();
                            }}
                            title={isThisPlaying ? "Pause" : "Play"}
                            style={{
                                background: "none",
                                border: "none",
                                color: isCurrentTrack
                                    ? "var(--app-green)"
                                    : "#ffffff",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 0,
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
                                fontSize: 13,
                                color: isCurrentTrack
                                    ? "var(--app-green)"
                                    : "var(--app-subtext)",
                                fontWeight: isCurrentTrack ? 700 : 500,
                            }}
                        >
                            {index + 1}
                        </span>
                    )}
                </td>

                {/* 2. Track Title, Artist & Tags (Level 1, 2, 3) */}
                <td
                    style={{
                        padding: "12px 14px",
                        minWidth: 200,
                        maxWidth: 280,
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            maxWidth: "100%",
                        }}
                    >
                        <SongCoverArt
                            src={song.cover_art_url}
                            alt={song.title}
                            size={40}
                            borderRadius={6}
                            iconSize={20}
                        />
                        <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                            {/* Level 1: Track Title */}
                            <div
                                style={{
                                    fontWeight: 600,
                                    fontSize: 14,
                                    color: isCurrentTrack
                                        ? "var(--app-green)"
                                        : "var(--text-main)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                                title={song.title}
                            >
                                {song.title}
                            </div>

                            {/* Level 2: Track Artist & Album */}
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "var(--text-secondary)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    marginTop: 2,
                                }}
                                title={`${song.artist}${song.album ? ` • ${song.album}` : ""}`}
                            >
                                {song.artist}
                                {song.album && (
                                    <span style={{ opacity: 0.65 }}>
                                        {" "}
                                        • {song.album}
                                    </span>
                                )}
                            </div>

                            {/* Level 3: Genre, Moods, Language */}
                            {(song.genre ||
                                (song.moods && song.moods.length > 0) ||
                                song.language) && (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        flexWrap: "wrap",
                                        marginTop: 5,
                                    }}
                                >
                                    {song.genre && (
                                        <span
                                            style={{
                                                fontSize: 10,
                                                padding: "1px 6px",
                                                borderRadius: 4,
                                                background:
                                                    "rgba(255, 255, 255, 0.08)",
                                                color: "var(--app-text)",
                                                fontWeight: 500,
                                                whiteSpace: "nowrap",
                                            }}
                                            title={`Genre: ${song.genre}`}
                                        >
                                            {song.genre}
                                        </span>
                                    )}
                                    {song.language && (
                                        <span
                                            style={{
                                                fontSize: 10,
                                                padding: "1px 6px",
                                                borderRadius: 4,
                                                background:
                                                    "rgba(56, 189, 248, 0.12)",
                                                color: "#38bdf8",
                                                fontWeight: 500,
                                                whiteSpace: "nowrap",
                                            }}
                                            title={`Language: ${song.language}`}
                                        >
                                            {song.language}
                                        </span>
                                    )}
                                    {song.moods &&
                                        song.moods.map((mood) => (
                                            <span
                                                key={mood}
                                                style={{
                                                    fontSize: 10,
                                                    padding: "1px 6px",
                                                    borderRadius: 4,
                                                    background:
                                                        "rgba(234, 179, 8, 0.12)",
                                                    color: "#facc15",
                                                    fontWeight: 500,
                                                    whiteSpace: "nowrap",
                                                }}
                                                title={`Mood: ${mood}`}
                                            >
                                                {mood}
                                            </span>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>
                </td>

                {/* 3. Duration */}
                <td
                    style={{
                        padding: "12px 14px",
                        color: "var(--text-secondary)",
                        fontSize: 13,
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                >
                    {song.duration_sec
                        ? formatDuration(song.duration_sec)
                        : "N/A"}
                </td>

                {/* 4. Bitrate */}
                <td
                    style={{
                        padding: "12px 14px",
                        color: "var(--text-secondary)",
                        fontSize: 13,
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                >
                    {song.source_bitrate_kbps
                        ? `${song.source_bitrate_kbps} kbps`
                        : "Auto"}
                </td>

                {/* 5. Status & Refresh */}
                <td
                    style={{
                        padding: "12px 14px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                >
                    {isDone ? (
                        <span
                            style={{
                                fontSize: 11,
                                padding: "3px 8px",
                                borderRadius: 999,
                                background: "rgba(30, 215, 96, 0.15)",
                                color: "#1ed760",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                            }}
                        >
                            <CheckCircle2 size={12} />
                            DONE
                        </span>
                    ) : (
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 11,
                                    padding: "3px 8px",
                                    borderRadius: 999,
                                    background:
                                        song.status?.toUpperCase() === "FAILED"
                                            ? "rgba(239, 68, 68, 0.15)"
                                            : "rgba(245, 158, 11, 0.15)",
                                    color:
                                        song.status?.toUpperCase() === "FAILED"
                                            ? "#ef4444"
                                            : "#f59e0b",
                                    fontWeight: 600,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                }}
                            >
                                {song.status?.toUpperCase() === "FAILED" ? (
                                    <AlertCircle size={12} />
                                ) : (
                                    <Clock size={12} />
                                )}
                                {song.status?.toUpperCase() || "PENDING"}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRefreshSongStatus(song);
                                }}
                                disabled={isRefreshing}
                                className="btn-ghost"
                                title="Check processing status"
                                style={{ padding: 4 }}
                            >
                                <RefreshCw
                                    size={12}
                                    className={
                                        isRefreshing ? "animate-spin" : ""
                                    }
                                />
                            </button>
                        </div>
                    )}
                </td>

                {/* 6. Visibility */}
                <td
                    style={{
                        padding: "12px 14px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                >
                    {song.is_public !== false ? (
                        <span
                            style={{
                                fontSize: 11,
                                padding: "3px 8px",
                                borderRadius: 999,
                                background: "rgba(30, 215, 96, 0.15)",
                                color: "var(--app-green)",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                            }}
                        >
                            <Globe size={11} />
                            PUBLIC
                        </span>
                    ) : (
                        <span
                            style={{
                                fontSize: 11,
                                padding: "3px 8px",
                                borderRadius: 999,
                                background: "rgba(245, 158, 11, 0.15)",
                                color: "#f59e0b",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                            }}
                        >
                            <Lock size={11} />
                            PRIVATE
                        </span>
                    )}
                </td>

                {/* 7. Created */}
                <td
                    style={{
                        padding: "12px 14px",
                        color: "var(--text-muted)",
                        fontSize: 12,
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                >
                    {new Date(song.created_at).toLocaleDateString()}
                </td>

                {/* 8. Actions Column with MoreHorizontal (Sticky Right) */}
                <td
                    style={{
                        padding: "12px 14px",
                        textAlign: "center",
                        width: 56,
                        position: "sticky",
                        right: 0,
                        background: isCurrentTrack
                            ? "#14241a"
                            : isHovered || Boolean(contextMenuPos)
                              ? "#1c1c1c"
                              : "var(--app-base, #121212)",
                        zIndex: 2,
                        boxShadow: "-4px 0 8px rgba(0, 0, 0, 0.35)",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                        transition: "background 0.15s ease",
                    }}
                >
                    <button
                        onClick={handleMoreButtonClick}
                        className="btn-ghost"
                        title="More options"
                        style={{
                            padding: 6,
                            borderRadius: "50%",
                            color:
                                isHovered || Boolean(contextMenuPos)
                                    ? "#ffffff"
                                    : "var(--app-subtext)",
                            opacity:
                                isHovered || Boolean(contextMenuPos) ? 1 : 0.6,
                            transition: "all 0.15s ease",
                        }}
                    >
                        <MoreHorizontal size={18} />
                    </button>
                </td>
            </tr>

            {/* Portal Context Menu */}
            {contextMenuPos &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="animate-fade-in"
                        style={{
                            position: "fixed",
                            left: contextMenuPos.x,
                            top: contextMenuPos.y,
                            width: 210,
                            background: "#282828",
                            borderRadius: 8,
                            padding: "4px 0",
                            boxShadow:
                                "0 16px 36px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)",
                            zIndex: 9999,
                            userSelect: "none",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 1. Edit Metadata */}
                        <button
                            onClick={() => {
                                setContextMenuPos(null);
                                onEditSong(song);
                            }}
                            className="context-menu-item"
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 14px",
                                background: "none",
                                border: "none",
                                color: "#ffffff",
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                    "rgba(255, 255, 255, 0.1)")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.background = "none")
                            }
                        >
                            <Edit3 size={15} color="var(--app-subtext)" />
                            <span>Edit Metadata</span>
                        </button>

                        {/* 2. Resync Properties */}
                        <button
                            onClick={() => {
                                setContextMenuPos(null);
                                onSyncProperties(song);
                            }}
                            disabled={isSyncingProperties}
                            className="context-menu-item"
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 14px",
                                background: "none",
                                border: "none",
                                color: "#ffffff",
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: isSyncingProperties
                                    ? "not-allowed"
                                    : "pointer",
                                textAlign: "left",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                    "rgba(255, 255, 255, 0.1)")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.background = "none")
                            }
                        >
                            {isSyncingProperties ? (
                                <Loader2
                                    size={15}
                                    className="animate-spin"
                                    color="var(--app-green)"
                                />
                            ) : (
                                <Sparkles size={15} color="var(--app-green)" />
                            )}
                            <span>Resync Properties</span>
                        </button>

                        {/* 3. Inspect Object Keys */}
                        <button
                            onClick={() => {
                                setContextMenuPos(null);
                                onInspectSong(song);
                            }}
                            className="context-menu-item"
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 14px",
                                background: "none",
                                border: "none",
                                color: "#ffffff",
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                    "rgba(255, 255, 255, 0.1)")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.background = "none")
                            }
                        >
                            <Eye size={15} color="var(--app-subtext)" />
                            <span>Inspect Object Keys</span>
                        </button>

                        {/* 4. Reprocess Audio */}
                        <button
                            onClick={() => {
                                setContextMenuPos(null);
                                onReprocessSong(song);
                            }}
                            disabled={isReprocessing}
                            className="context-menu-item"
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 14px",
                                background: "none",
                                border: "none",
                                color: "#ffffff",
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: isReprocessing
                                    ? "not-allowed"
                                    : "pointer",
                                textAlign: "left",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                    "rgba(255, 255, 255, 0.1)")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.background = "none")
                            }
                        >
                            {isReprocessing ? (
                                <Loader2
                                    size={15}
                                    className="animate-spin"
                                    color="var(--primary)"
                                />
                            ) : (
                                <RotateCw size={15} color="var(--primary)" />
                            )}
                            <span>Reprocess Audio</span>
                        </button>

                        {/* Divider */}
                        {onDeleteSong && (
                            <div
                                style={{
                                    height: 1,
                                    background: "rgba(255, 255, 255, 0.08)",
                                    margin: "4px 0",
                                }}
                            />
                        )}

                        {/* 5. Delete Track */}
                        {onDeleteSong && (
                            <button
                                onClick={() => {
                                    setContextMenuPos(null);
                                    onDeleteSong(song);
                                }}
                                className="context-menu-item"
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "10px 14px",
                                    background: "none",
                                    border: "none",
                                    color: "#ef4444",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    textAlign: "left",
                                    transition: "background 0.15s",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.background =
                                        "rgba(239, 68, 68, 0.15)")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.background = "none")
                                }
                            >
                                <Trash2 size={15} color="#ef4444" />
                                <span>Delete Track</span>
                            </button>
                        )}
                    </div>,
                    document.body,
                )}
        </>
    );
};
