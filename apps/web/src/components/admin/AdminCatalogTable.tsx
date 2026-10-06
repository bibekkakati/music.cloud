import React from "react";
import type { SongDetail } from "../../types";
import { SongCoverArt } from "../SongCoverArt";
import {
    Upload,
    CheckCircle2,
    Edit3,
    Eye,
    RefreshCw,
    RotateCw,
    Loader2,
    Play,
    Globe,
    Lock,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

interface AdminCatalogTableProps {
    songs: SongDetail[];
    loadingSongs: boolean;
    refreshingSongIds: Set<string>;
    reprocessingSongIds: Set<string>;
    togglingVisibilityIds: Set<string>;
    currentPage: number;
    hasNextPage: boolean;
    onPlaySong: (song: SongDetail, playlist: SongDetail[]) => void;
    onInspectSong: (song: SongDetail) => void;
    onEditSong: (song: SongDetail) => void;
    onToggleVisibility: (song: SongDetail) => void;
    onReprocessSong: (song: SongDetail) => void;
    onRefreshSongStatus: (songId: string) => void;
    onNextPage: () => void;
    onPrevPage: () => void;
    onSwitchToUpload: () => void;
}

export const AdminCatalogTable: React.FC<AdminCatalogTableProps> = ({
    songs,
    loadingSongs,
    refreshingSongIds,
    reprocessingSongIds,
    togglingVisibilityIds,
    currentPage,
    hasNextPage,
    onPlaySong,
    onInspectSong,
    onEditSong,
    onToggleVisibility,
    onReprocessSong,
    onRefreshSongStatus,
    onNextPage,
    onPrevPage,
    onSwitchToUpload,
}) => {
    if (loadingSongs && songs.length === 0) {
        return (
            <div style={{ padding: "80px 0", textAlign: "center" }}>
                <Loader2
                    size={36}
                    className="animate-spin"
                    color="var(--app-green)"
                    style={{ margin: "0 auto 12px" }}
                />
                <span
                    style={{
                        fontSize: 14,
                        color: "var(--app-subtext)",
                    }}
                >
                    Loading catalog tracks...
                </span>
            </div>
        );
    }

    if (songs.length === 0) {
        return (
            <div
                style={{
                    padding: "80px 0",
                    textAlign: "center",
                    color: "var(--app-subtext)",
                }}
            >
                <p
                    style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--app-text)",
                        marginBottom: 6,
                    }}
                >
                    No songs in the catalog
                </p>
                <p style={{ fontSize: 14, marginBottom: 20 }}>
                    Upload your first track to get started.
                </p>
                <button
                    type="button"
                    onClick={onSwitchToUpload}
                    className="app-btn-green"
                    style={{ padding: "12px 28px", fontSize: 14 }}
                >
                    <Upload size={16} />
                    <span>Upload Track</span>
                </button>
            </div>
        );
    }

    return (
        <>
            <div style={{ overflowX: "auto" }}>
                <table
                    style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        textAlign: "left",
                        fontSize: 13,
                    }}
                >
                    <thead>
                        <tr
                            style={{
                                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                                color: "var(--app-subtext)",
                                fontSize: 12,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            <th style={{ padding: "10px 14px" }}>Track</th>
                            <th style={{ padding: "10px 14px" }}>Duration</th>
                            <th style={{ padding: "10px 14px" }}>Bitrate</th>
                            <th style={{ padding: "10px 14px" }}>Keys</th>
                            <th style={{ padding: "10px 14px" }}>Status</th>
                            <th style={{ padding: "10px 14px" }}>Visibility</th>
                            <th style={{ padding: "10px 14px" }}>Created</th>
                            <th
                                style={{
                                    padding: "10px 14px",
                                    textAlign: "right",
                                }}
                            >
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {songs.map((song) => {
                            const isPrivateAndDone =
                                song.is_public === false &&
                                song.status?.toLowerCase() === "done";
                            return (
                                <tr
                                    key={song.id}
                                    style={{
                                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                                        transition: "all 0.15s ease",
                                        opacity: isPrivateAndDone ? 0.5 : 1,
                                        filter: isPrivateAndDone ? "grayscale(0.35)" : "none",
                                        background: isPrivateAndDone ? "rgba(0, 0, 0, 0.25)" : "transparent",
                                    }}
                                    onMouseEnter={(e) =>
                                        (e.currentTarget.style.background = isPrivateAndDone
                                            ? "rgba(255, 255, 255, 0.06)"
                                            : "rgba(255, 255, 255, 0.03)")
                                    }
                                    onMouseLeave={(e) =>
                                        (e.currentTarget.style.background = isPrivateAndDone
                                            ? "rgba(0, 0, 0, 0.25)"
                                            : "transparent")
                                    }
                                >
                                    {/* Track info */}
                                    <td style={{ padding: "12px 14px" }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                            }}
                                        >
                                            <SongCoverArt
                                                src={song.cover_art_url}
                                                alt={song.title}
                                                size={36}
                                                borderRadius={6}
                                                iconSize={18}
                                            />
                                            <div>
                                                <div
                                                    style={{
                                                        fontWeight: 600,
                                                        color: "var(--text-main)",
                                                    }}
                                                >
                                                    {song.title}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        color: "var(--text-secondary)",
                                                    }}
                                                >
                                                    {song.artist}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Duration */}
                                    <td
                                        style={{
                                            padding: "12px 14px",
                                            color: "var(--text-secondary)",
                                        }}
                                    >
                                        {song.duration_sec
                                            ? `${Math.floor(song.duration_sec / 60)}:${String(Math.floor(song.duration_sec % 60)).padStart(2, "0")}`
                                            : "N/A"}
                                    </td>

                                    {/* Bitrate */}
                                    <td
                                        style={{
                                            padding: "12px 14px",
                                            color: "var(--text-secondary)",
                                        }}
                                    >
                                        {song.source_bitrate_kbps
                                            ? `${song.source_bitrate_kbps} kbps`
                                            : "Auto"}
                                    </td>

                                    {/* Keys Badge */}
                                    <td style={{ padding: "12px 14px" }}>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                padding: "3px 8px",
                                                borderRadius: 999,
                                                background: "rgba(99, 102, 241, 0.15)",
                                                color: "var(--primary)",
                                                fontWeight: 600,
                                            }}
                                        >
                                            MP3 / AAC
                                        </span>
                                    </td>

                                    {/* Status & Refresh */}
                                    <td style={{ padding: "12px 14px" }}>
                                        {song.status?.toUpperCase() === "DONE" ? (
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
                                                                : "rgba(234, 179, 8, 0.15)",
                                                        color:
                                                            song.status?.toUpperCase() === "FAILED"
                                                                ? "#ef4444"
                                                                : "#eab308",
                                                        fontWeight: 600,
                                                        textTransform: "uppercase",
                                                    }}
                                                >
                                                    {song.status || "QUEUED"}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => onRefreshSongStatus(song.id)}
                                                    disabled={refreshingSongIds.has(song.id)}
                                                    title="Fetch updated status"
                                                    style={{
                                                        background: "rgba(255, 255, 255, 0.06)",
                                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                                        borderRadius: "50%",
                                                        width: 24,
                                                        height: 24,
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        cursor: refreshingSongIds.has(song.id)
                                                            ? "not-allowed"
                                                            : "pointer",
                                                        color: "var(--text-main)",
                                                        transition: "all 0.2s ease",
                                                        padding: 0,
                                                    }}
                                                    onMouseEnter={(e) =>
                                                        (e.currentTarget.style.background =
                                                            "rgba(255, 255, 255, 0.15)")
                                                    }
                                                    onMouseLeave={(e) =>
                                                        (e.currentTarget.style.background =
                                                            "rgba(255, 255, 255, 0.06)")
                                                    }
                                                >
                                                    <RefreshCw
                                                        size={12}
                                                        className={
                                                            refreshingSongIds.has(song.id)
                                                                ? "animate-spin"
                                                                : ""
                                                        }
                                                    />
                                                </button>
                                            </div>
                                        )}
                                    </td>

                                    {/* Visibility */}
                                    <td style={{ padding: "12px 14px" }}>
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

                                    {/* Created */}
                                    <td
                                        style={{
                                            padding: "12px 14px",
                                            color: "var(--text-muted)",
                                            fontSize: 12,
                                        }}
                                    >
                                        {new Date(song.created_at).toLocaleDateString()}
                                    </td>

                                    {/* Actions */}
                                    <td
                                        style={{
                                            padding: "12px 14px",
                                            textAlign: "right",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 6,
                                            }}
                                        >
                                            {/* Toggle Visibility */}
                                            <button
                                                type="button"
                                                onClick={() => onToggleVisibility(song)}
                                                disabled={togglingVisibilityIds.has(song.id)}
                                                className="btn-ghost"
                                                title={
                                                    song.is_public !== false
                                                        ? "Mark as Private (hide from normal users)"
                                                        : "Mark as Public (visible to all users)"
                                                }
                                                style={{
                                                    padding: 6,
                                                    color:
                                                        song.is_public !== false
                                                            ? "var(--app-green)"
                                                            : "#f59e0b",
                                                }}
                                            >
                                                {togglingVisibilityIds.has(song.id) ? (
                                                    <Loader2
                                                        size={15}
                                                        className="animate-spin"
                                                    />
                                                ) : song.is_public !== false ? (
                                                    <Globe size={15} />
                                                ) : (
                                                    <Lock size={15} />
                                                )}
                                            </button>

                                            <button
                                                onClick={() => onPlaySong(song, songs)}
                                                className="btn-ghost"
                                                title="Play Preview"
                                                style={{ padding: 6 }}
                                            >
                                                <Play
                                                    size={15}
                                                    color="var(--accent-cyan)"
                                                />
                                            </button>

                                            <button
                                                onClick={() => onInspectSong(song)}
                                                className="btn-ghost"
                                                title="Inspect Object Keys"
                                                style={{ padding: 6 }}
                                            >
                                                <Eye size={15} />
                                            </button>

                                            <button
                                                onClick={() => onEditSong(song)}
                                                className="btn-ghost"
                                                title="Edit Metadata"
                                                style={{
                                                    padding: 6,
                                                    color: "var(--app-subtext)",
                                                }}
                                            >
                                                <Edit3 size={15} />
                                            </button>

                                            <button
                                                onClick={() => onReprocessSong(song)}
                                                disabled={reprocessingSongIds.has(song.id)}
                                                className="btn-ghost"
                                                title="Reprocess Audio (Transcode & Segment)"
                                                style={{
                                                    padding: 6,
                                                    color: "var(--primary)",
                                                }}
                                            >
                                                {reprocessingSongIds.has(song.id) ? (
                                                    <Loader2
                                                        size={15}
                                                        className="animate-spin"
                                                    />
                                                ) : (
                                                    <RotateCw size={15} />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Bounded Cursor Pagination Controls */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 20,
                    padding: "12px 18px",
                    background: "var(--app-card-bg)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        fontSize: 13,
                        color: "var(--app-subtext)",
                    }}
                >
                    <span style={{ fontWeight: 600, color: "var(--app-text)" }}>
                        Page {currentPage}
                    </span>
                    <span>•</span>
                    <span>
                        Showing {songs.length} track{songs.length === 1 ? "" : "s"}
                    </span>
                    {loadingSongs && (
                        <Loader2
                            size={14}
                            className="animate-spin"
                            color="var(--app-green)"
                        />
                    )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                        type="button"
                        onClick={onPrevPage}
                        disabled={currentPage <= 1 || loadingSongs}
                        className="app-tag-pill"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 16px",
                            fontSize: 13,
                            background:
                                currentPage <= 1
                                    ? "rgba(255, 255, 255, 0.03)"
                                    : "rgba(255, 255, 255, 0.08)",
                            color:
                                currentPage <= 1
                                    ? "rgba(255, 255, 255, 0.25)"
                                    : "var(--app-text)",
                            cursor:
                                currentPage <= 1 || loadingSongs
                                    ? "not-allowed"
                                    : "pointer",
                            border: "none",
                        }}
                    >
                        <ChevronLeft size={16} />
                        <span>Previous</span>
                    </button>

                    <button
                        type="button"
                        onClick={onNextPage}
                        disabled={!hasNextPage || loadingSongs}
                        className="app-tag-pill"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 16px",
                            fontSize: 13,
                            background:
                                !hasNextPage
                                    ? "rgba(255, 255, 255, 0.03)"
                                    : "rgba(255, 255, 255, 0.08)",
                            color:
                                !hasNextPage
                                    ? "rgba(255, 255, 255, 0.25)"
                                    : "var(--app-text)",
                            cursor:
                                !hasNextPage || loadingSongs
                                    ? "not-allowed"
                                    : "pointer",
                            border: "none",
                        }}
                    >
                        <span>Next</span>
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </>
    );
};
