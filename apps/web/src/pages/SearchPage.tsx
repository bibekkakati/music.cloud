import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { songService } from "../services/songService";
import type { SongMetadata } from "../types";
import { SongCard } from "../components/SongCard";
import { SongCoverArt } from "../components/SongCoverArt";
import { SongRow } from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import { Play, Pause, Music } from "lucide-react";
import { BROWSE_CATEGORIES } from "@music-cloud/utils";

interface SearchPageProps {
    onAddToPlaylist: (song: SongMetadata) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ onAddToPlaylist }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const paramQ = searchParams.get("q") || "";
    const [query, setQuery] = useState(paramQ);
    const [results, setResults] = useState<SongMetadata[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();

    // Sync state if URL search param changes
    useEffect(() => {
        setQuery(paramQ);
    }, [paramQ]);

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length > 2) {
            const timer = setTimeout(async () => {
                try {
                    setLoading(true);
                    const data = await songService.searchSuggestions(
                        trimmed,
                        20,
                    );
                    setResults(data);
                    setSearched(true);
                } catch {
                    setResults([]);
                    setSearched(true);
                } finally {
                    setLoading(false);
                }
            }, 200);

            return () => clearTimeout(timer);
        } else {
            setResults([]);
            setSearched(false);
        }
    }, [query]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        if (val) {
            setSearchParams({ q: val });
        } else {
            setSearchParams({});
        }
    };

    const topResult = results[0];
    const isTopPlaying = currentSong?.id === topResult?.id && isPlaying;

    return (
        <div className="search-page-container">
            {/* Category Filter Active Header */}
            {query.trim().length > 2 && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 24,
                        padding: "10px 16px",
                        background: "#1e1e1e",
                        borderRadius: 8,
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        maxWidth: 600,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <span
                            style={{
                                color: "var(--app-subtext)",
                                fontSize: 14,
                                fontWeight: 500,
                            }}
                        >
                            Browsing:
                        </span>
                        <span
                            style={{
                                color: "var(--app-accent-green)",
                                fontSize: 16,
                                fontWeight: 700,
                            }}
                        >
                            {query}
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            setQuery("");
                            setSearchParams({});
                        }}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--app-subtext)",
                            cursor: "pointer",
                            fontSize: 13,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 8px",
                            borderRadius: 4,
                            transition: "color 0.2s",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.color = "#ffffff")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "var(--app-subtext)")
                        }
                    >
                        Clear filter ✕
                    </button>
                </div>
            )}

            {/* When no search query or <= 2 characters: Browse All Categories */}
            {query.trim().length <= 2 ? (
                <div>
                    <div className="search-categories-grid">
                        {BROWSE_CATEGORIES.map((cat) => (
                            <div
                                key={cat.name}
                                onClick={() => {
                                    setQuery(cat.name);
                                    setSearchParams({ q: cat.name });
                                }}
                                style={{
                                    height: 180,
                                    borderRadius: 8,
                                    backgroundColor: cat.color,
                                    padding: 16,
                                    position: "relative",
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    transition: "transform 0.15s ease",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.transform =
                                        "scale(1.02)")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.transform =
                                        "scale(1)")
                                }
                            >
                                <span
                                    style={{
                                        fontSize: 20,
                                        fontWeight: 800,
                                        color: "#ffffff",
                                        lineHeight: 1.2,
                                    }}
                                >
                                    {cat.name}
                                </span>

                                <div
                                    style={{
                                        position: "absolute",
                                        right: -10,
                                        bottom: -5,
                                        width: 80,
                                        height: 80,
                                        background: "rgba(0, 0, 0, 0.2)",
                                        borderRadius: 4,
                                        transform: "rotate(25deg)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                                    }}
                                >
                                    <Music size={36} color="#fff" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : searched && results.length === 0 && !loading ? (
                <div
                    style={{
                        padding: "60px 0",
                        textAlign: "center",
                        color: "var(--app-subtext)",
                    }}
                >
                    <h3
                        style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: "#ffffff",
                            marginBottom: 8,
                        }}
                    >
                        No results found for "{query}"
                    </h3>
                    <p style={{ fontSize: 14 }}>
                        Please make sure your words are spelled correctly, or
                        use less or different keywords.
                    </p>
                </div>
            ) : (
                <div>
                    {/* Top Result + Songs Section (Layout) */}
                    {topResult && (
                        <div className="search-top-results-grid">
                            {/* Top Result Box */}
                            <div>
                                <h3
                                    style={{
                                        fontSize: 22,
                                        fontWeight: 800,
                                        color: "#ffffff",
                                        marginBottom: 16,
                                    }}
                                >
                                    Top result
                                </h3>
                                <div
                                    className="app-card"
                                    onClick={() => {
                                        if (currentSong?.id === topResult.id)
                                            togglePlay();
                                        else playSong(topResult, results);
                                    }}
                                    style={{
                                        padding: 24,
                                        height: "calc(100% - 44px)",
                                        position: "relative",
                                    }}
                                >
                                    <SongCoverArt
                                        src={topResult.cover_art_url}
                                        alt={topResult.title}
                                        size={92}
                                        borderRadius={4}
                                        iconSize={44}
                                        style={{
                                            marginBottom: 20,
                                            boxShadow:
                                                "0 8px 24px rgba(0,0,0,0.5)",
                                        }}
                                    />

                                    <div
                                        style={{
                                            fontSize: 28,
                                            fontWeight: 800,
                                            color: "#ffffff",
                                            marginBottom: 8,
                                        }}
                                    >
                                        {topResult.title}
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 14,
                                                color: "var(--app-subtext)",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {topResult.artist}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                padding: "3px 10px",
                                                background: "#242424",
                                                borderRadius:
                                                    "var(--radius-pill)",
                                                textTransform: "uppercase",
                                                color: "#fff",
                                            }}
                                        >
                                            Song
                                        </span>
                                    </div>

                                    {/* Play Button on Top Result */}
                                    <div
                                        className="play-button-overlay"
                                        style={{
                                            position: "absolute",
                                            right: 20,
                                            bottom: 20,
                                        }}
                                    >
                                        <button
                                            className="app-play-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (
                                                    currentSong?.id ===
                                                    topResult.id
                                                )
                                                    togglePlay();
                                                else
                                                    playSong(
                                                        topResult,
                                                        results,
                                                    );
                                            }}
                                        >
                                            {isTopPlaying ? (
                                                <Pause
                                                    size={24}
                                                    fill="#000"
                                                    color="#000"
                                                />
                                            ) : (
                                                <Play
                                                    size={24}
                                                    fill="#000"
                                                    color="#000"
                                                    style={{ marginLeft: 3 }}
                                                />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Top Songs Rows */}
                            <div>
                                <h3
                                    style={{
                                        fontSize: 22,
                                        fontWeight: 800,
                                        color: "#ffffff",
                                        marginBottom: 16,
                                    }}
                                >
                                    Songs
                                </h3>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                    }}
                                >
                                    {results.slice(0, 4).map((song, idx) => (
                                        <SongRow
                                            key={song.id}
                                            song={song}
                                            index={idx}
                                            onAddToPlaylist={onAddToPlaylist}
                                            allSongs={results}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Full Grid of matching tracks */}
                    <div>
                        <h3
                            style={{
                                fontSize: 22,
                                fontWeight: 800,
                                color: "#ffffff",
                                marginBottom: 16,
                            }}
                        >
                            All Matching Tracks
                        </h3>
                        <div className="home-song-grid">
                            {results.map((song) => (
                                <SongCard
                                    key={song.id}
                                    song={song}
                                    allSongs={results}
                                    onAddToPlaylist={onAddToPlaylist}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
