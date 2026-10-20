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
    const isLibraryActive =
        isLibraryOpen || location.pathname.startsWith("/playlist");

    return (
        <nav className="mobile-bottom-nav">
            {/* 1. Home */}
            <NavLink
                to="/"
                className={({ isActive }) =>
                    `bottom-nav-link ${isActive && !isLibraryOpen ? "active" : ""}`
                }
            >
                {({ isActive }) => (
                    <>
                        <Home
                            size={20}
                            strokeWidth={isActive && !isLibraryOpen ? 2.4 : 1.8}
                        />
                        <span>Home</span>
                    </>
                )}
            </NavLink>

            {/* 2. Search */}
            <NavLink
                to="/search"
                className={({ isActive }) =>
                    `bottom-nav-link ${isActive && !isLibraryOpen ? "active" : ""}`
                }
            >
                {({ isActive }) => (
                    <>
                        <Search
                            size={20}
                            strokeWidth={isActive && !isLibraryOpen ? 2.4 : 1.8}
                        />
                        <span>Search</span>
                    </>
                )}
            </NavLink>

            {/* 3. Your Library */}
            <button
                type="button"
                onClick={onToggleLibrary}
                className={`bottom-nav-btn ${isLibraryActive ? "active" : ""}`}
            >
                <Library
                    size={20}
                    strokeWidth={isLibraryActive ? 2.4 : 1.8}
                />
                <span>Your Library</span>
            </button>
        </nav>
    );
};
