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
    LogOut,
    Music,
    Search as MiniSearch,
    ListFilter,
    X,
    Heart,
    Pin,
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
    const { user, isAuthenticated, logout } = useAuth();
    const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
    const [librarySearch, setLibrarySearch] = useState("");
    const [showSearchInput, setShowSearchInput] = useState(false);

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
                <div
                    className="panel"
                    style={{
                        padding: "16px 20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                    }}
                >
                    {/* Brand / Logo */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "4px 0",
                        }}
                    >
                        <Logo size={32} showText={true} />

                        {/* Mobile Close Button */}
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="app-btn-ghost mobile-only-btn"
                                style={{ color: "var(--app-subtext)" }}
                                title="Close drawer"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {/* Nav Links */}
                    <nav
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        <NavLink
                            to="/"
                            style={({ isActive }) => ({
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                color: isActive
                                    ? "#ffffff"
                                    : "var(--app-subtext)",
                                fontWeight: 700,
                                fontSize: 14,
                                textDecoration: "none",
                                padding: "6px 0",
                                transition: "color 0.2s ease",
                            })}
                        >
                            {({ isActive }) => (
                                <>
                                    <Home
                                        size={24}
                                        strokeWidth={isActive ? 2.8 : 2}
                                    />
                                    <span>Home</span>
                                </>
                            )}
                        </NavLink>

                        <NavLink
                            to="/search"
                            style={({ isActive }) => ({
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                color: isActive
                                    ? "#ffffff"
                                    : "var(--app-subtext)",
                                fontWeight: 700,
                                fontSize: 14,
                                textDecoration: "none",
                                padding: "6px 0",
                                transition: "color 0.2s ease",
                            })}
                        >
                            {({ isActive }) => (
                                <>
                                    <Search
                                        size={24}
                                        strokeWidth={isActive ? 2.8 : 2}
                                    />
                                    <span>Search</span>
                                </>
                            )}
                        </NavLink>
                    </nav>
                </div>

                {/* Bottom Island: Your Library */}
                <div
                    className="panel"
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 0,
                    }}
                >
                    {/* Library Header */}
                    <div
                        style={{
                            padding: "14px 16px 8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                color: "var(--app-subtext)",
                                fontWeight: 700,
                                fontSize: 14,
                                cursor: "pointer",
                                transition: "color 0.2s",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.color = "#fff")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.color =
                                    "var(--app-subtext)")
                            }
                        >
                            <Library size={22} />
                            <span>Your Library</span>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                            }}
                        >
                            {isAuthenticated && (
                                <button
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
                        <div
                            style={{
                                padding: "0 16px 8px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            {showSearchInput ? (
                                <div
                                    style={{
                                        position: "relative",
                                        width: "100%",
                                    }}
                                >
                                    <input
                                        type="text"
                                        placeholder="Search in Your Library"
                                        value={librarySearch}
                                        onChange={(e) =>
                                            setLibrarySearch(e.target.value)
                                        }
                                        autoFocus
                                        onBlur={() =>
                                            !librarySearch &&
                                            setShowSearchInput(false)
                                        }
                                        style={{
                                            width: "100%",
                                            background: "#242424",
                                            border: "none",
                                            borderRadius: 4,
                                            padding: "6px 28px 6px 10px",
                                            color: "#fff",
                                            fontSize: 12,
                                            outline: "none",
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            setLibrarySearch("");
                                            setShowSearchInput(false);
                                        }}
                                        style={{
                                            position: "absolute",
                                            right: 6,
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            background: "none",
                                            border: "none",
                                            color: "var(--app-subtext)",
                                            cursor: "pointer",
                                            fontSize: 12,
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setShowSearchInput(true)}
                                        className="app-btn-ghost"
                                        style={{ padding: 4 }}
                                        title="Search in Your Library"
                                    >
                                        <MiniSearch size={16} />
                                    </button>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 4,
                                            fontSize: 12,
                                            color: "var(--app-subtext)",
                                        }}
                                    >
                                        <span>Recents</span>
                                        <ListFilter size={14} />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Playlists List Items */}
                    <div
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            padding: "0 8px 8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                        }}
                    >
                        {!isAuthenticated ? (
                            <div
                                style={{
                                    margin: "12px 8px",
                                    padding: "20px 16px",
                                    borderRadius: "var(--radius-md)",
                                    background: "var(--app-card)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 12,
                                }}
                            >
                                <div style={{ fontWeight: 700, fontSize: 14 }}>
                                    Create your first playlist
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--app-subtext)",
                                        lineHeight: 1.4,
                                    }}
                                >
                                    It's easy, we'll help you organize your
                                    music and stream high-fidelity audio.
                                </div>
                                <button
                                    onClick={onOpenAuthModal}
                                    className="app-btn-pill"
                                    style={{
                                        alignSelf: "flex-start",
                                        padding: "8px 18px",
                                        fontSize: 13,
                                    }}
                                >
                                    Log In
                                </button>
                            </div>
                        ) : filteredPlaylists.length === 0 ? (
                            <div
                                style={{
                                    padding: "24px 12px",
                                    textAlign: "center",
                                    color: "var(--app-subtext)",
                                    fontSize: 12,
                                }}
                            >
                                {librarySearch
                                    ? "No matching playlists found."
                                    : 'No playlists yet. Click "+" to create one.'}
                            </div>
                        ) : (
                            filteredPlaylists.map((pl) => (
                                <NavLink
                                    key={pl.id}
                                    to={`/playlist/${pl.id}`}
                                    style={({ isActive }) => ({
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        padding: "8px 8px",
                                        borderRadius: 6,
                                        textDecoration: "none",
                                        background: isActive
                                            ? "#282828"
                                            : "transparent",
                                        transition: "background-color 0.15s",
                                    })}
                                    onMouseEnter={(e) => {
                                        if (
                                            !e.currentTarget.classList.contains(
                                                "active",
                                            )
                                        ) {
                                            e.currentTarget.style.backgroundColor =
                                                "#1a1a1a";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (
                                            !e.currentTarget.classList.contains(
                                                "active",
                                            )
                                        ) {
                                            e.currentTarget.style.backgroundColor =
                                                "transparent";
                                        }
                                    }}
                                >
                                    {/* Playlist Icon / Thumbnail */}
                                    {isLikedPlaylist(pl.label, pl.is_deletable) ? (
                                        <div
                                            style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 4,
                                                background:
                                                    "linear-gradient(135deg, #450af5, #8e8ee5)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Heart
                                                size={22}
                                                fill="#ffffff"
                                                color="#ffffff"
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 4,
                                                background: "#282828",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "var(--app-subtext)",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Music size={22} />
                                        </div>
                                    )}

                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                                color: "#ffffff",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                            }}
                                        >
                                            <span>{pl.label}</span>
                                            {isLikedPlaylist(
                                                pl.label,
                                                pl.is_deletable,
                                            ) && (
                                                <Pin
                                                    size={13}
                                                    fill="#1ed760"
                                                    color="#1ed760"
                                                    style={{
                                                        transform:
                                                            "rotate(45deg)",
                                                        flexShrink: 0,
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "var(--app-subtext)",
                                                marginTop: 2,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
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

                    {/* User Status Bar at bottom of sidebar */}
                    {isAuthenticated && user && (
                        <div
                            style={{
                                padding: "12px 16px",
                                borderTop:
                                    "1px solid rgba(255, 255, 255, 0.08)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    minWidth: 0,
                                }}
                            >
                                <div
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: "50%",
                                        background: "var(--app-green)",
                                        color: "#000",
                                        fontWeight: 800,
                                        fontSize: 12,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    {user.email.charAt(0).toUpperCase()}
                                </div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {user.email.split("@")[0]}
                                </div>
                            </div>

                            <button
                                onClick={logout}
                                className="app-btn-ghost"
                                title="Log out"
                                style={{ color: "var(--app-subtext)" }}
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
};
