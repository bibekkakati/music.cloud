import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { playlistService } from "../services/playlistService";
import type { PlaylistSummary } from "../types";
import {
    Home,
    Search,
    Plus,
    Library,
    Music,
    X,
    Heart,
    Pin,
    Settings,
} from "lucide-react";
import { isLikedPlaylist } from "@music-cloud/utils";
import { Logo } from "./Logo";

interface SidebarProps {
    onOpenAuthModal: () => void;
    onOpenCreatePlaylistModal: () => void;
    playlistRefreshTrigger?: number;
    isOpen?: boolean;
    onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    onOpenAuthModal,
    onOpenCreatePlaylistModal,
    playlistRefreshTrigger,
    isOpen = false,
    onClose,
}) => {
    const { user, isAuthenticated } = useAuth();
    const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
    const [librarySearch, setLibrarySearch] = useState("");

    useEffect(() => {
        if (isAuthenticated) {
            playlistService
                .getAllPlaylists()
                .then(setPlaylists)
                .catch(() => {});
        } else {
            setPlaylists([]);
        }
    }, [isAuthenticated, playlistRefreshTrigger]);

    const filteredPlaylists = playlists.filter((pl) =>
        pl.label.toLowerCase().includes(librarySearch.toLowerCase()),
    );

    return (
        <>
            {/* Mobile Drawer Backdrop */}
            {isOpen && (
                <div className="mobile-drawer-backdrop" onClick={onClose} />
            )}

            <aside className={`app-sidebar ${isOpen ? "mobile-open" : ""}`}>
                {/* Top Island: Brand & Core Navigation */}
                <div className="panel sidebar-top-panel">
                    {/* Brand / Logo */}
                    <div className="sidebar-brand-row">
                        <Logo size={32} showText={true} />

                        {/* Mobile Close Button */}
                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="app-btn-ghost mobile-only-btn sidebar-brand-mobile-close"
                                title="Close drawer"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {/* Nav Links */}
                    <nav className="sidebar-nav-group">
                        <NavLink
                            to="/"
                            className={({ isActive }) =>
                                `sidebar-nav-link ${isActive ? "active" : ""}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Home
                                        size={22}
                                        strokeWidth={isActive ? 2.5 : 2}
                                    />
                                    <span>Home</span>
                                </>
                            )}
                        </NavLink>

                        <NavLink
                            to="/search"
                            onClick={() => onClose && onClose()}
                            className={({ isActive }) =>
                                `sidebar-nav-link ${isActive ? "active" : ""}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Search
                                        size={22}
                                        strokeWidth={isActive ? 2.5 : 2}
                                    />
                                    <span>Search</span>
                                </>
                            )}
                        </NavLink>
                    </nav>
                </div>

                {/* Bottom Island: Your Library */}
                <div className="panel sidebar-library-panel">
                    {/* Library Header */}
                    <div className="sidebar-library-header">
                        <button
                            type="button"
                            className="sidebar-library-title-btn"
                        >
                            <Library size={22} />
                            <span>Your Library</span>
                        </button>

                        <div className="sidebar-library-actions">
                            {isAuthenticated && (
                                <button
                                    type="button"
                                    onClick={onOpenCreatePlaylistModal}
                                    className="app-btn-ghost"
                                    title="Create playlist or folder"
                                >
                                    <Plus size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Search bar inside library */}
                    {isAuthenticated && playlists.length > 0 && (
                        <div className="sidebar-search-container">
                            <div className="sidebar-search-box">
                                <input
                                    type="text"
                                    placeholder="Search playlists..."
                                    value={librarySearch}
                                    onChange={(e) =>
                                        setLibrarySearch(e.target.value)
                                    }
                                    className="sidebar-search-input"
                                />
                            </div>
                        </div>
                    )}

                    {/* Playlists List Items */}
                    <div className="sidebar-library-list">
                        {!isAuthenticated ? (
                            <div className="sidebar-empty-box">
                                <div className="sidebar-empty-title">
                                    Create your first playlist
                                </div>
                                <div className="sidebar-empty-desc">
                                    It's easy, we'll help you organize your
                                    music and stream high-fidelity audio.
                                </div>
                                <button
                                    type="button"
                                    onClick={onOpenAuthModal}
                                    className="app-btn-pill sidebar-empty-login-btn"
                                >
                                    Log In
                                </button>
                            </div>
                        ) : filteredPlaylists.length === 0 ? (
                            <div className="sidebar-empty-text">
                                {librarySearch
                                    ? "No matching playlists found."
                                    : 'No playlists yet. Click "+" to create one.'}
                            </div>
                        ) : (
                            filteredPlaylists.map((pl) => (
                                <NavLink
                                    key={pl.id}
                                    to={`/playlist/${pl.id}`}
                                    className={({ isActive }) =>
                                        `sidebar-playlist-item ${isActive ? "active" : ""}`
                                    }
                                >
                                    {/* Playlist Icon / Thumbnail */}
                                    {isLikedPlaylist(
                                        pl.label,
                                        pl.is_deletable,
                                    ) ? (
                                        <div className="sidebar-playlist-cover liked">
                                            <Heart
                                                size={20}
                                                fill="#ffffff"
                                                color="#ffffff"
                                            />
                                        </div>
                                    ) : (
                                        <div className="sidebar-playlist-cover custom">
                                            <Music size={20} />
                                        </div>
                                    )}

                                    <div className="sidebar-playlist-info">
                                        <div className="sidebar-playlist-name-row">
                                            <span>{pl.label}</span>
                                            {isLikedPlaylist(
                                                pl.label,
                                                pl.is_deletable,
                                            ) && (
                                                <Pin
                                                    size={13}
                                                    fill="#1ed760"
                                                    color="#1ed760"
                                                    className="sidebar-pin-icon"
                                                />
                                            )}
                                        </div>
                                        <div className="sidebar-playlist-sub">
                                            Playlist • {pl.songs_count ?? 0}{" "}
                                            {pl.songs_count === 1
                                                ? "song"
                                                : "songs"}
                                        </div>
                                    </div>
                                </NavLink>
                            ))
                        )}
                    </div>

                    {/* User Status & Settings Bar at bottom of sidebar */}
                    <div className="sidebar-footer-panel">
                        {isAuthenticated && user ? (
                            <NavLink
                                to="/settings"
                                onClick={() => onClose && onClose()}
                                className="sidebar-footer-user"
                            >
                                <div className="sidebar-footer-avatar">
                                    {user.email.charAt(0).toUpperCase()}
                                </div>
                                <div className="sidebar-footer-name">
                                    {user.email.split("@")[0]}
                                </div>
                            </NavLink>
                        ) : (
                            <div className="sidebar-guest-indicator">
                                Guest Mode
                            </div>
                        )}

                        <NavLink
                            to="/settings"
                            onClick={() => onClose && onClose()}
                            className="app-btn-ghost sidebar-settings-btn"
                            title="Settings"
                        >
                            <Settings size={18} />
                        </NavLink>
                    </div>
                </div>
            </aside>
        </>
    );
};
