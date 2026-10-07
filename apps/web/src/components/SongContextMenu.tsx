import React, { useState, useEffect, useRef } from "react";
import type { SongMetadata } from "../types";
import { playlistService } from "../services/playlistService";
import { useToast } from "../context/ToastContext";
import { Play, Pause, Plus, Heart, Share2, Loader2 } from "lucide-react";

interface SongContextMenuProps {
    isOpen: boolean;
    position: { x: number; y: number };
    song: SongMetadata | null;
    isThisPlaying: boolean;
    onClose: () => void;
    onPlay: () => void;
    onAddToPlaylist: () => void;
    onShare: () => void;
}

export const SongContextMenu: React.FC<SongContextMenuProps> = ({
    isOpen,
    position,
    song,
    isThisPlaying,
    onClose,
    onPlay,
    onAddToPlaylist,
    onShare,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [isLiked, setIsLiked] = useState<boolean | null>(null);
    const [loadingLike, setLoadingLike] = useState(false);
    const [adjustedPos, setAdjustedPos] = useState({ x: position.x, y: position.y });
    const { showToast } = useToast();

    // 1. Fetch like status whenever a new menu opens for a song
    useEffect(() => {
        if (!isOpen || !song) return;

        let active = true;
        setLoadingLike(true);
        setIsLiked(null);

        playlistService
            .getSongLikedStatus(song.id)
            .then((liked) => {
                if (active) {
                    setIsLiked(liked);
                    setLoadingLike(false);
                }
            })
            .catch(() => {
                if (active) {
                    setIsLiked(false);
                    setLoadingLike(false);
                }
            });

        return () => {
            active = false;
        };
    }, [isOpen, song?.id]);

    // 2. Adjust position to stay within viewport bounds
    useEffect(() => {
        if (!isOpen) return;

        const menuWidth = 220;
        const menuHeight = 180;
        const padding = 12;

        let nextX = position.x;
        let nextY = position.y;

        if (nextX + menuWidth > window.innerWidth - padding) {
            nextX = window.innerWidth - menuWidth - padding;
        }
        if (nextY + menuHeight > window.innerHeight - padding) {
            nextY = window.innerHeight - menuHeight - padding;
        }

        nextX = Math.max(padding, nextX);
        nextY = Math.max(padding, nextY);

        setAdjustedPos({ x: nextX, y: nextY });
    }, [isOpen, position.x, position.y]);

    // 3. Close on outside click, window scroll, or Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleOutsideClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleScrollOrResize = () => {
            onClose();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("click", handleOutsideClick);
        window.addEventListener("contextmenu", handleOutsideClick);
        window.addEventListener("scroll", handleScrollOrResize, true);
        window.addEventListener("resize", handleScrollOrResize);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("click", handleOutsideClick);
            window.removeEventListener("contextmenu", handleOutsideClick);
            window.removeEventListener("scroll", handleScrollOrResize, true);
            window.removeEventListener("resize", handleScrollOrResize);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !song) return null;

    const handleToggleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLiked === null) return;

        const nextLiked = !isLiked;
        setIsLiked(nextLiked);

        try {
            const res = await playlistService.toggleLikeSong(song.id);
            setIsLiked(res.liked);
            if (res.liked) {
                showToast("Saved to Liked Songs", "success", song.title);
            } else {
                showToast("Removed from Liked Songs", "info", song.title);
            }
            window.dispatchEvent(
                new CustomEvent("playlist-mutation", {
                    detail: {
                        playlistId: res.playlist_id,
                        songId: song.id,
                        action: res.liked ? "add" : "remove",
                        song,
                        isLikedPlaylist: true,
                    },
                }),
            );
        } catch {
            setIsLiked(!nextLiked);
            showToast("Error", "error", "Failed to update liked status");
        }
        onClose();
    };

    return (
        <div
            ref={menuRef}
            className="animate-fade-in"
            style={{
                position: "fixed",
                left: adjustedPos.x,
                top: adjustedPos.y,
                width: 220,
                background: "#282828",
                borderRadius: 8,
                padding: "4px 0",
                boxShadow:
                    "0 16px 36px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)",
                zIndex: 1200,
                userSelect: "none",
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Play / Pause item */}
            <div
                onClick={() => {
                    onPlay();
                    onClose();
                }}
                style={itemStyle}
                onMouseEnter={handleItemEnter}
                onMouseLeave={handleItemLeave}
            >
                {isThisPlaying ? (
                    <Pause size={16} color="#1ed760" />
                ) : (
                    <Play size={16} color="#ffffff" />
                )}
                <span>{isThisPlaying ? "Pause" : "Play"}</span>
            </div>

            {/* Like / Unlike item */}
            <div
                onClick={handleToggleLike}
                style={itemStyle}
                onMouseEnter={handleItemEnter}
                onMouseLeave={handleItemLeave}
            >
                {loadingLike ? (
                    <Loader2 size={16} className="animate-spin" color="var(--app-subtext)" />
                ) : isLiked ? (
                    <Heart size={16} fill="#1ed760" color="#1ed760" />
                ) : (
                    <Heart size={16} color="#ffffff" />
                )}
                <span>
                    {isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
                </span>
            </div>

            {/* Subtle Divider */}
            <div
                style={{
                    height: 1,
                    background: "rgba(255, 255, 255, 0.08)",
                    margin: "4px 0",
                }}
            />

            {/* Add to playlist item */}
            <div
                onClick={() => {
                    onAddToPlaylist();
                    onClose();
                }}
                style={itemStyle}
                onMouseEnter={handleItemEnter}
                onMouseLeave={handleItemLeave}
            >
                <Plus size={16} color="#ffffff" />
                <span>Add to playlist</span>
            </div>

            {/* Share item */}
            <div
                onClick={() => {
                    onShare();
                    onClose();
                }}
                style={itemStyle}
                onMouseEnter={handleItemEnter}
                onMouseLeave={handleItemLeave}
            >
                <Share2 size={16} color="#ffffff" />
                <span>Share</span>
            </div>
        </div>
    );
};

const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 500,
    color: "#eaeaea",
    cursor: "pointer",
    transition: "background 0.12s ease, color 0.12s ease",
};

const handleItemEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
    e.currentTarget.style.color = "#ffffff";
};

const handleItemLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.color = "#eaeaea";
};
