import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { Navbar } from "../components/Navbar";
import { Player } from "../components/Player";
import { BottomNav } from "../components/BottomNav";
import { AuthModal } from "../components/AuthModal";
import { PlaylistModal } from "../components/PlaylistModal";
import type { SongMetadata, PlaylistSummary } from "../types";

export interface UserLayoutProps {
    mobileLibraryOpen: boolean;
    setMobileLibraryOpen: (open: boolean) => void;
    authModalOpen: boolean;
    setAuthModalOpen: (open: boolean) => void;
    playlistModalOpen: boolean;
    setPlaylistModalOpen: (open: boolean) => void;
    playlistModalMode: "create" | "add_song" | "edit";
    songToAdd: SongMetadata | null;
    playlistToEdit: PlaylistSummary | null;
    playlistRefreshTrigger: number;
    handleOpenCreatePlaylist: () => void;
    handleAddToPlaylist: (song: SongMetadata) => void;
    handlePlaylistMutationSuccess: () => void;
}

export const UserLayout: React.FC<UserLayoutProps> = ({
    mobileLibraryOpen,
    setMobileLibraryOpen,
    authModalOpen,
    setAuthModalOpen,
    playlistModalOpen,
    setPlaylistModalOpen,
    playlistModalMode,
    songToAdd,
    playlistToEdit,
    playlistRefreshTrigger,
    handleOpenCreatePlaylist,
    handleAddToPlaylist,
    handlePlaylistMutationSuccess,
}) => {
    return (
        <div className="app-layout">
            {/* Left Navigation Sidebar */}
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
                    onToggleSidebar={() => setMobileLibraryOpen(!mobileLibraryOpen)}
                />

                <main className="user-layout-main">
                    <Outlet />
                </main>
            </div>

            {/* Fixed Bottom Player */}
            <Player
                onOpenPlaylistModal={handleAddToPlaylist}
                onOpenAuthModal={() => setAuthModalOpen(true)}
            />

            {/* Mobile Bottom Navigation (< 768px) */}
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

export default UserLayout;
