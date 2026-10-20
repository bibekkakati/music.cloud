import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import { PlayerProvider } from "./context/PlayerContext";
import { ToastContainer } from "./components/ToastContainer";

import { UserLayout } from "./layouts/UserLayout";
import { AdminLayout } from "./layouts/AdminLayout";

import { HomePage } from "./pages/HomePage";
import { SearchPage } from "./pages/SearchPage";
import { SongCollectionView } from "./pages/SongCollectionView";
import { SongRoutePage } from "./pages/SongRoutePage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminCatalogPage } from "./pages/admin/AdminCatalogPage";
import { AdminUploadPage } from "./pages/admin/AdminUploadPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";

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
        <>
            {/* Global Toast Alerts */}
            <ToastContainer />

            <Routes>
                {/* Consumer Music App Layout & Routes */}
                <Route
                    element={
                        <UserLayout
                            mobileLibraryOpen={mobileLibraryOpen}
                            setMobileLibraryOpen={setMobileLibraryOpen}
                            authModalOpen={authModalOpen}
                            setAuthModalOpen={setAuthModalOpen}
                            playlistModalOpen={playlistModalOpen}
                            setPlaylistModalOpen={setPlaylistModalOpen}
                            playlistModalMode={playlistModalMode}
                            songToAdd={songToAdd}
                            playlistToEdit={playlistToEdit}
                            playlistRefreshTrigger={playlistRefreshTrigger}
                            handleOpenCreatePlaylist={handleOpenCreatePlaylist}
                            handleAddToPlaylist={handleAddToPlaylist}
                            handlePlaylistMutationSuccess={
                                handlePlaylistMutationSuccess
                            }
                        />
                    }
                >
                    <Route
                        path="/"
                        element={
                            <HomePage
                                onAddToPlaylist={handleAddToPlaylist}
                                onOpenAuthModal={() => setAuthModalOpen(true)}
                            />
                        }
                    />
                    <Route path="/search" element={<SearchPage />} />
                    <Route
                        path="/search/:categoryLabel"
                        element={
                            <SongCollectionView
                                mode="category"
                                onAddToPlaylist={handleAddToPlaylist}
                            />
                        }
                    />
                    <Route
                        path="/song/:id"
                        element={
                            <SongRoutePage
                                onAddToPlaylist={handleAddToPlaylist}
                                onOpenAuthModal={() => setAuthModalOpen(true)}
                            />
                        }
                    />
                    <Route
                        path="/playlist/:id"
                        element={
                            <SongCollectionView
                                mode="playlist"
                                onAddToPlaylist={handleAddToPlaylist}
                                onEditPlaylist={handleEditPlaylist}
                                onPlaylistDeleted={
                                    handlePlaylistMutationSuccess
                                }
                            />
                        }
                    />
                    <Route
                        path="/settings"
                        element={
                            <SettingsPage
                                onOpenAuthModal={() => setAuthModalOpen(true)}
                            />
                        }
                    />
                </Route>

                {/* Dedicated Admin Portal Layout & Routes */}
                <Route path="/admin" element={<AdminLayout />}>
                    <Route
                        index
                        element={<Navigate to="/admin/catalog" replace />}
                    />
                    <Route path="catalog" element={<AdminCatalogPage />} />
                    <Route path="upload" element={<AdminUploadPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                </Route>

                {/* Wildcard Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </>
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
