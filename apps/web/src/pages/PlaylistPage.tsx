import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { playlistService } from "../services/playlistService";
import { songService } from "../services/songService";
import type { PlaylistDetail, SongMetadata } from "../types";
import { SongRow } from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import { useToast } from "../context/ToastContext";
import {
    Play,
    Pause,
    Trash2,
    Edit2,
    Music,
    Loader2,
    Clock3,
} from "lucide-react";

interface PlaylistPageProps {
    onEditPlaylist: (playlist: { id: string; label: string }) => void;
    onPlaylistDeleted: () => void;
}

export const PlaylistPage: React.FC<PlaylistPageProps> = ({
    onEditPlaylist,
    onPlaylistDeleted,
}) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
    const [songMetaMap, setSongMetaMap] = useState<
        Record<string, SongMetadata>
    >({});
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
    const { showToast } = useToast();

    const loadPlaylistData = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await playlistService.getPlaylistSongs(id);
            setPlaylist(data);

            try {
                const librarySongs = await songService.getAllSongs();
                const map: Record<string, SongMetadata> = {};
                librarySongs.forEach((s) => {
                    map[s.id] = s;
                });
                setSongMetaMap(map);
            } catch {
                // ignore
            }
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Could not load playlist.";
            showToast("Error", "error", msg);
        } finally {
            setLoading(false);
        }
    }, [id, showToast]);

    useEffect(() => {
        loadPlaylistData();
    }, [loadPlaylistData]);

    const playableTracks: SongMetadata[] = (playlist?.songs || []).map(
        (item) => {
            const meta = songMetaMap[item.song_id];
            return {
                id: item.song_id,
                title:
                    item.title ||
                    meta?.title ||
                    `Track #${item.song_id.substring(0, 8)}`,
                artist: item.artist || meta?.artist || "Cloud Track",
                duration_sec:
                    item.duration_sec !== undefined &&
                    item.duration_sec !== null
                        ? item.duration_sec
                        : meta?.duration_sec,
                cover_art_url: item.cover_art_url || meta?.cover_art_url,
                stream_url: item.stream_url || meta?.stream_url,
            };
        },
    );

    const isPlaylistPlaying =
        playableTracks.length > 0 &&
        playableTracks.some((t) => t.id === currentSong?.id) &&
        isPlaying;

    const handlePlayToggle = () => {
        if (playableTracks.length === 0) return;
        if (isPlaylistPlaying) {
            togglePlay();
        } else {
            playSong(playableTracks[0], playableTracks);
        }
    };

    const handleRemoveSong = async (playlistSongId: string) => {
        try {
            await playlistService.removeSongFromPlaylist(playlistSongId);
            showToast("Song Removed", "info", "Removed track from playlist");
            loadPlaylistData();
            window.dispatchEvent(new CustomEvent("playlist-mutation"));
        } catch {
            showToast("Error", "error", "Could not remove song from playlist");
        }
    };

    const handleDeletePlaylist = async () => {
        if (
            !playlist ||
            !window.confirm(
                `Are you sure you want to delete "${playlist.label}"?`,
            )
        ) {
            return;
        }

        try {
            setDeleting(true);
            await playlistService.removePlaylist(playlist.id);
            showToast(
                "Playlist Deleted",
                "info",
                `Deleted "${playlist.label}"`,
            );
            onPlaylistDeleted();
            window.dispatchEvent(new CustomEvent("playlist-mutation"));
            navigate("/");
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Could not delete playlist";
            showToast("Error", "error", msg);
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "60vh",
                }}
            >
                <Loader2
                    size={36}
                    className="animate-spin"
                    color="var(--app-green)"
                />
            </div>
        );
    }

    if (!playlist) {
        return (
            <div
                style={{
                    padding: 48,
                    textAlign: "center",
                    color: "var(--app-subtext)",
                }}
            >
                <p
                    style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#fff",
                        marginBottom: 8,
                    }}
                >
                    Playlist not found
                </p>
                <button onClick={() => navigate("/")} className="app-btn-pill">
                    Back to Home
                </button>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: 120 }}>
            {/* 1. Massive Gradient Header */}
            <div className="playlist-hero-header">
                {/* Playlist Cover Art */}
                <div className="playlist-cover-box">
                    <Music size={64} color="var(--app-subtext)" />
                </div>

                {/* Metadata Details */}
                <div className="playlist-meta-details">
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: "#ffffff",
                            letterSpacing: "0.08em",
                        }}
                    >
                        Public Playlist
                    </span>

                    <h1 className="playlist-title">{playlist.label}</h1>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#ffffff",
                        }}
                    >
                        <span
                            style={{
                                color: "var(--app-subtext)",
                                fontWeight: 500,
                            }}
                        >
                            {playlist.songs.length} song
                            {playlist.songs.length === 1 ? "" : "s"}
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. Action Bar with Big Green Play Button */}
            <div className="playlist-action-bar">
                <button
                    onClick={handlePlayToggle}
                    disabled={playlist.songs.length === 0}
                    className="app-play-btn"
                    style={{ width: 52, height: 52 }}
                    title={isPlaylistPlaying ? "Pause" : "Play"}
                >
                    {isPlaylistPlaying ? (
                        <Pause size={24} fill="#000000" color="#000000" />
                    ) : (
                        <Play
                            size={24}
                            fill="#000000"
                            color="#000000"
                            style={{ marginLeft: 3 }}
                        />
                    )}
                </button>

                <button
                    onClick={() =>
                        onEditPlaylist({
                            id: playlist.id,
                            label: playlist.label,
                        })
                    }
                    className="app-btn-ghost"
                    title="Rename playlist"
                >
                    <Edit2 size={20} />
                </button>

                {playlist.is_deletable && (
                    <button
                        onClick={handleDeletePlaylist}
                        disabled={deleting}
                        className="app-btn-ghost"
                        title="Delete playlist"
                        style={{ color: "#f87171" }}
                    >
                        {deleting ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Trash2 size={20} />
                        )}
                    </button>
                )}
            </div>

            {/* 3. Tracklist Table */}
            <div className="playlist-tracklist-container">
                {/* Table Header */}
                <div className="app-table-header">
                    <div
                        className="songrow-col-index"
                        style={{ textAlign: "center" }}
                    >
                        #
                    </div>
                    <div className="songrow-col-main">Title</div>
                    <div className="songrow-col-date">Date added</div>
                    <div
                        className="songrow-col-duration"
                        style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            paddingRight: 6,
                        }}
                    >
                        <Clock3 size={16} />
                    </div>
                </div>

                {/* Rows */}
                {playlist.songs.length === 0 ? (
                    <div
                        style={{
                            padding: "48px 0",
                            textAlign: "center",
                            color: "var(--app-subtext)",
                            fontSize: 14,
                        }}
                    >
                        Let's find some songs for your playlist. Click '+' on
                        any track in Home or Search to add it here.
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {playlist.songs.map((item, index) => {
                            const meta: SongMetadata = {
                                id: item.song_id,
                                title:
                                    item.title ||
                                    songMetaMap[item.song_id]?.title ||
                                    `Song ID: ${item.song_id.substring(0, 8)}`,
                                artist:
                                    item.artist ||
                                    songMetaMap[item.song_id]?.artist ||
                                    "Music Cloud Track",
                                duration_sec:
                                    item.duration_sec !== undefined &&
                                    item.duration_sec !== null
                                        ? item.duration_sec
                                        : songMetaMap[item.song_id]
                                              ?.duration_sec,
                                cover_art_url:
                                    item.cover_art_url ||
                                    songMetaMap[item.song_id]?.cover_art_url,
                                stream_url:
                                    item.stream_url ||
                                    songMetaMap[item.song_id]?.stream_url,
                            };

                            return (
                                <SongRow
                                    key={item.id}
                                    song={meta}
                                    index={index}
                                    playlistSongId={item.id}
                                    dateAdded={item.created_at}
                                    onRemoveFromPlaylist={handleRemoveSong}
                                    allSongs={playableTracks}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
