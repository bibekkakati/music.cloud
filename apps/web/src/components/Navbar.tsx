import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { songService } from "../services/songService";
import type { SongMetadata } from "../types";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { Search, Loader2, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { SongCoverArt } from "./SongCoverArt";
import { Logo } from "./Logo";

interface NavbarProps {
    onOpenAuthModal: () => void;
    onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
    onOpenAuthModal,
    onToggleSidebar,
}) => {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<SongMetadata[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const navigate = useNavigate();
    const location = useLocation();
    const { playSong } = usePlayer();
    const { user, isAuthenticated } = useAuth();

    const isSearchPage = location.pathname.startsWith("/search");

    // Sync navbar input with URL param when on /search page
    useEffect(() => {
        if (isSearchPage) {
            const q = new URLSearchParams(location.search).get("q") || "";
            setQuery(q);
            setIsOpen(false);
        }
    }, [location.search, isSearchPage]);

    // Autocomplete suggestions dropdown on non-search pages
    useEffect(() => {
        if (isSearchPage || query.trim().length <= 2) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setIsSearching(true);
                const results = await songService.searchSuggestions(query, 8);
                setSuggestions(results);
                setIsOpen(true);
            } catch {
                setSuggestions([]);
            } finally {
                setIsSearching(false);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [query, isSearchPage]);

    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelectSong = (song: SongMetadata) => {
        playSong(song, suggestions);
        setIsOpen(false);
        setQuery("");
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        if (isSearchPage) {
            if (val.trim()) {
                navigate(`/search?q=${encodeURIComponent(val)}`, {
                    replace: true,
                });
            } else {
                navigate("/search", { replace: true });
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            setIsOpen(false);
            if (query.trim()) {
                navigate(`/search?q=${encodeURIComponent(query.trim())}`);
            } else {
                navigate("/search");
            }
        }
    };

    return (
        <header className="app-navbar">
            {/* 1. Left: Navigation History (Desktop) or Brand Logo (Mobile) */}
            <div className="navbar-left">
                {/* Mobile Brand / Library Toggle Button */}
                {onToggleSidebar && (
                    <button
                        onClick={onToggleSidebar}
                        className="app-btn-ghost mobile-only-btn"
                        title="Open Library"
                        style={{
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Logo size={32} />
                    </button>
                )}

                {/* Navigation History Arrows (Hidden on mobile) */}
                <div className="navbar-history-arrows">
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "rgba(0, 0, 0, 0.7)",
                            border: "none",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "background-color 0.15s",
                        }}
                        title="Go back"
                    >
                        <ChevronLeft size={22} />
                    </button>

                    <button
                        onClick={() => navigate(1)}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "rgba(0, 0, 0, 0.7)",
                            border: "none",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "background-color 0.15s",
                        }}
                        title="Go forward"
                    >
                        <ChevronRight size={22} />
                    </button>
                </div>
            </div>

            {/* 2. Center: Search Box */}
            <div className="navbar-center">
                <div
                    ref={dropdownRef}
                    className="navbar-search-box"
                    style={{ position: "relative", width: "100%" }}
                >
                    <div style={{ position: "relative" }}>
                        <Search
                            size={18}
                            style={{
                                position: "absolute",
                                left: 14,
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: isSearchPage
                                    ? "#ffffff"
                                    : "var(--app-subtext)",
                            }}
                        />
                        <input
                            type="text"
                            placeholder="What do you want to play?"
                            value={query}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            onFocus={() =>
                                suggestions.length > 0 && setIsOpen(true)
                            }
                            style={{
                                width: "100%",
                                height: 44,
                                padding: "0 40px 0 44px",
                                borderRadius: "var(--radius-pill)",
                                background: "#242424",
                                border: "1px solid transparent",
                                color: "#ffffff",
                                fontSize: 13,
                                fontWeight: 500,
                                outline: "none",
                                transition:
                                    "border-color 0.2s, background-color 0.2s",
                            }}
                            onFocusCapture={(e) => {
                                e.currentTarget.style.borderColor = "#ffffff";
                                e.currentTarget.style.backgroundColor =
                                    "#2a2a2a";
                            }}
                            onBlurCapture={(e) => {
                                e.currentTarget.style.borderColor =
                                    "transparent";
                                e.currentTarget.style.backgroundColor =
                                    "#242424";
                            }}
                        />
                        {isSearching && (
                            <Loader2
                                size={16}
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

                    {/* Suggestions Dropdown */}
                    {isOpen && (
                        <div
                            className="animate-fade-in"
                            style={{
                                position: "absolute",
                                top: "115%",
                                left: 0,
                                right: 0,
                                borderRadius: "var(--radius-md)",
                                padding: "6px 0",
                                boxShadow: "0 16px 32px rgba(0, 0, 0, 0.7)",
                                maxHeight: 320,
                                overflowY: "auto",
                                background: "#282828",
                                zIndex: 100,
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                            }}
                        >
                            {suggestions.length === 0 ? (
                                <div
                                    style={{
                                        padding: "12px 16px",
                                        color: "var(--app-subtext)",
                                        fontSize: 13,
                                    }}
                                >
                                    No matching tracks found.
                                </div>
                            ) : (
                                suggestions.map((song) => (
                                    <div
                                        key={song.id}
                                        onClick={() => handleSelectSong(song)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                            padding: "8px 16px",
                                            cursor: "pointer",
                                            transition:
                                                "background-color 0.15s",
                                        }}
                                        onMouseEnter={(e) =>
                                            (e.currentTarget.style.backgroundColor =
                                                "rgba(255, 255, 255, 0.1)")
                                        }
                                        onMouseLeave={(e) =>
                                            (e.currentTarget.style.backgroundColor =
                                                "transparent")
                                        }
                                    >
                                        <SongCoverArt
                                            src={song.cover_art_url}
                                            alt={song.title}
                                            size={36}
                                            borderRadius={4}
                                            iconSize={16}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    color: "#ffffff",
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
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                            >
                                                {song.artist}
                                            </div>
                                        </div>
                                        <Play
                                            size={16}
                                            fill="var(--app-green)"
                                            color="var(--app-green)"
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Right: Auth Profile / Log In */}
            <div className="navbar-right">
                {isAuthenticated && user ? (
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: "#242424",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            border: "2px solid rgba(255, 255, 255, 0.15)",
                            transition: "transform 0.15s, border-color 0.15s",
                        }}
                        title={user.email}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.borderColor = "#ffffff")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.borderColor =
                                "rgba(255, 255, 255, 0.15)")
                        }
                    >
                        <span
                            style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#ffffff",
                            }}
                        >
                            {user.email.charAt(0).toUpperCase()}
                        </span>
                    </div>
                ) : (
                    <button onClick={onOpenAuthModal} className="app-btn-pill">
                        Log in
                    </button>
                )}
            </div>
        </header>
    );
};
