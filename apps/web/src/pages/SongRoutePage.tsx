import React, { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { songService } from "../services/songService";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { HomePage } from "./HomePage";
import type { SongMetadata } from "../types";

interface SongRoutePageProps {
    onAddToPlaylist: (song: SongMetadata) => void;
    onOpenAuthModal?: () => void;
}

export const SongRoutePage: React.FC<SongRoutePageProps> = ({
    onAddToPlaylist,
    onOpenAuthModal,
}) => {
    const { id } = useParams<{ id: string }>();
    const { playSong, currentSong } = usePlayer();
    const { isLoading: isAuthLoading } = useAuth();
    const { showToast } = useToast();
    const attemptedIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!id || isAuthLoading) return;
        if (attemptedIdRef.current === id && currentSong?.id === id) return;

        attemptedIdRef.current = id;

        songService
            .getSongById(id)
            .then((song) => {
                if (song) {
                    playSong(song, [song]);
                }
            })
            .catch((err) => {
                console.error("Failed to load song from URL param:", err);
                showToast(
                    "Song Unavailable",
                    "error",
                    "Could not load the requested song.",
                );
            });
    }, [id, isAuthLoading, playSong, currentSong?.id, showToast]);

    return (
        <HomePage
            onAddToPlaylist={onAddToPlaylist}
            onOpenAuthModal={onOpenAuthModal}
        />
    );
};
