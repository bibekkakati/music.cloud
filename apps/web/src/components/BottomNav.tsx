import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Search, Library } from "lucide-react";

interface BottomNavProps {
    onToggleLibrary: () => void;
    isLibraryOpen: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
    onToggleLibrary,
    isLibraryOpen,
}) => {
    const location = useLocation();

    return (
        <nav
            className="mobile-bottom-nav"
            style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                height: "var(--bottom-nav-height, 58px)",
                backgroundColor: "rgba(0, 0, 0, 0.95)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "none", // Shown via CSS @media (max-width: 768px)
                alignItems: "center",
                justifyContent: "space-around",
                zIndex: 60,
                padding: "0 8px",
            }}
        >
            {/* 1. Home */}
            <NavLink
                to="/"
                style={({ isActive }) => ({
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    color:
                        isActive && !isLibraryOpen
                            ? "#ffffff"
                            : "var(--app-subtext)",
                    textDecoration: "none",
                    fontSize: 11,
                    fontWeight: isActive && !isLibraryOpen ? 700 : 500,
                    flex: 1,
                    height: "100%",
                    transition: "color 0.15s ease",
                })}
            >
                {({ isActive }) => (
                    <>
                        <Home
                            size={22}
                            strokeWidth={isActive && !isLibraryOpen ? 2.6 : 2}
                        />
                        <span>Home</span>
                    </>
                )}
            </NavLink>

            {/* 2. Search */}
            <NavLink
                to="/search"
                style={({ isActive }) => ({
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    color:
                        isActive && !isLibraryOpen
                            ? "#ffffff"
                            : "var(--app-subtext)",
                    textDecoration: "none",
                    fontSize: 11,
                    fontWeight: isActive && !isLibraryOpen ? 700 : 500,
                    flex: 1,
                    height: "100%",
                    transition: "color 0.15s ease",
                })}
            >
                {({ isActive }) => (
                    <>
                        <Search
                            size={22}
                            strokeWidth={isActive && !isLibraryOpen ? 2.6 : 2}
                        />
                        <span>Search</span>
                    </>
                )}
            </NavLink>

            {/* 3. Your Library */}
            <button
                onClick={onToggleLibrary}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    color:
                        isLibraryOpen ||
                        location.pathname.startsWith("/playlist")
                            ? "#ffffff"
                            : "var(--app-subtext)",
                    background: "transparent",
                    border: "none",
                    fontSize: 11,
                    fontWeight:
                        isLibraryOpen ||
                        location.pathname.startsWith("/playlist")
                            ? 700
                            : 500,
                    flex: 1,
                    height: "100%",
                    cursor: "pointer",
                    transition: "color 0.15s ease",
                }}
            >
                <Library
                    size={22}
                    strokeWidth={
                        isLibraryOpen ||
                        location.pathname.startsWith("/playlist")
                            ? 2.6
                            : 2
                    }
                />
                <span>Your Library</span>
            </button>
        </nav>
    );
};
