import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { songService } from "../services/songService";
import type { SongMetadata } from "../types";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import {
    Search,
    Loader2,
    Play,
    ChevronLeft,
    ChevronRight,
    Settings,
    LogOut,
    Shield,
} from "lucide-react";
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
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const profileDropdownRef = useRef<HTMLDivElement>(null);

    const navigate = useNavigate();
    const location = useLocation();
    const { playSong } = usePlayer();
    const { user, isAuthenticated, logout } = useAuth();

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

    // Close profile dropdown on navigation
    useEffect(() => {
        setIsProfileOpen(false);
    }, [location.pathname]);

    // Click outside to close dropdowns
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
            if (
                profileDropdownRef.current &&
                !profileDropdownRef.current.contains(e.target as Node)
            ) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = async () => {
        setIsProfileOpen(false);
        if (window.confirm("Are you sure you want to log out of MusicCloud?")) {
            await logout();
        }
    };

    const handleSelectSong = (song: SongMetadata) => {
        playSong(song);
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
                        type="button"
                        onClick={onToggleSidebar}
                        className="app-btn-ghost mobile-only-btn navbar-mobile-brand-btn"
                        title="Open Library"
                    >
                        <Logo size={32} />
                    </button>
                )}

                {/* Navigation History Arrows (Hidden on mobile) */}
                <div className="navbar-history-arrows">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="navbar-history-btn"
                        title="Go back"
                    >
                        <ChevronLeft size={22} />
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate(1)}
                        className="navbar-history-btn"
                        title="Go forward"
                    >
                        <ChevronRight size={22} />
                    </button>
                </div>
            </div>

            {/* 2. Center: Search Box */}
            <div className="navbar-center">
                <div ref={dropdownRef} className="navbar-search-box">
                    <div className="navbar-search-wrapper">
                        <Search
                            size={18}
                            className={`navbar-search-icon ${isSearchPage ? "active" : ""}`}
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
                            className="navbar-search-input"
                        />
                        {isSearching && (
                            <Loader2
                                size={16}
                                className="animate-spin navbar-search-spinner"
                            />
                        )}
                    </div>

                    {/* Suggestions Dropdown */}
                    {isOpen && (
                        <div className="navbar-suggestions-dropdown animate-fade-in">
                            {suggestions.length === 0 ? (
                                <div className="navbar-suggestion-empty">
                                    No matching tracks found.
                                </div>
                            ) : (
                                suggestions.map((song) => (
                                    <div
                                        key={song.id}
                                        onClick={() => handleSelectSong(song)}
                                        className="navbar-suggestion-item"
                                    >
                                        <SongCoverArt
                                            src={song.cover_art_url}
                                            alt={song.title}
                                            size={36}
                                            borderRadius={4}
                                            iconSize={16}
                                        />
                                        <div className="navbar-suggestion-info">
                                            <div className="navbar-suggestion-title">
                                                {song.title}
                                            </div>
                                            <div className="navbar-suggestion-artist">
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
            <div className="navbar-right" ref={profileDropdownRef}>
                {isAuthenticated && user ? (
                    <>
                        <button
                            type="button"
                            onClick={() => setIsProfileOpen((prev) => !prev)}
                            className={`navbar-profile-btn ${isProfileOpen ? "active" : ""}`}
                            title={user.email}
                        >
                            <span className="navbar-profile-initial">
                                {user.email.charAt(0).toUpperCase()}
                            </span>
                        </button>

                        {/* Profile Dropdown Menu */}
                        {isProfileOpen && (
                            <div className="navbar-profile-dropdown animate-fade-in">
                                <div className="navbar-dropdown-header">
                                    <div className="navbar-dropdown-email">
                                        {user.email}
                                    </div>
                                    <div
                                        className={`navbar-dropdown-role ${user.is_admin ? "admin" : ""}`}
                                    >
                                        {user.is_admin
                                            ? "Administrator"
                                            : "Member"}
                                    </div>
                                </div>

                                {user.is_admin && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsProfileOpen(false);
                                            navigate("/admin/catalog");
                                        }}
                                        className="navbar-dropdown-item"
                                    >
                                        <Shield size={16} />
                                        <span>Admin Console</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsProfileOpen(false);
                                        navigate("/settings");
                                    }}
                                    className="navbar-dropdown-item"
                                >
                                    <Settings size={16} />
                                    <span>Settings</span>
                                </button>

                                <div className="navbar-dropdown-divider" />

                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="navbar-dropdown-item danger"
                                >
                                    <LogOut size={16} />
                                    <span>Log out</span>
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={onOpenAuthModal}
                        className="app-btn-pill"
                    >
                        Log in
                    </button>
                )}
            </div>
        </header>
    );
};
