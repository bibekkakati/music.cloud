import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { songService } from "../services/songService";
import type { SongMetadata } from "../types";
import { SongCard } from "../components/SongCard";
import { SongCoverArt } from "../components/SongCoverArt";
import { SongRow } from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import {
    Search as SearchIcon,
    Loader2,
    Play,
    Pause,
    Music,
} from "lucide-react";

interface SearchPageProps {
    onAddToPlaylist: (song: SongMetadata) => void;
}

const BROWSE_CATEGORIES = [
    { name: "Podcasts", color: "#006450" },
    { name: "Made For You", color: "#1e3264" },
    { name: "Charts", color: "#8d67ab" },
    { name: "New Releases", color: "#e8115b" },
    { name: "Discover", color: "#8c1932" },
    { name: "Concerts", color: "#7358ff" },
    { name: "Chill", color: "#d84000" },
    { name: "Focus", color: "#503750" },
    { name: "Mood", color: "#e1118c" },
    { name: "Workout", color: "#777777" },
    { name: "Rock", color: "#e91429" },
    { name: "Electronic", color: "#0d73ec" },
];

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
            {/* Mobile / Inline search input if topbar input isn't active */}
            <div style={{ maxWidth: 420, marginBottom: 28 }}>
                <div style={{ position: "relative" }}>
                    <SearchIcon
                        size={18}
                        style={{
                            position: "absolute",
                            left: 14,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "var(--app-subtext)",
                        }}
                    />
                    <input
                        type="text"
                        placeholder="What do you want to listen to?"
                        value={query}
                        onChange={handleInputChange}
                        style={{
                            width: "100%",
                            height: 48,
                            padding: "0 40px 0 44px",
                            borderRadius: "var(--radius-pill)",
                            background: "#242424",
                            border: "1px solid transparent",
                            color: "#ffffff",
                            fontSize: 14,
                            fontWeight: 500,
                            outline: "none",
                            transition: "border-color 0.2s",
                        }}
                        onFocus={(e) =>
                            (e.currentTarget.style.borderColor = "#ffffff")
                        }
                        onBlur={(e) =>
                            (e.currentTarget.style.borderColor = "transparent")
                        }
                    />
                    {loading && (
                        <Loader2
                            size={18}
                            className="animate-spin"
                            style={{
                                position: "absolute",
                                right: 14,
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: "var(--app-subtext)",
                            }}
                        />
                    )}
                </div>
            </div>

            {/* When no search query or <= 2 characters: Browse All Categories */}
            {query.trim().length <= 2 ? (
                <div>
                    <h2
                        style={{
                            fontSize: 24,
                            fontWeight: 800,
                            marginBottom: 16,
                            color: "#ffffff",
                        }}
                    >
                        Browse all
                    </h2>
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
