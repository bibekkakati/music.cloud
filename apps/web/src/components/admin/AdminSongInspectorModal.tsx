import React from "react";
import type { SongDetail } from "../../types";
import { Eye, X } from "lucide-react";

interface AdminSongInspectorModalProps {
    song: SongDetail | null;
    onClose: () => void;
}

export const AdminSongInspectorModal: React.FC<AdminSongInspectorModalProps> = ({
    song,
    onClose,
}) => {
    if (!song) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                backdropFilter: "blur(8px)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
            onClick={onClose}
        >
            <div
                className="glass-panel animate-fade-in"
                style={{
                    width: "100%",
                    maxWidth: 580,
                    borderRadius: "var(--radius-lg)",
                    padding: 28,
                    position: "relative",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="btn-ghost"
                    style={{ position: "absolute", top: 16, right: 16 }}
                >
                    <X size={20} />
                </button>

                <h3
                    style={{
                        fontSize: 18,
                        fontWeight: 700,
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <Eye size={20} color="var(--app-green)" />
                    <span>Song Technical Details</span>
                </h3>

                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        fontSize: 13,
                    }}
                >
                    <div
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            padding: 10,
                            borderRadius: "var(--radius-sm)",
                        }}
                    >
                        <span
                            style={{
                                color: "var(--text-muted)",
                                display: "block",
                                fontSize: 11,
                            }}
                        >
                            Song ID
                        </span>
                        <code style={{ color: "var(--accent-cyan)" }}>
                            {song.id}
                        </code>
                    </div>

                    <div
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            padding: 10,
                            borderRadius: "var(--radius-sm)",
                        }}
                    >
                        <span
                            style={{
                                color: "var(--text-muted)",
                                display: "block",
                                fontSize: 11,
                            }}
                        >
                            Status
                        </span>
                        <span
                            style={{
                                fontWeight: 600,
                                color:
                                    song.status?.toUpperCase() === "DONE"
                                        ? "#1ed760"
                                        : "#eab308",
                            }}
                        >
                            {song.status?.toUpperCase() || "UNKNOWN"}
                        </span>
                    </div>

                    <div
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            padding: 10,
                            borderRadius: "var(--radius-sm)",
                        }}
                    >
                        <span
                            style={{
                                color: "var(--text-muted)",
                                display: "block",
                                fontSize: 11,
                            }}
                        >
                            Original Master Key
                        </span>
                        <code>{song.original_key || "N/A"}</code>
                    </div>

                    <div
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            padding: 10,
                            borderRadius: "var(--radius-sm)",
                        }}
                    >
                        <span
                            style={{
                                color: "var(--text-muted)",
                                display: "block",
                                fontSize: 11,
                            }}
                        >
                            Transcoded MP3 Key
                        </span>
                        <code>{song.master_mp3_key || "N/A"}</code>
                    </div>

                    <div
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            padding: 10,
                            borderRadius: "var(--radius-sm)",
                        }}
                    >
                        <span
                            style={{
                                color: "var(--text-muted)",
                                display: "block",
                                fontSize: 11,
                            }}
                        >
                            Transcoded AAC Key
                        </span>
                        <code>{song.master_aac_key || "N/A"}</code>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                        }}
                    >
                        <div
                            style={{
                                background: "rgba(255,255,255,0.03)",
                                padding: 10,
                                borderRadius: "var(--radius-sm)",
                            }}
                        >
                            <span
                                style={{
                                    color: "var(--text-muted)",
                                    display: "block",
                                    fontSize: 11,
                                }}
                            >
                                Duration
                            </span>
                            <span>{song.duration_sec} seconds</span>
                        </div>
                        <div
                            style={{
                                background: "rgba(255,255,255,0.03)",
                                padding: 10,
                                borderRadius: "var(--radius-sm)",
                            }}
                        >
                            <span
                                style={{
                                    color: "var(--text-muted)",
                                    display: "block",
                                    fontSize: 11,
                                }}
                            >
                                Bitrate
                            </span>
                            <span>
                                {song.source_bitrate_kbps} kbps
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 20, textAlign: "right" }}>
                    <button onClick={onClose} className="btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
