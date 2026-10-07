import React, { useState } from "react";
import type { SongMetadata } from "../types";
import { SongCoverArt } from "./SongCoverArt";
import { useToast } from "../context/ToastContext";
import { X, Check, Copy, MessageCircle, Share2 } from "lucide-react";

interface SongShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    song: SongMetadata | null;
}

export const SongShareModal: React.FC<SongShareModalProps> = ({
    isOpen,
    onClose,
    song,
}) => {
    const [copied, setCopied] = useState(false);
    const { showToast } = useToast();

    if (!isOpen || !song) return null;

    const shareUrl = `${window.location.origin}/song/${song.id}`;
    const shareText = `Listen to "${song.title}" by ${song.artist} on Music Cloud`;

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            showToast("Link Copied", "success", "Song URL copied to clipboard");
            setTimeout(() => setCopied(false), 2200);
        } catch {
            showToast("Error", "error", "Could not copy link to clipboard");
        }
    };

    const handleWhatsAppShare = () => {
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(
            `${shareText}: ${shareUrl}`,
        )}`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    const handleFacebookShare = () => {
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            shareUrl,
        )}`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    const handleTwitterShare = () => {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            shareText,
        )}&url=${encodeURIComponent(shareUrl)}`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    const handleInstagramShare = async () => {
        // Instagram doesn't have a direct URL intent for web, so copy link and guide user
        await handleCopyLink();
        showToast(
            "Link Copied for Instagram",
            "info",
            "Paste this link in your Instagram story or message",
        );
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: song.title,
                    text: shareText,
                    url: shareUrl,
                });
            } catch {
                // User cancelled or share failed
            }
        } else {
            handleCopyLink();
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                backdropFilter: "blur(6px)",
                zIndex: 1100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
            onClick={onClose}
        >
            <div
                className="animate-fade-in"
                style={{
                    width: "100%",
                    maxWidth: 380,
                    borderRadius: 12,
                    background: "#222222",
                    boxShadow: "0 24px 50px rgba(0, 0, 0, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: 24,
                    position: "relative",
                    overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 18,
                    }}
                >
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: "#ffffff",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        Share song
                    </div>
                    <button
                        onClick={onClose}
                        className="app-btn-ghost"
                        style={{
                            color: "var(--app-subtext)",
                            padding: 6,
                            borderRadius: "50%",
                        }}
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Song Card Preview */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: 12,
                        borderRadius: 8,
                        background: "#181818",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        marginBottom: 20,
                    }}
                >
                    <SongCoverArt
                        src={song.cover_art_url}
                        alt={song.title}
                        size={52}
                        borderRadius={6}
                        iconSize={22}
                        style={{ flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                            style={{
                                fontSize: 14,
                                fontWeight: 700,
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
                                marginTop: 3,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {song.artist}
                        </div>
                    </div>
                </div>

                {/* Share Options Grid */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 12,
                        marginBottom: 20,
                    }}
                >
                    {/* WhatsApp */}
                    <button
                        onClick={handleWhatsAppShare}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 6,
                            borderRadius: 8,
                            color: "#ffffff",
                            transition: "opacity 0.15s ease",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.opacity = "0.85")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.opacity = "1")
                        }
                    >
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: "50%",
                                background: "#25D366",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#ffffff",
                                boxShadow: "0 4px 12px rgba(37, 211, 102, 0.3)",
                            }}
                        >
                            <MessageCircle size={22} />
                        </div>
                        <span
                            style={{
                                fontSize: 11,
                                color: "var(--app-subtext)",
                                fontWeight: 500,
                            }}
                        >
                            WhatsApp
                        </span>
                    </button>

                    {/* Instagram */}
                    <button
                        onClick={handleInstagramShare}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 6,
                            borderRadius: 8,
                            color: "#ffffff",
                            transition: "opacity 0.15s ease",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.opacity = "0.85")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.opacity = "1")
                        }
                    >
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: "50%",
                                background:
                                    "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#ffffff",
                                boxShadow: "0 4px 12px rgba(220, 39, 67, 0.3)",
                            }}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect
                                    x="2"
                                    y="2"
                                    width="20"
                                    height="20"
                                    rx="5"
                                    ry="5"
                                />
                                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                            </svg>
                        </div>
                        <span
                            style={{
                                fontSize: 11,
                                color: "var(--app-subtext)",
                                fontWeight: 500,
                            }}
                        >
                            Instagram
                        </span>
                    </button>

                    {/* Facebook */}
                    <button
                        onClick={handleFacebookShare}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 6,
                            borderRadius: 8,
                            color: "#ffffff",
                            transition: "opacity 0.15s ease",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.opacity = "0.85")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.opacity = "1")
                        }
                    >
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: "50%",
                                background: "#1877F2",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#ffffff",
                                boxShadow: "0 4px 12px rgba(24, 119, 242, 0.3)",
                            }}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                        </div>
                        <span
                            style={{
                                fontSize: 11,
                                color: "var(--app-subtext)",
                                fontWeight: 500,
                            }}
                        >
                            Facebook
                        </span>
                    </button>

                    {/* X (Twitter) or System Share */}
                    <button
                        onClick={
                            typeof navigator !== "undefined" &&
                            typeof navigator.share === "function"
                                ? handleNativeShare
                                : handleTwitterShare
                        }
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 6,
                            borderRadius: 8,
                            color: "#ffffff",
                            transition: "opacity 0.15s ease",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.opacity = "0.85")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.opacity = "1")
                        }
                    >
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: "50%",
                                background: "#111111",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                display: "flex",
                                alignItems: "center",
                                justifyItems: "center",
                                justifyContent: "center",
                                color: "#ffffff",
                            }}
                        >
                            {typeof navigator !== "undefined" &&
                            typeof navigator.share === "function" ? (
                                <Share2 size={18} />
                            ) : (
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            )}
                        </div>
                        <span
                            style={{
                                fontSize: 11,
                                color: "var(--app-subtext)",
                                fontWeight: 500,
                            }}
                        >
                            {typeof navigator !== "undefined" &&
                            typeof navigator.share === "function"
                                ? "More..."
                                : "X"}
                        </span>
                    </button>
                </div>

                {/* Copy Link Input Bar */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "#121212",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: 6,
                        padding: "4px 4px 4px 12px",
                    }}
                >
                    <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            color: "#b3b3b3",
                            fontSize: 12,
                            outline: "none",
                            userSelect: "all",
                        }}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                        onClick={handleCopyLink}
                        className={copied ? "app-btn-green" : "app-btn-ghost"}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            borderRadius: 4,
                            background: copied
                                ? "var(--app-green)"
                                : "rgba(255, 255, 255, 0.1)",
                            color: copied ? "#000000" : "#ffffff",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                        }}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
