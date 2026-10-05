import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { adminService } from "../../services/adminService";
import type { SongDetail, SongUploadResponse } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { usePlayer } from "../../context/PlayerContext";
import {
    ShieldAlert,
    Upload,
    Radio,
    FileAudio,
    CheckCircle2,
    Edit3,
    Eye,
    RefreshCw,
    RotateCw,
    Loader2,
    X,
    Play,
    Layers,
    Globe,
    Lock,
} from "lucide-react";
import { SongCoverArt } from "../../components/SongCoverArt";

export const AdminPage: React.FC = () => {
    const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
    const { showToast } = useToast();
    const { playSong } = usePlayer();

    // Active Tab
    const [activeTab, setActiveTab] = useState<"upload" | "catalog">("upload");

    // --- Upload State ---
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [trimStartSec, setTrimStartSec] = useState<number>(0);
    const [uploadStep, setUploadStep] = useState<
        "idle" | "url" | "uploading" | "processing" | "done"
    >("idle");
    const [uploadProgress, setUploadProgress] = useState(0);

    // --- Catalog State ---
    const [songs, setSongs] = useState<SongDetail[]>([]);
    const [loadingSongs, setLoadingSongs] = useState(false);
    const [refreshingSongIds, setRefreshingSongIds] = useState<Set<string>>(
        new Set(),
    );

    // --- Inspector / Edit Modals ---
    const [inspectingSong, setInspectingSong] = useState<SongDetail | null>(
        null,
    );
    const [editingSong, setEditingSong] = useState<SongDetail | null>(null);
    const [reprocessingSongIds, setReprocessingSongIds] = useState<Set<string>>(new Set());
    const [editTitle, setEditTitle] = useState("");
    const [editArtist, setEditArtist] = useState("");
    const [editIsPublic, setEditIsPublic] = useState(true);
    const [savingEdit, setSavingEdit] = useState(false);
    const [togglingVisibilityIds, setTogglingVisibilityIds] = useState<
        Set<string>
    >(new Set());

    // Load Catalog
    const loadSongs = useCallback(async () => {
        try {
            setLoadingSongs(true);
            const data = await adminService.getAllSongs();
            setSongs(data);
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })
                    ?.response?.data?.detail || "Failed to load songs";
            showToast("Catalog Error", "error", msg);
        } finally {
            setLoadingSongs(false);
        }
    }, [showToast]);

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            loadSongs();
        }
    }, [isAuthenticated, isAdmin, loadSongs]);

    // Handle File Selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);

            // Auto populate title if blank
            if (!title) {
                const nameWithoutExt =
                    file.name.substring(0, file.name.lastIndexOf(".")) ||
                    file.name;
                setTitle(nameWithoutExt);
            }
        }
    };

    // Upload & Process Workflow
    const handleStartUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile || !title.trim() || !artist.trim()) {
            showToast(
                "Validation Error",
                "error",
                "Please fill title, artist and select an audio file.",
            );
            return;
        }

        const fileExt =
            selectedFile.name.split(".").pop()?.toLowerCase() || "mp3";
        const contentType = selectedFile.type || "audio/mpeg";

        try {
            // Step 1: Get presigned upload URL
            setUploadStep("url");
            showToast(
                "Step 1/3",
                "info",
                "Requesting pre-signed S3 upload URL...",
            );
            const uploadData: SongUploadResponse =
                await adminService.getUploadUrl({
                    extension: fileExt,
                    content_type: contentType,
                    title: title.trim(),
                    artist: artist.trim(),
                });

            // Step 2: Upload file direct to S3
            setUploadStep("uploading");
            setUploadProgress(0);
            showToast(
                "Step 2/3",
                "info",
                "Uploading audio file directly to storage...",
            );
            await adminService.uploadFileToPresignedUrl(
                uploadData.url,
                selectedFile,
                (pct) => {
                    setUploadProgress(pct);
                },
            );

            // Step 3: Trigger backend processing worker
            setUploadStep("processing");
            await adminService.processSong({
                song_id: uploadData.id,
                trim_start_sec: Number(trimStartSec) || 0,
            });

            showToast(
                "Song Queued",
                "success",
                `"${title.trim()}" uploaded and queued for processing.`,
            );
            handleResetUploadForm();
            setActiveTab("catalog");
            loadSongs();
        } catch (err: unknown) {
            setUploadStep("idle");
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Upload or processing failed";
            showToast("Upload Error", "error", msg);
        }
    };

    const handleRefreshSongStatus = async (songId: string) => {
        try {
            setRefreshingSongIds((prev) => new Set(prev).add(songId));
            const res = await adminService.getSongProcessStatus(songId);
            const updatedStatus = res.status;

            setSongs((prev) =>
                prev.map((s) =>
                    s.id === songId ? { ...s, status: updatedStatus } : s,
                ),
            );

            if (updatedStatus?.toUpperCase() === "DONE") {
                try {
                    const fullSong = await adminService.getSongById(songId);
                    setSongs((prev) =>
                        prev.map((s) => (s.id === songId ? fullSong : s)),
                    );
                } catch {
                    // ignore
                }
            }
        } catch (err: unknown) {
            console.error("Failed to refresh song status:", err);
        } finally {
            setRefreshingSongIds((prev) => {
                const next = new Set(prev);
                next.delete(songId);
                return next;
            });
        }
    };

    const handleReprocessSong = async (song: SongDetail) => {
        const confirmed = window.confirm(
            `Are you sure you want to reprocess "${song.title}"?\n\nThis will re-transcode and package all HLS renditions from the original master file.`
        );
        if (!confirmed) return;

        try {
            setReprocessingSongIds((prev) => new Set(prev).add(song.id));
            await adminService.processSong({
                song_id: song.id,
                trim_start_sec: 0,
            });

            // Optimistically update song status in the list
            setSongs((prev) =>
                prev.map((s) =>
                    s.id === song.id ? { ...s, status: "UPLOADED" } : s,
                ),
            );

            showToast(
                "Processing Triggered",
                "success",
                `Reprocessing queued for "${song.title}"`,
            );
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to trigger reprocessing";
            showToast("Reprocess Failed", "error", msg);
        } finally {
            setReprocessingSongIds((prev) => {
                const next = new Set(prev);
                next.delete(song.id);
                return next;
            });
        }
    };

    const handleResetUploadForm = () => {
        setTitle("");
        setArtist("");
        setSelectedFile(null);
        setTrimStartSec(0);
        setUploadStep("idle");
        setUploadProgress(0);
    };

    // Open Edit Modal
    const handleOpenEdit = (song: SongDetail) => {
        setEditingSong(song);
        setEditTitle(song.title);
        setEditArtist(song.artist);
        setEditIsPublic(song.is_public !== false);
    };

    // Save Metadata Edit
    const handleSaveMetadata = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSong || !editTitle.trim() || !editArtist.trim()) return;

        try {
            setSavingEdit(true);
            const updated = await adminService.updateSongMetadata({
                song_id: editingSong.id,
                title: editTitle.trim(),
                artist: editArtist.trim(),
                is_public: editIsPublic,
            });
            showToast(
                "Metadata Updated",
                "success",
                `Updated "${updated.title}"`,
            );
            setEditingSong(null);
            setSongs((prev) =>
                prev.map((s) =>
                    s.id === updated.id ? { ...s, ...updated } : s,
                ),
            );
            if (inspectingSong?.id === updated.id) {
                setInspectingSong((prev) =>
                    prev ? { ...prev, ...updated } : null,
                );
            }
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to update metadata";
            showToast("Error", "error", msg);
        } finally {
            setSavingEdit(false);
        }
    };

    // Toggle Song Visibility (Public / Private)
    const handleToggleVisibility = async (song: SongDetail) => {
        const nextIsPublic = song.is_public === false ? true : false;
        setTogglingVisibilityIds((prev) => new Set(prev).add(song.id));
        try {
            const updated = await adminService.updateSongVisibility(
                song.id,
                nextIsPublic,
            );
            setSongs((prev) =>
                prev.map((s) =>
                    s.id === song.id
                        ? { ...s, ...updated, is_public: updated.is_public }
                        : s,
                ),
            );
            if (inspectingSong?.id === song.id) {
                setInspectingSong((prev) =>
                    prev
                        ? { ...prev, ...updated, is_public: updated.is_public }
                        : null,
                );
            }
            showToast(
                nextIsPublic ? "Song is now Public" : "Song is now Private",
                "success",
                `"${song.title}" is ${
                    nextIsPublic
                        ? "visible to normal users"
                        : "hidden from normal users"
                }`,
            );
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to update song visibility";
            showToast("Error", "error", msg);
        } finally {
            setTogglingVisibilityIds((prev) => {
                const next = new Set(prev);
                next.delete(song.id);
                return next;
            });
        }
    };

    if (isLoading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "65vh",
                }}
            >
                <Loader2
                    size={36}
                    className="animate-spin"
                    color="var(--app-green)"
                />
            </div>
        );
    }

    // If user is not an administrator, do not render any actions or management components
    if (!isAuthenticated || !isAdmin) {
        return (
            <div
                className="animate-fade-in"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "65vh",
                    padding: "40px 24px",
                    textAlign: "center",
                }}
            >
                <div
                    style={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        backgroundColor: "rgba(239, 68, 68, 0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 20,
                        border: "1px solid rgba(239, 68, 68, 0.25)",
                    }}
                >
                    <ShieldAlert size={36} color="#ef4444" />
                </div>

                <h1
                    style={{
                        fontSize: 26,
                        fontWeight: 800,
                        color: "#ffffff",
                        marginBottom: 12,
                        letterSpacing: "-0.02em",
                    }}
                >
                    Admin Access Required
                </h1>

                <p
                    style={{
                        fontSize: 14,
                        color: "var(--app-subtext)",
                        maxWidth: 440,
                        lineHeight: 1.6,
                        marginBottom: 28,
                    }}
                >
                    {isAuthenticated
                        ? `Signed in as ${user?.email}. This section requires administrator privileges to access.`
                        : "This page requires administrator access. Please sign in with an administrator account to proceed."}
                </p>

                <Link
                    to="/"
                    className="app-btn-pill"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        textDecoration: "none",
                        padding: "12px 28px",
                    }}
                >
                    Back to Home
                </Link>
            </div>
        );
    }

    return (
        <div className="admin-page-container">
            {/* Header */}
            <div className="admin-header-row">
                <div>
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: "var(--app-green)",
                            letterSpacing: "0.06em",
                            marginBottom: 4,
                        }}
                    >
                        <Radio size={14} color="var(--app-green)" />
                        <span>Admin Console</span>
                    </div>
                    <h1
                        style={{
                            fontSize: 28,
                            fontWeight: 800,
                            color: "var(--app-text)",
                        }}
                    >
                        Song Management & Ingestion
                    </h1>
                </div>

                {/* Tab Switcher & Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {activeTab === "catalog" && (
                        <button
                            type="button"
                            onClick={() => loadSongs()}
                            disabled={loadingSongs}
                            className="app-tag-pill"
                            style={{
                                padding: "8px 16px",
                                fontSize: 13,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                background: "rgba(255, 255, 255, 0.08)",
                                color: "var(--app-text)",
                            }}
                            title="Refresh Catalog"
                        >
                            <RefreshCw
                                size={14}
                                className={loadingSongs ? "animate-spin" : ""}
                            />
                            <span>Refresh</span>
                        </button>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => setActiveTab("upload")}
                            className={`app-tag-pill ${activeTab === "upload" ? "active" : ""}`}
                            style={{
                                padding: "8px 18px",
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <Upload size={15} />
                            <span>Upload Track</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("catalog")}
                            className={`app-tag-pill ${activeTab === "catalog" ? "active" : ""}`}
                            style={{
                                padding: "8px 18px",
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <Layers size={15} />
                            <span>Catalog ({songs.length})</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* --- TAB 1: UPLOAD & PROCESS --- */}
            {activeTab === "upload" && (
                <div className="animate-fade-in" style={{ maxWidth: 720 }}>
                    <form
                        onSubmit={handleStartUpload}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 22,
                        }}
                    >
                        {/* Audio Master File Dropzone */}
                        <div>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "var(--app-text)",
                                    marginBottom: 8,
                                }}
                            >
                                Audio Master File{" "}
                                <span style={{ color: "var(--app-green)" }}>
                                    *
                                </span>
                            </label>

                            <input
                                id="audio-file-input"
                                type="file"
                                accept="audio/*,.mp3,.wav,.aac,.flac,.ogg"
                                onChange={handleFileChange}
                                style={{ display: "none" }}
                                disabled={uploadStep !== "idle"}
                            />

                            {!selectedFile ? (
                                <div
                                    style={{
                                        border: "1.5px dashed rgba(255, 255, 255, 0.2)",
                                        borderRadius: "var(--radius-md)",
                                        padding: "36px 24px",
                                        textAlign: "center",
                                        background: "var(--app-elevated)",
                                        cursor:
                                            uploadStep === "idle"
                                                ? "pointer"
                                                : "default",
                                        transition: "all 0.2s ease",
                                    }}
                                    onClick={() => {
                                        if (uploadStep === "idle") {
                                            document
                                                .getElementById(
                                                    "audio-file-input",
                                                )
                                                ?.click();
                                        }
                                    }}
                                    onMouseEnter={(e) => {
                                        if (uploadStep === "idle") {
                                            e.currentTarget.style.borderColor =
                                                "var(--app-green)";
                                            e.currentTarget.style.background =
                                                "#2a2a2a";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (uploadStep === "idle") {
                                            e.currentTarget.style.borderColor =
                                                "rgba(255, 255, 255, 0.2)";
                                            e.currentTarget.style.background =
                                                "var(--app-elevated)";
                                        }
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 52,
                                            height: 52,
                                            borderRadius: "50%",
                                            background:
                                                "rgba(30, 215, 96, 0.12)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            margin: "0 auto 14px",
                                        }}
                                    >
                                        <Upload
                                            size={24}
                                            color="var(--app-green)"
                                        />
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 700,
                                            color: "var(--app-text)",
                                            marginBottom: 4,
                                        }}
                                    >
                                        Choose an audio file or drag it here
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            color: "var(--app-subtext)",
                                            marginBottom: 14,
                                        }}
                                    >
                                        MP3, WAV, AAC, FLAC, or OGG up to 200MB
                                    </div>
                                    <span
                                        className="app-tag-pill"
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 6,
                                            padding: "8px 18px",
                                            fontSize: 13,
                                            background:
                                                "rgba(255, 255, 255, 0.1)",
                                            color: "#ffffff",
                                        }}
                                    >
                                        Browse Files
                                    </span>
                                </div>
                            ) : (
                                <div
                                    style={{
                                        background: "var(--app-elevated)",
                                        border: "1px solid rgba(255, 255, 255, 0.12)",
                                        borderRadius: "var(--radius-md)",
                                        padding: "16px 20px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 16,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 14,
                                            minWidth: 0,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 6,
                                                background:
                                                    "rgba(30, 215, 96, 0.15)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <FileAudio
                                                size={22}
                                                color="var(--app-green)"
                                            />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontWeight: 700,
                                                    fontSize: 14,
                                                    color: "var(--app-text)",
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                            >
                                                {selectedFile.name}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: "var(--app-subtext)",
                                                    marginTop: 2,
                                                }}
                                            >
                                                {(
                                                    selectedFile.size /
                                                    (1024 * 1024)
                                                ).toFixed(2)}{" "}
                                                MB •{" "}
                                                {selectedFile.type ||
                                                    "audio file"}
                                            </div>
                                        </div>
                                    </div>

                                    {uploadStep === "idle" && (
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                flexShrink: 0,
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    document
                                                        .getElementById(
                                                            "audio-file-input",
                                                        )
                                                        ?.click()
                                                }
                                                className="app-tag-pill"
                                                style={{
                                                    padding: "6px 14px",
                                                    fontSize: 12,
                                                    background:
                                                        "rgba(255, 255, 255, 0.1)",
                                                    color: "#ffffff",
                                                }}
                                            >
                                                Change
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedFile(null)
                                                }
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    color: "var(--app-subtext)",
                                                    cursor: "pointer",
                                                    padding: 4,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                                title="Remove file"
                                                onMouseEnter={(e) =>
                                                    (e.currentTarget.style.color =
                                                        "#ffffff")
                                                }
                                                onMouseLeave={(e) =>
                                                    (e.currentTarget.style.color =
                                                        "var(--app-subtext)")
                                                }
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Title and Artist */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 16,
                            }}
                        >
                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: "var(--app-text)",
                                        marginBottom: 8,
                                    }}
                                >
                                    Track Title{" "}
                                    <span style={{ color: "var(--app-green)" }}>
                                        *
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    disabled={uploadStep !== "idle"}
                                    placeholder="e.g. Midnight City"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    style={{
                                        width: "100%",
                                        background: "var(--app-elevated)",
                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                        borderRadius: "var(--radius-sm)",
                                        padding: "12px 14px",
                                        fontSize: 14,
                                        color: "var(--app-text)",
                                        outline: "none",
                                        transition: "border-color 0.2s ease",
                                    }}
                                    onFocus={(e) =>
                                        (e.currentTarget.style.borderColor =
                                            "#ffffff")
                                    }
                                    onBlur={(e) =>
                                        (e.currentTarget.style.borderColor =
                                            "rgba(255, 255, 255, 0.1)")
                                    }
                                />
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: "var(--app-text)",
                                        marginBottom: 8,
                                    }}
                                >
                                    Artist Name{" "}
                                    <span style={{ color: "var(--app-green)" }}>
                                        *
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    disabled={uploadStep !== "idle"}
                                    placeholder="e.g. M83"
                                    value={artist}
                                    onChange={(e) => setArtist(e.target.value)}
                                    style={{
                                        width: "100%",
                                        background: "var(--app-elevated)",
                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                        borderRadius: "var(--radius-sm)",
                                        padding: "12px 14px",
                                        fontSize: 14,
                                        color: "var(--app-text)",
                                        outline: "none",
                                        transition: "border-color 0.2s ease",
                                    }}
                                    onFocus={(e) =>
                                        (e.currentTarget.style.borderColor =
                                            "#ffffff")
                                    }
                                    onBlur={(e) =>
                                        (e.currentTarget.style.borderColor =
                                            "rgba(255, 255, 255, 0.1)")
                                    }
                                />
                            </div>
                        </div>

                        {/* Trim Start Sec */}
                        <div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginBottom: 8,
                                }}
                            >
                                <label
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: "var(--app-text)",
                                    }}
                                >
                                    Trim Start Offset
                                </label>
                                <span
                                    style={{
                                        fontSize: 12,
                                        color: "var(--app-subtext)",
                                    }}
                                >
                                    Optional silence trimmer
                                </span>
                            </div>
                            <div style={{ position: "relative" }}>
                                <input
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    disabled={uploadStep !== "idle"}
                                    placeholder="0.0"
                                    value={trimStartSec || ""}
                                    onChange={(e) =>
                                        setTrimStartSec(Number(e.target.value))
                                    }
                                    style={{
                                        width: "100%",
                                        background: "var(--app-elevated)",
                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                        borderRadius: "var(--radius-sm)",
                                        padding: "12px 42px 12px 14px",
                                        fontSize: 14,
                                        color: "var(--app-text)",
                                        outline: "none",
                                        transition: "border-color 0.2s ease",
                                    }}
                                    onFocus={(e) =>
                                        (e.currentTarget.style.borderColor =
                                            "#ffffff")
                                    }
                                    onBlur={(e) =>
                                        (e.currentTarget.style.borderColor =
                                            "rgba(255, 255, 255, 0.1)")
                                    }
                                />
                                <span
                                    style={{
                                        position: "absolute",
                                        right: 14,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        fontSize: 13,
                                        color: "var(--app-subtext)",
                                        pointerEvents: "none",
                                    }}
                                >
                                    sec
                                </span>
                            </div>
                            <span
                                style={{
                                    fontSize: 12,
                                    color: "var(--app-subtext)",
                                    marginTop: 6,
                                    display: "block",
                                }}
                            >
                                Skips silence at the beginning of the audio
                                track (default: 0s).
                            </span>
                        </div>

                        {/* Progress indicator during upload */}
                        {(uploadStep === "url" ||
                            uploadStep === "uploading" ||
                            uploadStep === "processing") && (
                            <div
                                style={{
                                    padding: 16,
                                    borderRadius: "var(--radius-md)",
                                    background: "var(--app-elevated)",
                                    border: "1px solid rgba(255, 255, 255, 0.08)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        fontSize: 13,
                                        marginBottom: 10,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontWeight: 600,
                                            color: "var(--app-text)",
                                        }}
                                    >
                                        {uploadStep === "url" &&
                                            "Preparing storage upload ticket..."}
                                        {uploadStep === "uploading" &&
                                            `Uploading to storage (${uploadProgress}%)...`}
                                        {uploadStep === "processing" &&
                                            "Dispatching processing queue..."}
                                    </span>
                                    <Loader2
                                        size={16}
                                        className="animate-spin"
                                        color="var(--app-green)"
                                    />
                                </div>

                                <div
                                    style={{
                                        height: 6,
                                        borderRadius: 999,
                                        background: "var(--app-slider-bg)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            height: "100%",
                                            background: "var(--app-green)",
                                            width: `${uploadStep === "url" ? 15 : uploadStep === "uploading" ? uploadProgress : 100}%`,
                                            transition: "width 0.3s ease",
                                            borderRadius: 999,
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-start",
                                marginTop: 4,
                            }}
                        >
                            <button
                                type="submit"
                                disabled={
                                    uploadStep !== "idle" ||
                                    !selectedFile ||
                                    !title.trim() ||
                                    !artist.trim()
                                }
                                className="app-btn-green"
                                style={{
                                    padding: "14px 32px",
                                    fontSize: 14,
                                    opacity:
                                        uploadStep !== "idle" ||
                                        !selectedFile ||
                                        !title.trim() ||
                                        !artist.trim()
                                            ? 0.5
                                            : 1,
                                    cursor:
                                        uploadStep !== "idle" ||
                                        !selectedFile ||
                                        !title.trim() ||
                                        !artist.trim()
                                            ? "not-allowed"
                                            : "pointer",
                                }}
                            >
                                {uploadStep !== "idle" ? (
                                    <>
                                        <Loader2
                                            size={18}
                                            className="animate-spin"
                                        />
                                        <span>Uploading Track...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={18} />
                                        <span>Upload & Queue</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* --- TAB 2: CATALOG MANAGEMENT --- */}
            {activeTab === "catalog" && (
                <div className="animate-fade-in">
                    {loadingSongs && songs.length === 0 ? (
                        <div style={{ padding: "80px 0", textAlign: "center" }}>
                            <Loader2
                                size={36}
                                className="animate-spin"
                                color="var(--app-green)"
                                style={{ margin: "0 auto 12px" }}
                            />
                            <span
                                style={{
                                    fontSize: 14,
                                    color: "var(--app-subtext)",
                                }}
                            >
                                Loading catalog tracks...
                            </span>
                        </div>
                    ) : songs.length === 0 ? (
                        <div
                            style={{
                                padding: "80px 0",
                                textAlign: "center",
                                color: "var(--app-subtext)",
                            }}
                        >
                            <p
                                style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: "var(--app-text)",
                                    marginBottom: 6,
                                }}
                            >
                                No songs in the catalog
                            </p>
                            <p style={{ fontSize: 14, marginBottom: 20 }}>
                                Upload your first track to get started.
                            </p>
                            <button
                                type="button"
                                onClick={() => setActiveTab("upload")}
                                className="app-btn-green"
                                style={{ padding: "12px 28px", fontSize: 14 }}
                            >
                                <Upload size={16} />
                                <span>Upload Track</span>
                            </button>
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table
                                style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    textAlign: "left",
                                    fontSize: 13,
                                }}
                            >
                                <thead>
                                    <tr
                                        style={{
                                            borderBottom:
                                                "1px solid rgba(255, 255, 255, 0.1)",
                                            color: "var(--app-subtext)",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                        }}
                                    >
                                        <th style={{ padding: "10px 14px" }}>
                                            Track
                                        </th>
                                        <th style={{ padding: "10px 14px" }}>
                                            Duration
                                        </th>
                                        <th style={{ padding: "10px 14px" }}>
                                            Bitrate
                                        </th>
                                        <th style={{ padding: "10px 14px" }}>
                                            Keys
                                        </th>
                                        <th style={{ padding: "10px 14px" }}>
                                            Status
                                        </th>
                                        <th style={{ padding: "10px 14px" }}>
                                            Visibility
                                        </th>
                                        <th style={{ padding: "10px 14px" }}>
                                            Created
                                        </th>
                                        <th
                                            style={{
                                                padding: "10px 14px",
                                                textAlign: "right",
                                            }}
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {songs.map((song) => {
                                        const isPrivateAndDone =
                                            song.is_public === false &&
                                            song.status?.toLowerCase() === "done";
                                        return (
                                            <tr
                                                key={song.id}
                                                style={{
                                                    borderBottom:
                                                        "1px solid rgba(255, 255, 255, 0.04)",
                                                    transition:
                                                        "all 0.15s ease",
                                                    opacity: isPrivateAndDone
                                                        ? 0.5
                                                        : 1,
                                                    filter: isPrivateAndDone
                                                        ? "grayscale(0.35)"
                                                        : "none",
                                                    background: isPrivateAndDone
                                                        ? "rgba(0, 0, 0, 0.25)"
                                                        : "transparent",
                                                }}
                                                onMouseEnter={(e) =>
                                                    (e.currentTarget.style.background =
                                                        isPrivateAndDone
                                                            ? "rgba(255, 255, 255, 0.06)"
                                                            : "rgba(255, 255, 255, 0.03)")
                                                }
                                                onMouseLeave={(e) =>
                                                    (e.currentTarget.style.background =
                                                        isPrivateAndDone
                                                            ? "rgba(0, 0, 0, 0.25)"
                                                            : "transparent")
                                                }
                                            >
                                                {/* Track info */}
                                                <td
                                                    style={{
                                                        padding: "12px 14px",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 12,
                                                        }}
                                                    >
                                                        <SongCoverArt
                                                            src={
                                                                song.cover_art_url
                                                            }
                                                            alt={song.title}
                                                            size={36}
                                                            borderRadius={6}
                                                            iconSize={18}
                                                        />
                                                        <div>
                                                            <div
                                                                style={{
                                                                    fontWeight: 600,
                                                                    color: "var(--text-main)",
                                                                }}
                                                            >
                                                                {song.title}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    fontSize: 12,
                                                                    color: "var(--text-secondary)",
                                                                }}
                                                            >
                                                                {song.artist}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Duration */}
                                                <td
                                                    style={{
                                                        padding: "12px 14px",
                                                        color: "var(--text-secondary)",
                                                    }}
                                                >
                                                    {song.duration_sec
                                                        ? `${Math.floor(song.duration_sec / 60)}:${String(Math.floor(song.duration_sec % 60)).padStart(2, "0")}`
                                                        : "N/A"}
                                                </td>

                                                {/* Bitrate */}
                                                <td
                                                    style={{
                                                        padding: "12px 14px",
                                                        color: "var(--text-secondary)",
                                                    }}
                                                >
                                                    {song.source_bitrate_kbps
                                                        ? `${song.source_bitrate_kbps} kbps`
                                                        : "Auto"}
                                                </td>

                                                {/* Keys Badge */}
                                                <td
                                                    style={{
                                                        padding: "12px 14px",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            padding: "3px 8px",
                                                            borderRadius: 999,
                                                            background:
                                                                "rgba(99, 102, 241, 0.15)",
                                                            color: "var(--primary)",
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        MP3 / AAC
                                                    </span>
                                                </td>

                                                {/* Status & Refresh */}
                                                <td
                                                    style={{
                                                        padding: "12px 14px",
                                                    }}
                                                >
                                                    {song.status?.toUpperCase() ===
                                                    "DONE" ? (
                                                        <span
                                                            style={{
                                                                fontSize: 11,
                                                                padding:
                                                                    "3px 8px",
                                                                borderRadius: 999,
                                                                background:
                                                                    "rgba(30, 215, 96, 0.15)",
                                                                color: "#1ed760",
                                                                fontWeight: 600,
                                                                display:
                                                                    "inline-flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: 4,
                                                            }}
                                                        >
                                                            <CheckCircle2
                                                                size={12}
                                                            />
                                                            DONE
                                                        </span>
                                                    ) : (
                                                        <div
                                                            style={{
                                                                display:
                                                                    "inline-flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: 6,
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    fontSize: 11,
                                                                    padding:
                                                                        "3px 8px",
                                                                    borderRadius: 999,
                                                                    background:
                                                                        song.status?.toUpperCase() ===
                                                                        "FAILED"
                                                                            ? "rgba(239, 68, 68, 0.15)"
                                                                            : "rgba(234, 179, 8, 0.15)",
                                                                    color:
                                                                        song.status?.toUpperCase() ===
                                                                        "FAILED"
                                                                            ? "#ef4444"
                                                                            : "#eab308",
                                                                    fontWeight: 600,
                                                                    textTransform:
                                                                        "uppercase",
                                                                }}
                                                            >
                                                                {song.status ||
                                                                    "QUEUED"}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleRefreshSongStatus(
                                                                        song.id,
                                                                    )
                                                                }
                                                                disabled={refreshingSongIds.has(
                                                                    song.id,
                                                                )}
                                                                title="Fetch updated status"
                                                                style={{
                                                                    background:
                                                                        "rgba(255, 255, 255, 0.06)",
                                                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                                                    borderRadius:
                                                                        "50%",
                                                                    width: 24,
                                                                    height: 24,
                                                                    display:
                                                                        "inline-flex",
                                                                    alignItems:
                                                                        "center",
                                                                    justifyContent:
                                                                        "center",
                                                                    cursor: refreshingSongIds.has(
                                                                        song.id,
                                                                    )
                                                                        ? "not-allowed"
                                                                        : "pointer",
                                                                    color: "var(--text-main)",
                                                                    transition:
                                                                        "all 0.2s ease",
                                                                    padding: 0,
                                                                }}
                                                                onMouseEnter={(
                                                                    e,
                                                                ) =>
                                                                    (e.currentTarget.style.background =
                                                                        "rgba(255, 255, 255, 0.15)")
                                                                }
                                                                onMouseLeave={(
                                                                    e,
                                                                ) =>
                                                                    (e.currentTarget.style.background =
                                                                        "rgba(255, 255, 255, 0.06)")
                                                                }
                                                            >
                                                                <RefreshCw
                                                                    size={12}
                                                                    className={
                                                                        refreshingSongIds.has(
                                                                            song.id,
                                                                        )
                                                                            ? "animate-spin"
                                                                            : ""
                                                                    }
                                                                />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Visibility */}
                                                <td
                                                    style={{
                                                        padding: "12px 14px",
                                                    }}
                                                >
                                                    {song.is_public !== false ? (
                                                        <span
                                                            style={{
                                                                fontSize: 11,
                                                                padding:
                                                                    "3px 8px",
                                                                borderRadius: 999,
                                                                background:
                                                                    "rgba(30, 215, 96, 0.15)",
                                                                color: "var(--app-green)",
                                                                fontWeight: 600,
                                                                display:
                                                                    "inline-flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: 4,
                                                            }}
                                                        >
                                                            <Globe size={11} />
                                                            PUBLIC
                                                        </span>
                                                    ) : (
                                                        <span
                                                            style={{
                                                                fontSize: 11,
                                                                padding:
                                                                    "3px 8px",
                                                                borderRadius: 999,
                                                                background:
                                                                    "rgba(245, 158, 11, 0.15)",
                                                                color: "#f59e0b",
                                                                fontWeight: 600,
                                                                display:
                                                                    "inline-flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: 4,
                                                            }}
                                                        >
                                                            <Lock size={11} />
                                                            PRIVATE
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Created */}
                                                <td
                                                    style={{
                                                        padding: "12px 14px",
                                                        color: "var(--text-muted)",
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {new Date(
                                                        song.created_at,
                                                    ).toLocaleDateString()}
                                                </td>

                                                {/* Actions */}
                                                <td
                                                    style={{
                                                        padding: "12px 14px",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display:
                                                                "inline-flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 6,
                                                        }}
                                                    >
                                                        {/* Toggle Visibility */}
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleToggleVisibility(
                                                                    song,
                                                                )
                                                            }
                                                            disabled={togglingVisibilityIds.has(
                                                                song.id,
                                                            )}
                                                            className="btn-ghost"
                                                            title={
                                                                song.is_public !==
                                                                false
                                                                    ? "Mark as Private (hide from normal users)"
                                                                    : "Mark as Public (visible to all users)"
                                                            }
                                                            style={{
                                                                padding: 6,
                                                                color:
                                                                    song.is_public !==
                                                                    false
                                                                        ? "var(--app-green)"
                                                                        : "#f59e0b",
                                                            }}
                                                        >
                                                            {togglingVisibilityIds.has(
                                                                song.id,
                                                            ) ? (
                                                                <Loader2
                                                                    size={15}
                                                                    className="animate-spin"
                                                                />
                                                            ) : song.is_public !==
                                                              false ? (
                                                                <Globe
                                                                    size={15}
                                                                />
                                                            ) : (
                                                                <Lock
                                                                    size={15}
                                                                />
                                                            )}
                                                        </button>

                                                        <button
                                                            onClick={() =>
                                                                playSong(
                                                                    song,
                                                                    songs,
                                                                )
                                                            }
                                                            className="btn-ghost"
                                                            title="Play Preview"
                                                            style={{
                                                                padding: 6,
                                                            }}
                                                        >
                                                            <Play
                                                                size={15}
                                                                color="var(--accent-cyan)"
                                                            />
                                                        </button>

                                                        <button
                                                            onClick={() =>
                                                                setInspectingSong(
                                                                    song,
                                                                )
                                                            }
                                                            className="btn-ghost"
                                                            title="Inspect Object Keys"
                                                            style={{
                                                                padding: 6,
                                                            }}
                                                        >
                                                            <Eye size={15} />
                                                        </button>

                                                        <button
                                                            onClick={() =>
                                                                handleOpenEdit(
                                                                    song,
                                                                )
                                                            }
                                                            className="btn-ghost"
                                                            title="Edit Metadata"
                                                            style={{
                                                                padding: 6,
                                                                color: "var(--app-subtext)",
                                                            }}
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>

                                                        <button
                                                            onClick={() =>
                                                                handleReprocessSong(
                                                                    song,
                                                                )
                                                            }
                                                            disabled={reprocessingSongIds.has(
                                                                song.id,
                                                            )}
                                                            className="btn-ghost"
                                                            title="Reprocess Audio (Transcode & Segment)"
                                                            style={{
                                                                padding: 6,
                                                                color: "var(--primary)",
                                                            }}
                                                        >
                                                            {reprocessingSongIds.has(
                                                                song.id,
                                                            ) ? (
                                                                <Loader2
                                                                    size={15}
                                                                    className="animate-spin"
                                                                />
                                                            ) : (
                                                                <RotateCw size={15} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* --- MODAL 1: INSPECTOR MODAL --- */}
            {inspectingSong && (
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
                    onClick={() => setInspectingSong(null)}
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
                            onClick={() => setInspectingSong(null)}
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
                                    {inspectingSong.id}
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
                                            inspectingSong.status?.toUpperCase() ===
                                            "DONE"
                                                ? "#1ed760"
                                                : "#eab308",
                                    }}
                                >
                                    {inspectingSong.status?.toUpperCase() ||
                                        "UNKNOWN"}
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
                                <code>
                                    {inspectingSong.original_key || "N/A"}
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
                                    Transcoded MP3 Key
                                </span>
                                <code>
                                    {inspectingSong.master_mp3_key || "N/A"}
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
                                    Transcoded AAC Key
                                </span>
                                <code>
                                    {inspectingSong.master_aac_key || "N/A"}
                                </code>
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
                                    <span>
                                        {inspectingSong.duration_sec} seconds
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
                                        Bitrate
                                    </span>
                                    <span>
                                        {inspectingSong.source_bitrate_kbps}{" "}
                                        kbps
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 20, textAlign: "right" }}>
                            <button
                                onClick={() => setInspectingSong(null)}
                                className="btn-secondary"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL 2: EDIT METADATA MODAL --- */}
            {editingSong && (
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
                    onClick={() => setEditingSong(null)}
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
                            onClick={() => setEditingSong(null)}
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
                            onSubmit={handleSaveMetadata}
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
                                    onChange={(e) =>
                                        setEditTitle(e.target.value)
                                    }
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
                                    onChange={(e) =>
                                        setEditArtist(e.target.value)
                                    }
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
                                    onClick={() => setEditingSong(null)}
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
                                    Save Metadata
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
