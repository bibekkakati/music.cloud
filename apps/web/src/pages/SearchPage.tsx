import { useNavigate } from "react-router-dom";
import { BROWSE_CATEGORIES } from "@music-cloud/utils";
import { Music } from "lucide-react";

export const SearchPage: React.FC = () => {
    const navigate = useNavigate();

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
            <div className="search-categories-grid">
                {BROWSE_CATEGORIES.map((cat) => (
                    <div
                        key={cat.id}
                        onClick={() => {
                            navigate(`/search/${cat.id}`);
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
                            (e.currentTarget.style.transform = "scale(1.02)")
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
                            {cat.name}
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
        </div>
    );
};
