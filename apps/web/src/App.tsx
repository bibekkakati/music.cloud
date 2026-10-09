import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import { PlayerProvider } from "./context/PlayerContext";
import { ToastContainer } from "./components/ToastContainer";
import { Sidebar } from "./components/Sidebar";
import { Navbar } from "./components/Navbar";
import { Player } from "./components/Player";
import { BottomNav } from "./components/BottomNav";
import { AuthModal } from "./components/AuthModal";
import { PlaylistModal } from "./components/PlaylistModal";

import { HomePage } from "./pages/HomePage";
import { SearchPage } from "./pages/SearchPage";
import { SongCollectionView } from "./pages/SongCollectionView";
import { AdminPage } from "./pages/admin/AdminPage";
import { SongRoutePage } from "./pages/SongRoutePage";
import type { SongMetadata, PlaylistSummary } from "./types";

const AppContent: React.FC = () => {
    const location = useLocation();

    // Modal states
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
    const [playlistModalMode, setPlaylistModalMode] = useState<
        "create" | "add_song" | "edit"
    >("create");
    const [songToAdd, setSongToAdd] = useState<SongMetadata | null>(null);
    const [playlistToEdit, setPlaylistToEdit] =
        useState<PlaylistSummary | null>(null);
    const [playlistRefreshTrigger, setPlaylistRefreshTrigger] = useState(0);

    // Mobile Drawer State
    const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);

    // Auto-close mobile library drawer on route change
    useEffect(() => {
        setMobileLibraryOpen(false);
    }, [location.pathname]);

    // Refresh playlists on global mutation (e.g. liking/unliking songs)
    useEffect(() => {
        const handleMutation = () => {
            setPlaylistRefreshTrigger((prev) => prev + 1);
        };
        window.addEventListener("playlist-mutation", handleMutation);
        return () =>
            window.removeEventListener("playlist-mutation", handleMutation);
    }, []);

    // Open Auth Modal when an action requires authentication
    useEffect(() => {
        const handleAuthRequired = () => {
            setAuthModalOpen(true);
        };
        window.addEventListener("auth:required", handleAuthRequired);
        return () =>
            window.removeEventListener("auth:required", handleAuthRequired);
    }, []);

    const handleOpenCreatePlaylist = () => {
        setPlaylistModalMode("create");
        setSongToAdd(null);
        setPlaylistToEdit(null);
        setPlaylistModalOpen(true);
    };

    const handleAddToPlaylist = (song: SongMetadata) => {
        setPlaylistModalMode("add_song");
        setSongToAdd(song);
        setPlaylistToEdit(null);
        setPlaylistModalOpen(true);
    };

    const handleEditPlaylist = (playlist: {
        id: string;
        label: string;
        is_deletable?: boolean;
    }) => {
        if (playlist.is_deletable === false) return;
        setPlaylistModalMode("edit");
        setPlaylistToEdit({
            id: playlist.id,
            label: playlist.label,
            is_deletable: playlist.is_deletable,
            created_at: "",
            updated_at: "",
        });
        setSongToAdd(null);
        setPlaylistModalOpen(true);
    };

    const handlePlaylistMutationSuccess = () => {
        setPlaylistRefreshTrigger((prev) => prev + 1);
    };

    return (
        <div className="app-layout">
            {/* Toast Alerts */}
            <ToastContainer />

            {/* Left Navigation Sidebar (Desktop & Mobile Drawer) */}
            <Sidebar
                isOpen={mobileLibraryOpen}
                onClose={() => setMobileLibraryOpen(false)}
                onOpenAuthModal={() => setAuthModalOpen(true)}
                onOpenCreatePlaylistModal={handleOpenCreatePlaylist}
                playlistRefreshTrigger={playlistRefreshTrigger}
            />

            {/* Main Content Island */}
            <div className="panel main-content-island">
                <Navbar
                    onOpenAuthModal={() => setAuthModalOpen(true)}
                    onToggleSidebar={() =>
                        setMobileLibraryOpen(!mobileLibraryOpen)
                    }
                />

                <main style={{ flex: 1, minHeight: 0 }}>
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <HomePage
                                    onAddToPlaylist={handleAddToPlaylist}
                                    onOpenAuthModal={() =>
                                        setAuthModalOpen(true)
                                    }
                                />
                            }
                        />
                        <Route path="/search" element={<SearchPage />} />
                        <Route
                            path="/search/:categoryId"
                            element={<SongCollectionView mode="category" />}
                        />
                        <Route
                            path="/song/:id"
                            element={
                                <SongRoutePage
                                    onAddToPlaylist={handleAddToPlaylist}
                                    onOpenAuthModal={() =>
                                        setAuthModalOpen(true)
                                    }
                                />
                            }
                        />
                        <Route
                            path="/playlist/:id"
                            element={
                                <SongCollectionView
                                    mode="playlist"
                                    onEditPlaylist={handleEditPlaylist}
                                    onPlaylistDeleted={
                                        handlePlaylistMutationSuccess
                                    }
                                />
                            }
                        />
                        {/* Manual Protected Admin Route */}
                        <Route path="/admin" element={<AdminPage />} />
                    </Routes>
                </main>
            </div>

            {/* Fixed Bottom Player */}
            <Player
                onOpenPlaylistModal={handleAddToPlaylist}
                onOpenAuthModal={() => setAuthModalOpen(true)}
            />

            {/* Mobile Bottom Navigation Bar (< 768px) */}
            <BottomNav
                onToggleLibrary={() => setMobileLibraryOpen(!mobileLibraryOpen)}
                isLibraryOpen={mobileLibraryOpen}
            />

            {/* Modals */}
            <AuthModal
                isOpen={authModalOpen}
                onClose={() => setAuthModalOpen(false)}
            />
            <PlaylistModal
                isOpen={playlistModalOpen}
                onClose={() => setPlaylistModalOpen(false)}
                mode={playlistModalMode}
                songToAdd={songToAdd}
                playlistToEdit={playlistToEdit}
                onSuccess={handlePlaylistMutationSuccess}
            />
        </div>
    );
};

export const App: React.FC = () => {
    return (
        <BrowserRouter>
            <ToastProvider>
                <AuthProvider>
                    <PlayerProvider>
                        <AppContent />
                    </PlayerProvider>
                </AuthProvider>
            </ToastProvider>
        </BrowserRouter>
    );
};

export default App;
