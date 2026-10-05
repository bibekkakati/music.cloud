import React, { useState } from "react";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { SongCoverArt } from "./SongCoverArt";
import type { SongMetadata } from "../types";
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Repeat,
    Shuffle,
    Volume2,
    VolumeX,
    Heart,
    Plus,
    ChevronDown,
    Music,
} from "lucide-react";

interface PlayerProps {
    onOpenPlaylistModal?: (song: SongMetadata) => void;
    onOpenAuthModal?: () => void;
}

const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

export const Player: React.FC<PlayerProps> = ({
    onOpenPlaylistModal,
    onOpenAuthModal,
}) => {
    const { isAuthenticated } = useAuth();
    const {
        currentSong,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isLoop,
        isShuffle,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleMute,
        toggleLoop,
        toggleShuffle,
        isLiked,
        toggleLike,
    } = usePlayer();

    const isPlayerDisabled = !isAuthenticated || !currentSong;

    const handleAuthAction = () => {
        if (onOpenAuthModal) {
            onOpenAuthModal();
        } else {
            window.dispatchEvent(new CustomEvent("auth:required"));
        }
    };

    const [isTimelineHovered, setIsTimelineHovered] = useState(false);
    const [isVolumeHovered, setIsVolumeHovered] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const progressPercent =
        currentSong && duration > 0 ? (currentTime / duration) * 100 : 0;
    const volumePercent = (isMuted ? 0 : volume) * 100;

    return (
        <>
            {/* ========================================================= */}
            {/* 1. Mobile Full-Screen "Now Playing" Modal */}
            {/* ========================================================= */}
            {isExpanded && currentSong && (
                <div
                    className="mobile-now-playing-modal animate-fade-in"
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 100,
                        backgroundColor: "#121212",
                        background:
                            "linear-gradient(180deg, #2b2b2b 0%, #121212 100%)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        padding:
                            "24px 24px calc(24px + env(safe-area-inset-bottom, 0px))",
                        overflowY: "auto",
                    }}
                >
                    {/* Top Bar: Minimize button + Context Title */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 20,
                        }}
                    >
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="app-btn-ghost"
                            style={{ padding: 8, color: "#ffffff" }}
                            title="Close"
                        >
                            <ChevronDown size={28} />
                        </button>

                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                color: "var(--app-subtext)",
                                textTransform: "uppercase",
                            }}
                        >
                            Playing from Library
                        </span>

                        <div style={{ width: 44 }} />
                    </div>

                    {/* Large Center Cover Art */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            margin: "16px 0",
                        }}
                    >
                        <SongCoverArt
                            src={currentSong.cover_art_url}
                            alt={currentSong.title}
                            size="min(76vw, 320px)"
                            borderRadius={8}
                            iconSize={64}
                            style={{
                                boxShadow: "0 16px 40px rgba(0, 0, 0, 0.7)",
                                aspectRatio: "1/1",
                            }}
                        />
                    </div>

                    {/* Track Metadata & Like Action */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: 16,
                        }}
                    >
                        <div style={{ minWidth: 0, flex: 1, paddingRight: 16 }}>
                            <h2
                                style={{
                                    fontSize: "clamp(20px, 5vw, 26px)",
                                    fontWeight: 800,
                                    color: "#ffffff",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {currentSong.title}
                            </h2>
                            <p
                                style={{
                                    fontSize: 15,
                                    color: "var(--app-subtext)",
                                    marginTop: 4,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {currentSong.artist}
                            </p>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <button
                                onClick={toggleLike}
                                className="app-btn-ghost"
                                style={{
                                    color: isLiked
                                        ? "var(--app-green)"
                                        : "var(--app-subtext)",
                                    padding: 10,
                                }}
                            >
                                <Heart
                                    size={24}
                                    fill={isLiked ? "var(--app-green)" : "none"}
                                />
                            </button>

                            {onOpenPlaylistModal && currentSong && (
                                <button
                                    onClick={() => {
                                        setIsExpanded(false);
                                        onOpenPlaylistModal(currentSong);
                                    }}
                                    className="app-btn-ghost"
                                    style={{
                                        color: "var(--app-subtext)",
                                        padding: 10,
                                    }}
                                >
                                    <Plus size={24} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrubber / Timeline Slider */}
                    <div style={{ marginTop: 24, width: "100%" }}>
                        <div
                            className="app-slider-container"
                            style={{ width: "100%" }}
                        >
                            <input
                                type="range"
                                min={0}
                                max={duration || 100}
                                value={currentTime}
                                onChange={(e) => seek(Number(e.target.value))}
                                style={{
                                    height: 6,
                                    background: `linear-gradient(to right, #ffffff ${progressPercent}%, var(--app-slider-bg) ${progressPercent}%)`,
                                }}
                            />
                        </div>

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginTop: 8,
                                fontSize: 12,
                                color: "var(--app-subtext)",
                            }}
                        >
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Expanded Playback Controls */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            margin: "24px 0 16px",
                        }}
                    >
                        <button
                            onClick={toggleShuffle}
                            className="app-btn-ghost"
                            style={{
                                color: isShuffle
                                    ? "var(--app-green)"
                                    : "var(--app-subtext)",
                            }}
                        >
                            <Shuffle size={22} />
                        </button>

                        <button onClick={prevTrack} className="app-btn-ghost">
                            <SkipBack size={28} fill="currentColor" />
                        </button>

                        <button
                            onClick={togglePlay}
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: "50%",
                                backgroundColor: "#ffffff",
                                border: "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#000000",
                                cursor: "pointer",
                                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
                            }}
                        >
                            {isPlaying ? (
                                <Pause size={28} fill="#000" />
                            ) : (
                                <Play
                                    size={28}
                                    fill="#000"
                                    style={{ marginLeft: 3 }}
                                />
                            )}
                        </button>

                        <button onClick={nextTrack} className="app-btn-ghost">
                            <SkipForward size={28} fill="currentColor" />
                        </button>

                        <button
                            onClick={toggleLoop}
                            className="app-btn-ghost"
                            style={{
                                color: isLoop
                                    ? "var(--app-green)"
                                    : "var(--app-subtext)",
                            }}
                        >
                            <Repeat size={22} />
                        </button>
                    </div>

                    {/* Volume Row in Expanded View */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "0 8px",
                        }}
                    >
                        <button
                            onClick={toggleMute}
                            className="app-btn-ghost"
                            style={{ padding: 4 }}
                        >
                            {isMuted || volume === 0 ? (
                                <VolumeX size={20} />
                            ) : (
                                <Volume2 size={20} />
                            )}
                        </button>
                        <div
                            className="app-slider-container"
                            style={{ flex: 1 }}
                        >
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={isMuted ? 0 : volume}
                                onChange={(e) =>
                                    setVolume(Number(e.target.value))
                                }
                                style={{
                                    height: 4,
                                    background: `linear-gradient(to right, #ffffff ${volumePercent}%, var(--app-slider-bg) ${volumePercent}%)`,
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 2. Primary Footer Player (Desktop, iPad & Mobile Mini) */}
            {/* ========================================================= */}
            <footer className="app-footer-player">
                {/* Mobile Top Edge Progress Line */}
                <div
                    className="mobile-mini-progressbar"
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        background: `linear-gradient(to right, var(--app-green) ${progressPercent}%, rgba(255, 255, 255, 0.15) ${progressPercent}%)`,
                    }}
                />

                {/* 1. Left: Track Info & Heart */}
                <div
                    className="player-left-section"
                    onClick={() => {
                        // On mobile viewports, tapping the left section expands the now playing modal only if a track is active
                        if (window.innerWidth <= 768 && currentSong) {
                            setIsExpanded(true);
                        }
                    }}
                    style={{
                        cursor:
                            currentSong && window.innerWidth <= 768
                                ? "pointer"
                                : "default",
                    }}
                >
                    {/* Album Artwork */}
                    {currentSong ? (
                        <SongCoverArt
                            src={currentSong.cover_art_url}
                            alt={currentSong.title}
                            size={48}
                            borderRadius={4}
                            iconSize={22}
                            style={{
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
                                flexShrink: 0,
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 4,
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                color: "var(--app-subtext)",
                            }}
                        >
                            <Music size={20} style={{ opacity: 0.4 }} />
                        </div>
                    )}

                    {/* Title and Artist */}
                    <div
                        style={{
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            cursor: !isAuthenticated ? "pointer" : "default",
                        }}
                        onClick={() => {
                            if (!isAuthenticated) handleAuthAction();
                        }}
                    >
                        <div
                            className="player-track-title"
                            style={{
                                color:
                                    currentSong && isAuthenticated
                                        ? "var(--app-text)"
                                        : "var(--app-subtext)",
                                opacity: currentSong && isAuthenticated ? 1 : 0.7,
                            }}
                        >
                            {!isAuthenticated
                                ? "Sign in to play music"
                                : currentSong
                                  ? currentSong.title
                                  : "No track playing"}
                        </div>
                        <div
                            className="player-track-artist"
                            style={{
                                opacity: currentSong && isAuthenticated ? 1 : 0.45,
                            }}
                        >
                            {!isAuthenticated
                                ? "Click to sign in and start listening"
                                : currentSong
                                  ? currentSong.artist
                                  : "Select a song to play"}
                        </div>
                    </div>

                    {/* Like and Add Buttons (Desktop / Tablet) */}
                    <div
                        className="player-actions-desktop"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            marginLeft: 8,
                        }}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isAuthenticated) {
                                    handleAuthAction();
                                    return;
                                }
                                if (currentSong) toggleLike();
                            }}
                            disabled={isPlayerDisabled}
                            className="app-btn-ghost"
                            title={
                                !isAuthenticated
                                    ? "Sign in to save songs"
                                    : !currentSong
                                      ? ""
                                      : isLiked
                                        ? "Remove from Your Library"
                                        : "Save to Your Library"
                            }
                            style={{
                                color:
                                    isLiked && currentSong && isAuthenticated
                                        ? "var(--app-green)"
                                        : "var(--app-subtext)",
                            }}
                        >
                            <Heart
                                size={18}
                                fill={
                                    isLiked && currentSong && isAuthenticated
                                        ? "var(--app-green)"
                                        : "none"
                                }
                            />
                        </button>

                        {onOpenPlaylistModal && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isAuthenticated) {
                                        handleAuthAction();
                                        return;
                                    }
                                    if (currentSong) {
                                        onOpenPlaylistModal(currentSong);
                                    }
                                }}
                                disabled={isPlayerDisabled}
                                className="app-btn-ghost"
                                title={
                                    !isAuthenticated
                                        ? "Sign in required"
                                        : currentSong
                                          ? "Add to playlist"
                                          : ""
                                }
                            >
                                <Plus size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* 2. Center: Controls & Seek Timeline (Desktop / Tablet) */}
                <div className="player-center-section">
                    {/* Buttons Row */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                        }}
                    >
                        <button
                            onClick={toggleShuffle}
                            disabled={isPlayerDisabled}
                            className="app-btn-ghost"
                            style={{
                                color:
                                    isShuffle && currentSong && isAuthenticated
                                        ? "var(--app-green)"
                                        : "var(--app-subtext)",
                                position: "relative",
                            }}
                            title={
                                !isAuthenticated
                                    ? "Sign in required"
                                    : currentSong
                                      ? "Enable shuffle"
                                      : ""
                            }
                        >
                            <Shuffle size={18} />
                            {isShuffle && currentSong && isAuthenticated && (
                                <span
                                    style={{
                                        position: "absolute",
                                        bottom: 2,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        width: 4,
                                        height: 4,
                                        borderRadius: "50%",
                                        background: "var(--app-green)",
                                    }}
                                />
                            )}
                        </button>

                        <button
                            onClick={prevTrack}
                            disabled={isPlayerDisabled}
                            className="app-btn-ghost"
                            title={
                                !isAuthenticated
                                    ? "Sign in required"
                                    : currentSong
                                      ? "Previous"
                                      : ""
                            }
                        >
                            <SkipBack size={20} fill="currentColor" />
                        </button>

                        {/* Play/Pause Button */}
                        <button
                            onClick={() => {
                                if (!isAuthenticated) {
                                    handleAuthAction();
                                    return;
                                }
                                togglePlay();
                            }}
                            disabled={isPlayerDisabled}
                            className="player-play-circle"
                            style={{
                                opacity: isPlayerDisabled ? 0.45 : 1,
                                cursor: !isAuthenticated
                                    ? "pointer"
                                    : !currentSong
                                      ? "not-allowed"
                                      : "pointer",
                            }}
                            title={
                                !isAuthenticated
                                    ? "Sign in to play music"
                                    : !currentSong
                                      ? "No track loaded"
                                      : isPlaying
                                        ? "Pause"
                                        : "Play"
                            }
                        >
                            {isPlaying ? (
                                <Pause size={18} fill="#000000" />
                            ) : (
                                <Play
                                    size={18}
                                    fill="#000000"
                                    style={{ marginLeft: 2 }}
                                />
                            )}
                        </button>

                        <button
                            onClick={nextTrack}
                            disabled={isPlayerDisabled}
                            className="app-btn-ghost"
                            title={
                                !isAuthenticated
                                    ? "Sign in required"
                                    : currentSong
                                      ? "Next"
                                      : ""
                            }
                        >
                            <SkipForward size={20} fill="currentColor" />
                        </button>

                        <button
                            onClick={toggleLoop}
                            disabled={isPlayerDisabled}
                            className="app-btn-ghost"
                            style={{
                                color:
                                    isLoop && currentSong && isAuthenticated
                                        ? "var(--app-green)"
                                        : "var(--app-subtext)",
                                position: "relative",
                            }}
                            title={
                                !isAuthenticated
                                    ? "Sign in required"
                                    : currentSong
                                      ? "Enable repeat"
                                      : ""
                            }
                        >
                            <Repeat size={18} />
                            {isLoop && currentSong && isAuthenticated && (
                                <span
                                    style={{
                                        position: "absolute",
                                        bottom: 2,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        width: 4,
                                        height: 4,
                                        borderRadius: "50%",
                                        background: "var(--app-green)",
                                    }}
                                />
                            )}
                        </button>
                    </div>

                    {/* Progress Bar Row */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 11,
                                color: "var(--app-subtext)",
                                minWidth: 32,
                                textAlign: "right",
                                opacity: currentSong ? 1 : 0.45,
                            }}
                        >
                            {currentSong ? formatTime(currentTime) : "0:00"}
                        </span>

                        <div
                            className="app-slider-container"
                            onMouseEnter={() =>
                                currentSong && setIsTimelineHovered(true)
                            }
                            onMouseLeave={() => setIsTimelineHovered(false)}
                            style={{
                                flex: 1,
                                opacity: currentSong ? 1 : 0.4,
                                cursor: currentSong ? "pointer" : "not-allowed",
                            }}
                        >
                            <input
                                type="range"
                                min={0}
                                max={
                                    currentSong && duration > 0 ? duration : 100
                                }
                                value={currentSong ? currentTime : 0}
                                disabled={isPlayerDisabled}
                                onChange={(e) => seek(Number(e.target.value))}
                                style={{
                                    cursor: isPlayerDisabled
                                        ? "not-allowed"
                                        : "pointer",
                                    background: `linear-gradient(to right, ${
                                        isTimelineHovered && currentSong && isAuthenticated
                                            ? "var(--app-green)"
                                            : "#ffffff"
                                    } ${progressPercent}%, var(--app-slider-bg) ${progressPercent}%)`,
                                }}
                            />
                        </div>

                        <span
                            style={{
                                fontSize: 11,
                                color: "var(--app-subtext)",
                                minWidth: 32,
                                opacity: currentSong ? 1 : 0.45,
                            }}
                        >
                            {currentSong ? formatTime(duration) : "0:00"}
                        </span>
                    </div>
                </div>

                {/* 3. Right: Volume & Queue (Desktop / Tablet) OR Mini-controls (Mobile) */}
                <div className="player-right-section">
                    {/* Mobile Quick Play/Pause and Like */}
                    <div className="mobile-mini-controls">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isAuthenticated) {
                                    handleAuthAction();
                                    return;
                                }
                                if (currentSong) toggleLike();
                            }}
                            disabled={isPlayerDisabled}
                            className="app-btn-ghost"
                            style={{
                                color:
                                    isLiked && currentSong && isAuthenticated
                                        ? "var(--app-green)"
                                        : "var(--app-subtext)",
                                padding: 6,
                            }}
                            title={
                                !isAuthenticated
                                    ? "Sign in to save songs"
                                    : !currentSong
                                      ? ""
                                      : isLiked
                                        ? "Remove from Your Library"
                                        : "Save to Your Library"
                            }
                        >
                            <Heart
                                size={20}
                                fill={
                                    isLiked && currentSong && isAuthenticated
                                        ? "var(--app-green)"
                                        : "none"
                                }
                            />
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isAuthenticated) {
                                    handleAuthAction();
                                    return;
                                }
                                if (currentSong) togglePlay();
                            }}
                            disabled={isPlayerDisabled}
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: "50%",
                                background: "#ffffff",
                                border: "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#000000",
                                cursor: !isAuthenticated
                                    ? "pointer"
                                    : !currentSong
                                      ? "not-allowed"
                                      : "pointer",
                                opacity: isPlayerDisabled ? 0.35 : 1,
                                flexShrink: 0,
                            }}
                        >
                            {isPlaying ? (
                                <Pause size={18} fill="#000" />
                            ) : (
                                <Play
                                    size={18}
                                    fill="#000"
                                    style={{ marginLeft: 2 }}
                                />
                            )}
                        </button>
                    </div>

                    {/* Desktop Volume Slider */}
                    <div className="desktop-volume-controls">
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                            }}
                        >
                            <button
                                onClick={toggleMute}
                                className="app-btn-ghost"
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                {isMuted || volume === 0 ? (
                                    <VolumeX size={18} />
                                ) : (
                                    <Volume2 size={18} />
                                )}
                            </button>

                            <div
                                className="app-slider-container"
                                onMouseEnter={() => setIsVolumeHovered(true)}
                                onMouseLeave={() => setIsVolumeHovered(false)}
                                style={{ width: 85 }}
                            >
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={isMuted ? 0 : volume}
                                    onChange={(e) =>
                                        setVolume(Number(e.target.value))
                                    }
                                    style={{
                                        background: `linear-gradient(to right, ${
                                            isVolumeHovered
                                                ? "var(--app-green)"
                                                : "#ffffff"
                                        } ${volumePercent}%, var(--app-slider-bg) ${volumePercent}%)`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </>
    );
};
