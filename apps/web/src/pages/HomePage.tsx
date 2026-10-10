import React, { useState, useEffect } from "react";
import { songService } from "../services/songService";
import { authService } from "../services/authService";
import type { SongMetadata } from "../types";
import { SongCard } from "../components/SongCard";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Music, Loader2, Sparkles, LogIn, Radio } from "lucide-react";

interface HomePageProps {
    onAddToPlaylist: (song: SongMetadata) => void;
    onOpenAuthModal?: () => void;
}

import { getGreeting } from "@music-cloud/utils";

export const HomePage: React.FC<HomePageProps> = ({
    onAddToPlaylist,
    onOpenAuthModal,
}) => {
    const [songs, setSongs] = useState<SongMetadata[]>([]);
    const [loading, setLoading] = useState(false);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState(false);

    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const { showToast } = useToast();

    const fetchSongs = async (cursorVal?: string, append = false) => {
        // Only attempt to fetch if there is an active session token
        if (!authService.getToken()) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await songService.getAllSongs(cursorVal);
            const songList = data?.songs || [];
            if (append) {
                setSongs((prev) => {
                    const existingIds = new Set(prev.map((s) => s.id));
                    const uniqueNew = songList.filter((s) => !existingIds.has(s.id));
                    return [...prev, ...uniqueNew];
                });
            } else {
                setSongs(songList);
            }
            const nextCursor = data?.cursor;
            const hasValidCursor =
                typeof nextCursor === "string" && nextCursor.trim() !== "";

            setHasMore(hasValidCursor);
            setCursor(hasValidCursor ? nextCursor.trim() : undefined);
        } catch (err: unknown) {
            const statusCode = (err as { response?: { status?: number } })
                ?.response?.status;
            // Empty library or client/auth states are normal. Only alert on genuine server errors (5xx)
            if (statusCode && statusCode >= 500) {
                const errorMsg =
                    (err as { response?: { data?: { detail?: string } } })
                        ?.response?.data?.detail ||
                    "Server error loading library songs.";
                showToast("Server Error", "error", errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchSongs();
        } else if (!isAuthLoading) {
            setSongs([]);
            setLoading(false);
            setCursor(undefined);
            setHasMore(false);
        }
    }, [isAuthenticated, isAuthLoading]);

    return (
        <div className="home-page-container">
            {/* 1. If unauthenticated, show welcoming landing banner */}
            {!isAuthenticated && !isAuthLoading ? (
                <div style={{ padding: "24px 0" }}>
                    {/* Hero Welcome Card */}
                    <div
                        className="animate-fade-in"
                        style={{
                            borderRadius: 8,
                            padding: "48px 40px",
                            background:
                                "linear-gradient(135deg, #1e3a8a 0%, #1e1e1e 100%)",
                            marginBottom: 40,
                            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.6)",
                            position: "relative",
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                maxWidth: 580,
                                position: "relative",
                                zIndex: 1,
                            }}
                        >
                            <div
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "4px 12px",
                                    borderRadius: "var(--radius-pill)",
                                    background: "rgba(255, 255, 255, 0.12)",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "#ffffff",
                                    marginBottom: 16,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                }}
                            >
                                <Radio size={14} color="var(--app-green)" />
                                <span>Private Audio Cloud</span>
                            </div>

                            <h1
                                style={{
                                    fontSize: "clamp(32px, 4.5vw, 48px)",
                                    fontWeight: 900,
                                    lineHeight: 1.15,
                                    letterSpacing: "-0.03em",
                                    marginBottom: 16,
                                    color: "#ffffff",
                                }}
                            >
                                Listen to your private library without limits.
                            </h1>

                            <p
                                style={{
                                    fontSize: 16,
                                    color: "#e2e8f0",
                                    lineHeight: 1.5,
                                    marginBottom: 28,
                                    maxWidth: 480,
                                }}
                            >
                                Stream pristine HLS audio segments straight from
                                edge workers. Sign in to browse all songs, build
                                custom playlists, and manage your library.
                            </p>

                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 14,
                                }}
                            >
                                <button
                                    onClick={onOpenAuthModal}
                                    className="app-btn-green"
                                    style={{
                                        padding: "14px 32px",
                                        fontSize: 15,
                                    }}
                                >
                                    <LogIn size={18} />
                                    <span>Log in to Start Listening</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Features Shelf */}
                    <div style={{ marginBottom: 32 }}>
                        <h2
                            style={{
                                fontSize: 22,
                                fontWeight: 800,
                                color: "#ffffff",
                                marginBottom: 16,
                            }}
                        >
                            Features
                        </h2>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fit, minmax(240px, 1fr))",
                                gap: 16,
                            }}
                        >
                            <div
                                className="app-card"
                                style={{ padding: 24, cursor: "default" }}
                            >
                                <Sparkles
                                    size={28}
                                    color="var(--app-green)"
                                    style={{ marginBottom: 12 }}
                                />
                                <h3
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        color: "#ffffff",
                                        marginBottom: 6,
                                    }}
                                >
                                    High-Fidelity HLS
                                </h3>
                                <p
                                    style={{
                                        fontSize: 13,
                                        color: "var(--app-subtext)",
                                        lineHeight: 1.4,
                                    }}
                                >
                                    Multi-bitrate AAC and MP3 audio stream
                                    segments cached at edge workers.
                                </p>
                            </div>

                            <div
                                className="app-card"
                                style={{ padding: 24, cursor: "default" }}
                            >
                                <Music
                                    size={28}
                                    color="var(--app-green)"
                                    style={{ marginBottom: 12 }}
                                />
                                <h3
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        color: "#ffffff",
                                        marginBottom: 6,
                                    }}
                                >
                                    Custom Playlists
                                </h3>
                                <p
                                    style={{
                                        fontSize: 13,
                                        color: "var(--app-subtext)",
                                        lineHeight: 1.4,
                                    }}
                                >
                                    Curate personal track collections with
                                    seamless organization.
                                </p>
                            </div>

                            <div
                                className="app-card"
                                style={{ padding: 24, cursor: "default" }}
                            >
                                <Radio
                                    size={28}
                                    color="var(--app-green)"
                                    style={{ marginBottom: 12 }}
                                />
                                <h3
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        color: "#ffffff",
                                        marginBottom: 6,
                                    }}
                                >
                                    Private & Secure
                                </h3>
                                <p
                                    style={{
                                        fontSize: 13,
                                        color: "var(--app-subtext)",
                                        lineHeight: 1.4,
                                    }}
                                >
                                    Edge-validated short-lived stream JWT tokens
                                    preventing unauthorized hotlinking.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* 2. Authenticated Home View */
                <>
                    {/* Top Dynamic Gradient Background Header */}
                    <div style={{ marginBottom: 32 }}>
                        <h1
                            style={{
                                fontSize: 32,
                                fontWeight: 800,
                                letterSpacing: "-0.03em",
                                marginBottom: 20,
                                color: "#ffffff",
                            }}
                        >
                            {getGreeting()}
                        </h1>
                    </div>

                    {/* Shelves Section: Featured Tracks */}
                    <section style={{ marginBottom: 40 }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                                justifyContent: "space-between",
                                marginBottom: 16,
                            }}
                        >
                            <div>
                                <h2
                                    style={{
                                        fontSize: 24,
                                        fontWeight: 800,
                                        letterSpacing: "-0.02em",
                                        color: "#ffffff",
                                    }}
                                >
                                    Made For You
                                </h2>
                                <p
                                    style={{
                                        fontSize: 13,
                                        color: "var(--app-subtext)",
                                        marginTop: 4,
                                    }}
                                >
                                    Stream your private high-fidelity cloud
                                    audio catalog
                                </p>
                            </div>
                            <span></span>
                        </div>

                        {loading && songs.length === 0 ? (
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    padding: "60px 0",
                                }}
                            >
                                <Loader2
                                    size={36}
                                    className="animate-spin"
                                    color="var(--app-green)"
                                />
                            </div>
                        ) : songs.length === 0 ? (
                            <div
                                style={{
                                    padding: "48px 24px",
                                    textAlign: "center",
                                    background: "var(--app-card)",
                                    borderRadius: 8,
                                    color: "var(--app-subtext)",
                                }}
                            >
                                <p
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        color: "#fff",
                                        marginBottom: 6,
                                    }}
                                >
                                    No tracks uploaded yet
                                </p>
                                <p style={{ fontSize: 13 }}>
                                    Songs added to the private cloud will appear
                                    here for streaming.
                                </p>
                            </div>
                        ) : (
                            <div className="home-song-grid">
                                {songs.map((song) => (
                                    <SongCard
                                        key={song.id}
                                        song={song}
                                        allSongs={songs}
                                        onAddToPlaylist={onAddToPlaylist}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Pagination button if has more */}
                    {hasMore && (
                        <div style={{ textAlign: "center", marginTop: 24 }}>
                            <button
                                onClick={() => {
                                    if (cursor) {
                                        fetchSongs(cursor, true);
                                    }
                                }}
                                disabled={loading}
                                className="app-btn-pill"
                            >
                                {loading ? (
                                    <Loader2
                                        size={16}
                                        className="animate-spin"
                                    />
                                ) : (
                                    "Load More"
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
