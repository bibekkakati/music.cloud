import React, { useState, useEffect, useRef } from "react";
import type { SongDetail } from "../../types";
import { Edit3, Globe, Lock, Loader2, X, Upload, Music, Trash2 } from "lucide-react";
import { adminService } from "../../services/adminService";

interface AdminSongEditModalProps {
    song: SongDetail | null;
    onClose: () => void;
    onSave: (
        songId: string,
        title: string,
        artist: string,
        isPublic: boolean,
        coverArtKey?: string,
    ) => Promise<void>;
}

export const AdminSongEditModal: React.FC<AdminSongEditModalProps> = ({
    song,
    onClose,
    onSave,
}) => {
    const [editTitle, setEditTitle] = useState("");
    const [editArtist, setEditArtist] = useState("");
    const [editIsPublic, setEditIsPublic] = useState(true);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (song) {
            setEditTitle(song.title);
            setEditArtist(song.artist);
            setEditIsPublic(song.is_public !== false);
            setSelectedFile(null);
            setPreviewUrl(null);
            setUploadStatus(null);
        }
    }, [song]);

    // Clean up blob preview URL on unmount or file change
    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith("blob:")) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    if (!song) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Revoke previous blob if any
        if (previewUrl && previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl);
        }

        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const handleRemoveSelectedFile = () => {
        if (previewUrl && previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl);
        }
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTitle.trim() || !editArtist.trim()) return;
        try {
            setSavingEdit(true);
            let uploadedCoverKey: string | undefined = undefined;

            if (selectedFile) {
                setUploadStatus("Uploading artwork...");
                const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "jpg";
                const uploadRes = await adminService.getCoverArtUploadUrl({
                    songId: song.id,
                    extension: ext,
                    contentType: selectedFile.type || "image/jpeg",
                });
                await adminService.uploadCoverArtToPresignedUrl(
                    uploadRes.url,
                    selectedFile,
                    selectedFile.type,
                );
                uploadedCoverKey = uploadRes.key;
            }

            setUploadStatus("Saving metadata...");
            await onSave(
                song.id,
                editTitle.trim(),
                editArtist.trim(),
                editIsPublic,
                uploadedCoverKey,
            );
        } finally {
            setSavingEdit(false);
            setUploadStatus(null);
        }
    };

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
                    maxWidth: 460,
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
                        marginBottom: 18,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <Edit3 size={20} color="var(--app-green)" />
                    <span>Update Song Metadata</span>
                </h3>

                <form
                    onSubmit={handleSubmit}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                    }}
                >
                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--text-secondary)",
                                marginBottom: 6,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            Title
                        </label>
                        <input
                            type="text"
                            required
                            className="glass-input"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "12px 14px",
                                fontSize: 14,
                            }}
                        />
                    </div>

                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--text-secondary)",
                                marginBottom: 6,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            Artist
                        </label>
                        <input
                            type="text"
                            required
                            className="glass-input"
                            value={editArtist}
                            onChange={(e) => setEditArtist(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "12px 14px",
                                fontSize: 14,
                            }}
                        />
                    </div>

                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--text-secondary)",
                                marginBottom: 8,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            Visibility
                        </label>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 10,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setEditIsPublic(true)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    padding: "10px 14px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    border: editIsPublic
                                        ? "1px solid rgba(16, 185, 129, 0.5)"
                                        : "1px solid rgba(255, 255, 255, 0.08)",
                                    background: editIsPublic
                                        ? "rgba(16, 185, 129, 0.15)"
                                        : "rgba(255, 255, 255, 0.03)",
                                    color: editIsPublic
                                        ? "#34d399"
                                        : "var(--text-muted)",
                                }}
                            >
                                <Globe size={16} />
                                <span>Public</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setEditIsPublic(false)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    padding: "10px 14px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    border: !editIsPublic
                                        ? "1px solid rgba(245, 158, 11, 0.5)"
                                        : "1px solid rgba(255, 255, 255, 0.08)",
                                    background: !editIsPublic
                                        ? "rgba(245, 158, 11, 0.15)"
                                        : "rgba(255, 255, 255, 0.03)",
                                    color: !editIsPublic
                                        ? "#fbbf24"
                                        : "var(--text-muted)",
                                }}
                            >
                                <Lock size={16} />
                                <span>Private</span>
                            </button>
                        </div>
                    </div>

                    {/* Cover Art Section */}
                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--text-secondary)",
                                marginBottom: 8,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            Cover Art
                        </label>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                padding: 12,
                                borderRadius: "var(--radius-md)",
                                background: "rgba(255, 255, 255, 0.03)",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                            }}
                        >
                            <div
                                style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: "var(--radius-sm)",
                                    overflow: "hidden",
                                    backgroundColor: "rgba(255, 255, 255, 0.06)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    position: "relative",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                }}
                            >
                                {previewUrl || song.cover_art_url ? (
                                    <img
                                        src={previewUrl || song.cover_art_url || ""}
                                        alt="Cover Preview"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                        }}
                                    />
                                ) : (
                                    <Music size={24} color="var(--text-muted)" />
                                )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleFileChange}
                                    style={{ display: "none" }}
                                />
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{
                                            padding: "6px 12px",
                                            fontSize: 12,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                        }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload size={14} />
                                        <span>{selectedFile ? "Change Image" : "Upload Image"}</span>
                                    </button>

                                    {selectedFile && (
                                        <button
                                            type="button"
                                            className="btn-ghost"
                                            style={{
                                                padding: "6px 8px",
                                                color: "var(--text-muted)",
                                            }}
                                            onClick={handleRemoveSelectedFile}
                                            title="Cancel selected image"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: selectedFile ? "var(--app-green)" : "var(--text-muted)",
                                        marginTop: 4,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {selectedFile
                                        ? selectedFile.name
                                        : "JPG, PNG, WebP up to 5MB"}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 10,
                            marginTop: 10,
                        }}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={savingEdit}
                            className="btn-primary"
                        >
                            {savingEdit ? (
                                <Loader2
                                    size={16}
                                    className="animate-spin"
                                />
                            ) : null}
                            <span>{uploadStatus || "Save Metadata"}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
