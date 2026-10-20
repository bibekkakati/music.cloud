import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, ArrowLeft } from "lucide-react";

interface AdminNavbarProps {
    onToggleSidebar: () => void;
}

export const AdminNavbar: React.FC<AdminNavbarProps> = ({
    onToggleSidebar,
}) => {
    const location = useLocation();
    const isUpload = location.pathname.startsWith("/admin/upload");
    const isUsers = location.pathname.startsWith("/admin/users");

    const title = isUsers
        ? "User Management"
        : isUpload
          ? "Upload & Ingestion"
          : "Song Catalog";

    const subtitle = isUsers
        ? "Manage system accounts and security credentials"
        : isUpload
          ? "Ingest lossless audio sources, set trimming, and monitor HLS workers"
          : "Browse, inspect, edit metadata, and reprocess catalog assets";

    return (
        <header className="admin-navbar">
            <div className="admin-navbar-left">
                {/* Mobile Hamburger Button */}
                <button
                    type="button"
                    onClick={onToggleSidebar}
                    className="app-btn-ghost mobile-only-btn admin-hamburger"
                    title="Toggle admin sidebar"
                    aria-label="Toggle admin sidebar"
                >
                    <Menu size={22} />
                </button>

                <div>
                    <h1 className="admin-page-title">{title}</h1>
                    <p className="admin-page-subtitle">{subtitle}</p>
                </div>
            </div>

            <div className="admin-navbar-right">
                <Link
                    to="/"
                    className="admin-return-app-pill"
                    title="Return to user music player"
                >
                    <ArrowLeft size={14} />
                    <span>Music App</span>
                </Link>
            </div>
        </header>
    );
};
