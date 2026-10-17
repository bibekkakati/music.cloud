import React from "react";
import type { SongDetail } from "../../types";
import { AdminSongRow } from "./AdminSongRow";
import {
    Upload,
    ChevronLeft,
    ChevronRight,
    Filter,
    Loader2,
} from "lucide-react";

interface AdminCatalogTableProps {
    songs: SongDetail[];
    loadingSongs: boolean;
    refreshingSongIds: Set<string>;
    reprocessingSongIds: Set<string>;
    resyncingSongIds?: Set<string>;
    currentPage: number;
    hasNextPage: boolean;
    selectedStatus: string;
    onStatusChange: (status: string) => void;
    onPlaySong: (song: SongDetail, playlist: SongDetail[]) => void;
    onInspectSong: (song: SongDetail) => void;
    onEditSong: (song: SongDetail) => void;
    onReprocessSong: (song: SongDetail) => void;
    onRefreshSongStatus: (songId: string) => void;
    onDeleteSong?: (song: SongDetail) => void;
    onSyncProperties: (song: SongDetail) => void;
    onNextPage: () => void;
    onPrevPage: () => void;
    onSwitchToUpload: () => void;
}

const STATUS_OPTIONS: { label: string; value: string; color?: string }[] = [
    { label: "All", value: "ALL" },
    { label: "Done", value: "DONE", color: "#1ed760" },
    { label: "Processing", value: "PROCESSING", color: "#eab308" },
    { label: "Uploaded", value: "UPLOADED", color: "#38bdf8" },
    { label: "Uploading", value: "UPLOADING", color: "#f97316" },
    { label: "Failed", value: "FAILED", color: "#ef4444" },
];

export const AdminCatalogTable: React.FC<AdminCatalogTableProps> = ({
    songs,
    loadingSongs,
    refreshingSongIds,
    reprocessingSongIds,
    resyncingSongIds,
    currentPage,
    hasNextPage,
    selectedStatus,
    onStatusChange,
    onInspectSong,
    onEditSong,
    onReprocessSong,
    onRefreshSongStatus,
    onDeleteSong,
    onSyncProperties,
    onNextPage,
    onPrevPage,
    onSwitchToUpload,
}) => {
    const isFiltered = selectedStatus.toUpperCase() !== "ALL";

    const renderFilterToolbar = () => (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                }}
            >
                <div
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--app-subtext)",
                        marginRight: 4,
                    }}
                >
                    <Filter size={14} />
                    <span>Status:</span>
                </div>
                {STATUS_OPTIONS.map((opt) => {
                    const isActive = selectedStatus.toUpperCase() === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onStatusChange(opt.value)}
                            className={`app-tag-pill ${isActive ? "active" : ""}`}
                            style={{
                                padding: "6px 14px",
                                fontSize: 12,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                cursor: "pointer",
                            }}
                        >
                            {opt.color && (
                                <span
                                    style={{
                                        width: 7,
                                        height: 7,
                                        borderRadius: "50%",
                                        backgroundColor: opt.color,
                                        display: "inline-block",
                                    }}
                                />
                            )}
                            <span>{opt.label}</span>
                        </button>
                    );
                })}
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontSize: 12,
                    color: "var(--app-subtext)",
                }}
            >
                {loadingSongs && (
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            color: "var(--app-green)",
                        }}
                    >
                        <Loader2 size={13} className="animate-spin" />
                        Loading...
                    </span>
                )}
                {songs.length > 0 && (
                    <span>
                        {songs.length} track{songs.length === 1 ? "" : "s"} on page {currentPage}
                    </span>
                )}
            </div>
        </div>
    );

    if (loadingSongs && songs.length === 0) {
        return (
            <div>
                {renderFilterToolbar()}
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
            </div>
        );
    }

    if (songs.length === 0) {
        return (
            <div>
                {renderFilterToolbar()}
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
                        {isFiltered
                            ? `No tracks found with status "${selectedStatus.toLowerCase()}"`
                            : "No songs in the catalog"}
                    </p>
                    <p style={{ fontSize: 14, marginBottom: 20 }}>
                        {isFiltered
                            ? "Try choosing a different status filter or reset to view all tracks."
                            : "Upload your first track to get started."}
                    </p>
                    {isFiltered ? (
                        <button
                            type="button"
                            onClick={() => onStatusChange("ALL")}
                            className="app-tag-pill active"
                            style={{ padding: "10px 24px", fontSize: 13 }}
                        >
                            Reset Filter to All
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onSwitchToUpload}
                            className="app-btn-green"
                            style={{ padding: "12px 28px", fontSize: 14 }}
                        >
                            <Upload size={16} />
                            <span>Upload Track</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <>
            {renderFilterToolbar()}
            <div style={{ overflowX: "auto", position: "relative" }}>
                <table
                    style={{
                        width: "100%",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                        textAlign: "left",
                        fontSize: 13,
                    }}
                >
                    <thead>
                        <tr
                            style={{
                                color: "var(--app-subtext)",
                                fontSize: 12,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            <th
                                style={{
                                    padding: "10px 14px",
                                    width: 48,
                                    textAlign: "center",
                                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                                }}
                            >
                                #
                            </th>
                            <th
                                style={{
                                    padding: "10px 14px",
                                    minWidth: 200,
                                    maxWidth: 280,
                                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                                }}
                            >
                                Track
                            </th>
                            <th
                                style={{
                                    padding: "10px 14px",
                                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                                }}
                            >
                                Duration
                            </th>
                            <th
                                style={{
                                    padding: "10px 14px",
                                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                                }}
                            >
                                Bitrate
                            </th>
                            <th
                                style={{
                                    padding: "10px 14px",
                                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                                }}
                            >
                                Status
                            </th>
                            <th
                                style={{
                                    padding: "10px 14px",
                                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                                }}
                            >
                                Visibility
                            </th>
                            <th
                                style={{
                                    padding: "10px 14px",
                                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                                }}
                            >
                                Created
                            </th>
                            <th
                                style={{
                                    padding: "10px 14px",
                                    textAlign: "center",
                                    width: 56,
                                    position: "sticky",
                                    right: 0,
                                    background: "var(--app-base, #121212)",
                                    zIndex: 10,
                                    boxShadow: "-4px 0 8px rgba(0, 0, 0, 0.35)",
                                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                                }}
                            ></th>
                        </tr>
                    </thead>
                    <tbody>
                        {songs.map((song, idx) => (
                            <AdminSongRow
                                key={song.id}
                                song={song}
                                index={(currentPage - 1) * 20 + idx}
                                allSongs={songs}
                                isRefreshing={refreshingSongIds.has(song.id)}
                                isReprocessing={reprocessingSongIds.has(song.id)}
                                isSyncingProperties={resyncingSongIds?.has(song.id)}
                                onEditSong={onEditSong}
                                onInspectSong={onInspectSong}
                                onReprocessSong={onReprocessSong}
                                onRefreshSongStatus={() => onRefreshSongStatus(song.id)}
                                onDeleteSong={onDeleteSong}
                                onSyncProperties={onSyncProperties}
                            />
                        ))}
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
