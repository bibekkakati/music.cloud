import React from "react";
import type { SongDetail } from "../../types";
import { AdminSongRow } from "./AdminSongRow";
import {
    Upload,
    ChevronLeft,
    ChevronRight,
    Filter,
    Loader2,
    RefreshCw,
} from "lucide-react";

import { AdminFilterTabs, type FilterTabOption } from "./AdminFilterTabs";

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
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

const STATUS_OPTIONS: FilterTabOption[] = [
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
    onRefresh,
    isRefreshing = false,
}) => {
    const isFiltered = selectedStatus.toUpperCase() !== "ALL";

    const renderFilterToolbar = () => (
        <div className="admin-filter-toolbar">
            <AdminFilterTabs
                label="Status:"
                icon={<Filter size={14} />}
                options={STATUS_OPTIONS}
                value={selectedStatus}
                onChange={onStatusChange}
            />

            <div className="admin-filter-meta">
                {loadingSongs && (
                    <span className="admin-filter-loading">
                        <Loader2 size={13} className="animate-spin" />
                        Loading...
                    </span>
                )}
                {songs.length > 0 && (
                    <span>
                        {songs.length} track{songs.length === 1 ? "" : "s"} on page {currentPage}
                    </span>
                )}
                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isRefreshing || loadingSongs}
                        className="admin-toolbar-btn admin-table-refresh-btn"
                        title="Refresh current catalog page"
                    >
                        <RefreshCw
                            size={13}
                            className={
                                isRefreshing || loadingSongs
                                    ? "animate-spin"
                                    : ""
                            }
                        />
                        <span>Refresh</span>
                    </button>
                )}
            </div>
        </div>
    );

    if (loadingSongs && songs.length === 0) {
        return (
            <div>
                {renderFilterToolbar()}
                <div className="admin-empty-state">
                    <Loader2
                        size={36}
                        className="animate-spin admin-empty-state-icon"
                        color="var(--app-green)"
                    />
                    <span className="admin-pagination-info">
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
                <div className="admin-empty-state">
                    <p className="admin-empty-state-title">
                        {isFiltered
                            ? `No tracks found with status "${selectedStatus.toLowerCase()}"`
                            : "No songs in the catalog"}
                    </p>
                    <p className="admin-empty-state-desc">
                        {isFiltered
                            ? "Try choosing a different status filter or reset to view all tracks."
                            : "Upload your first track to get started."}
                    </p>
                    {isFiltered ? (
                        <button
                            type="button"
                            onClick={() => onStatusChange("ALL")}
                            className="app-tag-pill active"
                        >
                            Reset Filter to All
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onSwitchToUpload}
                            className="app-btn-green"
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
            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th className="admin-table-th center">#</th>
                            <th className="admin-table-th">Track</th>
                            <th className="admin-table-th">Duration</th>
                            <th className="admin-table-th">Bitrate</th>
                            <th className="admin-table-th">Status</th>
                            <th className="admin-table-th">Visibility</th>
                            <th className="admin-table-th">Created</th>
                            <th className="admin-table-th sticky-actions"></th>
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
            <div className="admin-pagination-container">
                <div className="admin-pagination-info">
                    <span className="admin-pagination-page-bold">
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

                <div className="admin-pagination-actions">
                    <button
                        type="button"
                        onClick={onPrevPage}
                        disabled={currentPage <= 1 || loadingSongs}
                        className="admin-toolbar-btn"
                    >
                        <ChevronLeft size={16} />
                        <span>Previous</span>
                    </button>

                    <button
                        type="button"
                        onClick={onNextPage}
                        disabled={!hasNextPage || loadingSongs}
                        className="admin-toolbar-btn"
                    >
                        <span>Next</span>
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </>
    );
};
