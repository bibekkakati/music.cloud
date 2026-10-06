import React, { useState, useRef } from "react";
import { adminService } from "../../services/adminService";
import type { SongUploadResponse } from "../../types";
import { useToast } from "../../context/ToastContext";
import {
    Upload,
    FileAudio,
    CheckCircle2,
    Loader2,
    X,
    AlertCircle,
    Music2,
} from "lucide-react";

export interface UploadItem {
    id: string; // unique client id
    file: File;
    title: string;
    artist: string;
    trimStartSec: number;
    status:
        | "idle"
        | "preparing"
        | "uploading"
        | "processing"
        | "done"
        | "error";
    progress: number;
    error?: string;
}

interface AdminUploadPanelProps {
    onUploadSuccess?: () => void;
}

export const AdminUploadPanel: React.FC<AdminUploadPanelProps> = ({
    onUploadSuccess,
}) => {
    const { showToast } = useToast();

    const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
    const [isUploadingBatch, setIsUploadingBatch] = useState(false);
    const [globalTrimSec, setGlobalTrimSec] = useState<number>(0);
    const [globalArtist, setGlobalArtist] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Handle File Selection (Multiple)
    const handleFilesSelected = (filesList: FileList | null) => {
        if (!filesList || filesList.length === 0) return;

        const newItems: UploadItem[] = Array.from(filesList).map(
            (file, idx) => {
                const nameWithoutExt =
                    file.name.substring(0, file.name.lastIndexOf(".")) ||
                    file.name;

                // Attempt to parse "Artist - Title" if present in file name
                let parsedArtist = globalArtist.trim();
                let parsedTitle = nameWithoutExt.trim();
                if (nameWithoutExt.includes(" - ")) {
                    const parts = nameWithoutExt.split(" - ");
                    if (!parsedArtist) parsedArtist = parts[0].trim();
                    parsedTitle = parts.slice(1).join(" - ").trim();
                }

                return {
                    id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
                    file,
                    title: parsedTitle || nameWithoutExt,
                    artist: parsedArtist,
                    trimStartSec: globalTrimSec || 0,
                    status: "idle",
                    progress: 0,
                };
            },
        );

        setUploadQueue((prev) => [...prev, ...newItems]);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleUpdateItem = (id: string, updates: Partial<UploadItem>) => {
        setUploadQueue((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, ...updates } : item,
            ),
        );
    };

    const handleRemoveItem = (id: string) => {
        setUploadQueue((prev) => prev.filter((item) => item.id !== id));
    };

    const handleClearFinished = () => {
        setUploadQueue((prev) =>
            prev.filter(
                (item) => item.status !== "done" && item.status !== "error",
            ),
        );
    };

    // Parallel upload processor (concurrency: 2)
    const handleStartBatchUpload = async () => {
        const pendingItems = uploadQueue.filter(
            (item) => item.status === "idle" || item.status === "error",
        );

        if (pendingItems.length === 0) {
            showToast("Queue Empty", "info", "No pending files to upload.");
            return;
        }

        // Validate that all pending items have a title & artist
        const invalid = pendingItems.find(
            (item) => !item.title.trim() || !item.artist.trim(),
        );
        if (invalid) {
            showToast(
                "Missing Information",
                "error",
                `Please specify title and artist for "${invalid.file.name}".`,
            );
            return;
        }

        setIsUploadingBatch(true);

        const updateItemStatus = (
            id: string,
            status: UploadItem["status"],
            progress: number,
            error?: string,
        ) => {
            setUploadQueue((prev) =>
                prev.map((item) =>
                    item.id === id
                        ? {
                              ...item,
                              status,
                              progress,
                              ...(error !== undefined ? { error } : {}),
                          }
                        : item,
                ),
            );
        };

        const uploadSingleItem = async (item: UploadItem): Promise<boolean> => {
            const fileExt =
                item.file.name.split(".").pop()?.toLowerCase() || "mp3";
            const contentType = item.file.type || "audio/mpeg";

            try {
                // Step 1: Pre-signed URL
                updateItemStatus(item.id, "preparing", 15);
                const uploadData: SongUploadResponse =
                    await adminService.getUploadUrl({
                        extension: fileExt,
                        content_type: contentType,
                        title: item.title.trim(),
                        artist: item.artist.trim(),
                    });

                // Step 2: S3 Upload
                updateItemStatus(item.id, "uploading", 20);
                await adminService.uploadFileToPresignedUrl(
                    uploadData.url,
                    item.file,
                    (pct) => {
                        // Map progress from 20% to 90%
                        const mappedPct = Math.round(20 + pct * 0.7);
                        updateItemStatus(item.id, "uploading", mappedPct);
                    },
                );

                // Step 3: Trigger Audio Processing
                updateItemStatus(item.id, "processing", 95);
                await adminService.processSong({
                    song_id: uploadData.id,
                    trim_start_sec: Number(item.trimStartSec) || 0,
                });

                updateItemStatus(item.id, "done", 100);
                return true;
            } catch (err: unknown) {
                const msg =
                    (err as { response?: { data?: { detail?: string } } })
                        ?.response?.data?.detail ||
                    "Upload or processing failed";
                updateItemStatus(item.id, "error", 0, msg);
                return false;
            }
        };

        // Queue worker with strict concurrency = 2
        const pool = [...pendingItems];
        const CONCURRENCY_LIMIT = 2;
        let successCount = 0;

        const worker = async () => {
            while (pool.length > 0) {
                const nextItem = pool.shift();
                if (!nextItem) break;
                const ok = await uploadSingleItem(nextItem);
                if (ok) successCount++;
            }
        };

        const workers = Array.from(
            { length: Math.min(CONCURRENCY_LIMIT, pendingItems.length) },
            () => worker(),
        );

        await Promise.all(workers);
        setIsUploadingBatch(false);

        if (successCount > 0) {
            showToast(
                "Upload Batch Complete",
                "success",
                `Successfully uploaded & queued ${successCount} track(s).`,
            );
            onUploadSuccess?.();
        }
    };

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "minmax(340px, 460px) minmax(360px, 1fr)",
                gap: 28,
                alignItems: "start",
            }}
        >
            {/* LEFT COLUMN: UPLOAD CONTROLS & ADD SONGS */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                    background: "var(--app-card-bg)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "var(--radius-lg)",
                    padding: 24,
                }}
            >
                {/* Dropzone */}
                <div>
                    <input
                        ref={fileInputRef}
                        id="audio-file-input"
                        type="file"
                        multiple
                        accept="audio/*,.mp3,.wav,.aac,.flac,.ogg"
                        onChange={(e) => handleFilesSelected(e.target.files)}
                        style={{ display: "none" }}
                        disabled={isUploadingBatch}
                    />

                    <div
                        style={{
                            border: "none",
                            borderRadius: "var(--radius-md)",
                            padding: "32px 20px",
                            textAlign: "center",
                            background: "var(--app-elevated)",
                            cursor: isUploadingBatch
                                ? "not-allowed"
                                : "pointer",
                            transition: "all 0.2s ease",
                        }}
                        onClick={() => {
                            if (!isUploadingBatch) {
                                fileInputRef.current?.click();
                            }
                        }}
                        onMouseEnter={(e) => {
                            if (!isUploadingBatch) {
                                e.currentTarget.style.background = "#2a2a2a";
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isUploadingBatch) {
                                e.currentTarget.style.background =
                                    "var(--app-elevated)";
                            }
                        }}
                    >
                        <div
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                background: "rgba(30, 215, 96, 0.12)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 12px",
                            }}
                        >
                            <Upload size={22} color="var(--app-green)" />
                        </div>
                        <div
                            style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--app-text)",
                                marginBottom: 4,
                            }}
                        >
                            Select Audio Files (Multiple)
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--app-subtext)",
                                marginBottom: 12,
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
                                padding: "6px 16px",
                                fontSize: 12,
                                background: "rgba(255, 255, 255, 0.1)",
                                color: "#ffffff",
                            }}
                        >
                            Browse Files
                        </span>
                    </div>
                </div>

                {/* Batch Defaults */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                    }}
                >
                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--app-text)",
                                marginBottom: 6,
                            }}
                        >
                            Default Artist (optional)
                        </label>
                        <input
                            type="text"
                            disabled={isUploadingBatch}
                            placeholder="Auto-applies to new selected tracks"
                            value={globalArtist}
                            onChange={(e) => setGlobalArtist(e.target.value)}
                            style={{
                                width: "100%",
                                background: "var(--app-elevated)",
                                border: "none",
                                borderRadius: "var(--radius-sm)",
                                padding: "10px 12px",
                                fontSize: 13,
                                color: "var(--app-text)",
                                outline: "none",
                            }}
                        />
                    </div>

                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--app-text)",
                                marginBottom: 6,
                            }}
                        >
                            Default Silence Trim (seconds)
                        </label>
                        <input
                            type="number"
                            min={0}
                            step={0.1}
                            disabled={isUploadingBatch}
                            placeholder="0"
                            value={globalTrimSec || ""}
                            onChange={(e) =>
                                setGlobalTrimSec(Number(e.target.value))
                            }
                            style={{
                                width: "100%",
                                background: "var(--app-elevated)",
                                border: "none",
                                borderRadius: "var(--radius-sm)",
                                padding: "10px 12px",
                                fontSize: 13,
                                color: "var(--app-text)",
                                outline: "none",
                            }}
                        />
                    </div>
                </div>

                {/* Batch Summary & Trigger Button */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        marginTop: 4,
                    }}
                >
                    <button
                        type="button"
                        onClick={handleStartBatchUpload}
                        disabled={
                            isUploadingBatch ||
                            uploadQueue.filter(
                                (i) =>
                                    i.status === "idle" || i.status === "error",
                            ).length === 0
                        }
                        className="app-btn-green"
                        style={{
                            width: "100%",
                            padding: "14px 24px",
                            fontSize: 14,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            opacity:
                                isUploadingBatch ||
                                uploadQueue.filter(
                                    (i) =>
                                        i.status === "idle" ||
                                        i.status === "error",
                                ).length === 0
                                    ? 0.5
                                    : 1,
                            cursor:
                                isUploadingBatch ||
                                uploadQueue.filter(
                                    (i) =>
                                        i.status === "idle" ||
                                        i.status === "error",
                                ).length === 0
                                    ? "not-allowed"
                                    : "pointer",
                        }}
                    >
                        {isUploadingBatch ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Uploading Queue (2 in parallel)...</span>
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                <span>
                                    Upload{" "}
                                    {
                                        uploadQueue.filter(
                                            (i) =>
                                                i.status === "idle" ||
                                                i.status === "error",
                                        ).length
                                    }{" "}
                                    Pending Track(s)
                                </span>
                            </>
                        )}
                    </button>

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 12,
                            color: "var(--app-subtext)",
                        }}
                    >
                        {uploadQueue.some(
                            (i) => i.status === "done" || i.status === "error",
                        ) && (
                            <button
                                type="button"
                                onClick={handleClearFinished}
                                disabled={isUploadingBatch}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--app-subtext)",
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    fontSize: 12,
                                    padding: 0,
                                }}
                            >
                                Clear Completed
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: CLIENT-LEVEL UPLOAD STATUS LIST */}
            <div
                style={{
                    background: "var(--app-card-bg)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "var(--radius-lg)",
                    padding: 24,
                    minHeight: 460,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 16,
                        paddingBottom: 14,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Music2 size={18} color="var(--app-green)" />
                        <h3
                            style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: "var(--app-text)",
                                margin: 0,
                            }}
                        >
                            Client Upload Queue
                        </h3>
                        <span
                            style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: "rgba(255, 255, 255, 0.1)",
                                color: "var(--app-text)",
                                fontWeight: 600,
                            }}
                        >
                            {uploadQueue.length}
                        </span>
                    </div>

                    {uploadQueue.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                if (isUploadingBatch) {
                                    if (
                                        !window.confirm(
                                            "An upload is in progress. Clear pending items?",
                                        )
                                    )
                                        return;
                                }
                                setUploadQueue((prev) =>
                                    isUploadingBatch
                                        ? prev.filter(
                                              (i) => i.status !== "idle",
                                          )
                                        : [],
                                );
                            }}
                            style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Clear All
                        </button>
                    )}
                </div>

                {uploadQueue.length === 0 ? (
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "60px 20px",
                            textAlign: "center",
                            color: "var(--app-subtext)",
                        }}
                    >
                        <div
                            style={{
                                width: 52,
                                height: 52,
                                borderRadius: "50%",
                                background: "rgba(255, 255, 255, 0.04)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 14,
                            }}
                        >
                            <FileAudio size={24} color="var(--app-subtext)" />
                        </div>
                        <div
                            style={{
                                fontSize: 15,
                                fontWeight: 600,
                                color: "var(--app-text)",
                                marginBottom: 4,
                            }}
                        >
                            No files in queue
                        </div>
                        <div style={{ fontSize: 13, maxWidth: 280 }}>
                            Selected audio tracks will appear here with live
                            client upload & progress tracking.
                        </div>
                    </div>
                ) : (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            maxHeight: "680px",
                            overflowY: "auto",
                            paddingRight: 4,
                        }}
                    >
                        {uploadQueue.map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    background: "var(--app-elevated)",
                                    border: "none",
                                    borderRadius: "var(--radius-md)",
                                    padding: "14px 16px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                    transition: "all 0.2s ease",
                                }}
                            >
                                {/* Header Row: File Name, Size, Status Badge, Remove button */}
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            minWidth: 0,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: 6,
                                                background:
                                                    item.status === "done"
                                                        ? "rgba(30, 215, 96, 0.15)"
                                                        : item.status ===
                                                            "error"
                                                          ? "rgba(239, 68, 68, 0.15)"
                                                          : "rgba(255, 255, 255, 0.08)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {item.status === "done" ? (
                                                <CheckCircle2
                                                    size={18}
                                                    color="var(--app-green)"
                                                />
                                            ) : item.status === "error" ? (
                                                <AlertCircle
                                                    size={18}
                                                    color="#ef4444"
                                                />
                                            ) : item.status === "uploading" ||
                                              item.status === "preparing" ||
                                              item.status === "processing" ? (
                                                <Loader2
                                                    size={18}
                                                    className="animate-spin"
                                                    color="var(--primary)"
                                                />
                                            ) : (
                                                <FileAudio
                                                    size={18}
                                                    color="var(--app-subtext)"
                                                />
                                            )}
                                        </div>

                                        <div style={{ minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    color: "var(--app-text)",
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                                title={item.file.name}
                                            >
                                                {item.file.name}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--app-subtext)",
                                                }}
                                            >
                                                {(
                                                    item.file.size /
                                                    (1024 * 1024)
                                                ).toFixed(2)}{" "}
                                                MB
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {/* Status Tag */}
                                        <span
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                padding: "3px 8px",
                                                borderRadius: 999,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.04em",
                                                background:
                                                    item.status === "done"
                                                        ? "rgba(30, 215, 96, 0.15)"
                                                        : item.status ===
                                                            "error"
                                                          ? "rgba(239, 68, 68, 0.15)"
                                                          : item.status ===
                                                              "uploading"
                                                            ? "rgba(59, 130, 246, 0.15)"
                                                            : item.status ===
                                                                "processing"
                                                              ? "rgba(168, 85, 247, 0.15)"
                                                              : item.status ===
                                                                  "preparing"
                                                                ? "rgba(234, 179, 8, 0.15)"
                                                                : "rgba(255, 255, 255, 0.08)",
                                                color:
                                                    item.status === "done"
                                                        ? "var(--app-green)"
                                                        : item.status ===
                                                            "error"
                                                          ? "#ef4444"
                                                          : item.status ===
                                                              "uploading"
                                                            ? "#60a5fa"
                                                            : item.status ===
                                                                "processing"
                                                              ? "#c084fc"
                                                              : item.status ===
                                                                  "preparing"
                                                                ? "#eab308"
                                                                : "var(--app-subtext)",
                                            }}
                                        >
                                            {item.status === "preparing"
                                                ? "Signing URL"
                                                : item.status === "uploading"
                                                  ? `Uploading ${item.progress}%`
                                                  : item.status === "processing"
                                                    ? "Transcoding"
                                                    : item.status}
                                        </span>

                                        {/* Remove Button (when not actively uploading) */}
                                        {item.status !== "uploading" &&
                                            item.status !== "preparing" &&
                                            item.status !== "processing" && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleRemoveItem(
                                                            item.id,
                                                        )
                                                    }
                                                    style={{
                                                        background: "none",
                                                        border: "none",
                                                        color: "var(--app-subtext)",
                                                        cursor: "pointer",
                                                        padding: 4,
                                                        display: "flex",
                                                        alignItems: "center",
                                                    }}
                                                    title="Remove from queue"
                                                >
                                                    <X size={15} />
                                                </button>
                                            )}
                                    </div>
                                </div>

                                {/* Progress Bar (during active steps) */}
                                {(item.status === "preparing" ||
                                    item.status === "uploading" ||
                                    item.status === "processing") && (
                                    <div
                                        style={{
                                            height: 4,
                                            borderRadius: 999,
                                            background:
                                                "rgba(255, 255, 255, 0.08)",
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: "100%",
                                                background:
                                                    item.status === "processing"
                                                        ? "#a855f7"
                                                        : "var(--app-green)",
                                                width: `${item.progress}%`,
                                                transition: "width 0.2s ease",
                                                borderRadius: 999,
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Error message */}
                                {item.status === "error" && item.error && (
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: "#f87171",
                                            background:
                                                "rgba(239, 68, 68, 0.08)",
                                            padding: "6px 8px",
                                            borderRadius: 4,
                                        }}
                                    >
                                        {item.error}
                                    </div>
                                )}

                                {/* Metadata Editor (Title, Artist, Trim) - editable when idle */}
                                {item.status === "idle" && (
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns:
                                                "1.2fr 1fr 90px",
                                            gap: 8,
                                            marginTop: 2,
                                        }}
                                    >
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Track Title *"
                                                value={item.title}
                                                onChange={(e) =>
                                                    handleUpdateItem(item.id, {
                                                        title: e.target.value,
                                                    })
                                                }
                                                style={{
                                                    width: "100%",
                                                    background:
                                                        "rgba(0, 0, 0, 0.3)",
                                                    border: "none",
                                                    borderRadius: 4,
                                                    padding: "6px 8px",
                                                    fontSize: 12,
                                                    color: "var(--app-text)",
                                                    outline: "none",
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Artist *"
                                                value={item.artist}
                                                onChange={(e) =>
                                                    handleUpdateItem(item.id, {
                                                        artist: e.target.value,
                                                    })
                                                }
                                                style={{
                                                    width: "100%",
                                                    background:
                                                        "rgba(0, 0, 0, 0.3)",
                                                    border: "none",
                                                    borderRadius: 4,
                                                    padding: "6px 8px",
                                                    fontSize: 12,
                                                    color: "var(--app-text)",
                                                    outline: "none",
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.1}
                                                placeholder="Trim (s)"
                                                value={item.trimStartSec || ""}
                                                onChange={(e) =>
                                                    handleUpdateItem(item.id, {
                                                        trimStartSec:
                                                            Number(
                                                                e.target.value,
                                                            ) || 0,
                                                    })
                                                }
                                                title="Silence Trim in seconds"
                                                style={{
                                                    width: "100%",
                                                    background:
                                                        "rgba(0, 0, 0, 0.3)",
                                                    border: "none",
                                                    borderRadius: 4,
                                                    padding: "6px 8px",
                                                    fontSize: 12,
                                                    color: "var(--app-text)",
                                                    outline: "none",
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
