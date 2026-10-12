import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { playlistService } from "@music-cloud/services";
import type { CategoryMasterResponse } from "@music-cloud/types";
import { getCardColorByIndex } from "@music-cloud/utils";
import { Music, AlertCircle, RefreshCw } from "lucide-react";

export interface DisplayCategory {
    uniqueKey: string;
    id: string | number;
    title: string;
    color: string;
    section?: string;
}

// In-memory module-level session cache
let cachedMasterCategories: DisplayCategory[] | null = null;

export const SearchPage: React.FC = () => {
    const navigate = useNavigate();
    const [categories, setCategories] = useState<DisplayCategory[]>(
        () => cachedMasterCategories || [],
    );
    const [loading, setLoading] = useState<boolean>(!cachedMasterCategories);
    const [error, setError] = useState<string | null>(null);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            setError(null);
            const data: CategoryMasterResponse =
                await playlistService.getCategoryMaster();

            // Transform static, genres, moods, languages and assign vibrant colors cycling by index
            const items: DisplayCategory[] = [];
            let colorIdx = 0;

            // 1. Static categories displayed in front/top
            if (data.static && data.static.length > 0) {
                data.static.forEach((s) => {
                    items.push({
                        uniqueKey: `static-${s.id}`,
                        id: s.id,
                        title: s.label,
                        color: getCardColorByIndex(colorIdx++),
                        section: "Featured",
                    });
                });
            }

            // 2. Genres
            if (data.genres && data.genres.length > 0) {
                data.genres.forEach((g) => {
                    items.push({
                        uniqueKey: `genre-${g.id}`,
                        id: g.id,
                        title: g.label,
                        color: getCardColorByIndex(colorIdx++),
                        section: "Genres",
                    });
                });
            }

            // 3. Moods
            if (data.moods && data.moods.length > 0) {
                data.moods.forEach((m) => {
                    items.push({
                        uniqueKey: `mood-${m.id}`,
                        id: m.id,
                        title: m.label,
                        color: getCardColorByIndex(colorIdx++),
                        section: "Moods",
                    });
                });
            }

            // 4. Languages
            if (data.languages && data.languages.length > 0) {
                data.languages.forEach((l) => {
                    items.push({
                        uniqueKey: `lang-${l.id}`,
                        id: l.id,
                        title: l.label,
                        color: getCardColorByIndex(colorIdx++),
                        section: "Languages",
                    });
                });
            }

            cachedMasterCategories = items;
            setCategories(items);
        } catch (err: unknown) {
            console.error("Failed to load categories:", err);
            setError(
                "Could not load categories. Please check your network connection.",
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!cachedMasterCategories) {
            fetchCategories();
        }
    }, []);

    return (
        <div className="search-page-container">
            <div style={{ marginBottom: 16 }}>
                <h2
                    style={{
                        fontSize: 24,
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        color: "#ffffff",
                    }}
                >
                    Browse all
                </h2>
            </div>

            {loading && (
                <div className="search-categories-grid">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={`skeleton-${i}`}
                            style={{
                                height: 180,
                                borderRadius: 8,
                                backgroundColor: "#242424",
                                padding: 16,
                                animation: "pulse 1.5s infinite ease-in-out",
                            }}
                        />
                    ))}
                </div>
            )}

            {!loading && error && (
                <div
                    style={{
                        padding: 32,
                        textAlign: "center",
                        backgroundColor: "#181818",
                        borderRadius: 8,
                        color: "var(--app-subtext)",
                    }}
                >
                    <AlertCircle
                        size={40}
                        color="#e91429"
                        style={{ marginBottom: 12, display: "inline-block" }}
                    />
                    <p
                        style={{
                            color: "#fff",
                            fontWeight: 600,
                            marginBottom: 16,
                        }}
                    >
                        {error}
                    </p>
                    <button
                        onClick={fetchCategories}
                        className="app-btn-pill"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 20px",
                        }}
                    >
                        <RefreshCw size={16} />
                        Retry
                    </button>
                </div>
            )}

            {!loading && !error && (
                <div className="search-categories-grid">
                    {categories.map((cat) => (
                        <div
                            key={cat.uniqueKey}
                            onClick={() => {
                                navigate(
                                    `/search/${encodeURIComponent(cat.title)}`,
                                );
                            }}
                            style={{
                                height: 180,
                                borderRadius: 8,
                                backgroundColor: cat.color,
                                padding: 16,
                                position: "relative",
                                overflow: "hidden",
                                cursor: "pointer",
                                transition: "transform 0.15s ease",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.transform =
                                    "scale(1.02)")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.transform = "scale(1)")
                            }
                        >
                            <span
                                style={{
                                    fontSize: 20,
                                    fontWeight: 800,
                                    color: "#ffffff",
                                    lineHeight: 1.2,
                                }}
                            >
                                {cat.title}
                            </span>

                            <div
                                style={{
                                    position: "absolute",
                                    right: -10,
                                    bottom: -5,
                                    width: 80,
                                    height: 80,
                                    background: "rgba(0, 0, 0, 0.2)",
                                    borderRadius: 4,
                                    transform: "rotate(25deg)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                                }}
                            >
                                <Music size={36} color="#fff" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
