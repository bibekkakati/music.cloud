import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { adminService } from "../../services/adminService";
import {
    Layers,
    Upload,
    Users,
    Database,
    Loader2,
    X,
    LogOut,
    User as UserIcon,
} from "lucide-react";
import { Logo } from "../Logo";

interface AdminSidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
    isOpen = false,
    onClose,
}) => {
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [isRebuildingIndex, setIsRebuildingIndex] = useState(false);

    const handleRebuildSearchIndex = async () => {
        if (isRebuildingIndex) return;
        try {
            setIsRebuildingIndex(true);
            const res = await adminService.rebuildSearchIndex();
            showToast(
                "Search Index Rebuilt",
                "success",
                `Indexed ${res.total_indexed} songs into search memory.`,
            );
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to rebuild search index";
            showToast("Rebuild Index Failed", "error", msg);
        } finally {
            setIsRebuildingIndex(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate("/");
        } catch {
            // ignore
        }
    };

    const handleNavClick = () => {
        if (onClose) onClose();
    };

    return (
        <>
            {/* Mobile Drawer Backdrop */}
            {isOpen && (
                <div className="mobile-drawer-backdrop" onClick={onClose} />
            )}

            <aside className={`admin-sidebar ${isOpen ? "mobile-open" : ""}`}>
                {/* Brand & Portal Badge */}
                <div className="panel admin-sidebar-panel">
                    <div className="admin-sidebar-header">
                        <Logo size={28} showText={true} />

                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="app-btn-ghost mobile-only-btn sidebar-brand-mobile-close"
                                title="Close drawer"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {/* Navigation Links */}
                    <nav className="admin-nav-group">
                        <div className="admin-nav-section-title">
                            MANAGEMENT
                        </div>

                        <NavLink
                            to="/admin/catalog"
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                                `admin-nav-item ${isActive ? "active" : ""}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Layers
                                        size={18}
                                        strokeWidth={isActive ? 2.5 : 1.8}
                                        color={
                                            isActive
                                                ? "var(--app-green)"
                                                : "currentColor"
                                        }
                                    />
                                    <span>Song Catalog</span>
                                </>
                            )}
                        </NavLink>

                        <NavLink
                            to="/admin/upload"
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                                `admin-nav-item ${isActive ? "active" : ""}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Upload
                                        size={18}
                                        strokeWidth={isActive ? 2.5 : 1.8}
                                        color={
                                            isActive
                                                ? "var(--app-green)"
                                                : "currentColor"
                                        }
                                    />
                                    <span>Upload & Ingestion</span>
                                </>
                            )}
                        </NavLink>

                        <NavLink
                            to="/admin/users"
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                                `admin-nav-item ${isActive ? "active" : ""}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Users
                                        size={18}
                                        strokeWidth={isActive ? 2.5 : 1.8}
                                        color={
                                            isActive
                                                ? "var(--app-green)"
                                                : "currentColor"
                                        }
                                    />
                                    <span>Users</span>
                                </>
                            )}
                        </NavLink>
                    </nav>

                    {/* System Operations Section */}
                    <div className="admin-nav-group">
                        <div className="admin-nav-section-title">
                            SYSTEM ACTIONS
                        </div>

                        <button
                            type="button"
                            onClick={handleRebuildSearchIndex}
                            disabled={isRebuildingIndex}
                            className="admin-action-btn"
                            title="Rebuild in-memory search index and category caches from database"
                        >
                            {isRebuildingIndex ? (
                                <Loader2
                                    size={16}
                                    className="animate-spin"
                                    color="var(--app-green)"
                                />
                            ) : (
                                <Database size={16} />
                            )}
                            <span>
                                {isRebuildingIndex
                                    ? "Rebuilding Index..."
                                    : "Rebuild Search Index"}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Bottom Island: Back to Music App & Admin Profile */}
                <div className="panel admin-sidebar-footer-panel">
                    <div className="admin-user-card">
                        <div className="admin-user-avatar">
                            <UserIcon size={16} color="var(--app-subtext)" />
                        </div>
                        <div className="admin-user-info">
                            <span className="admin-user-email">
                                {user?.email || "Administrator"}
                            </span>
                            <span className="admin-user-role">Super Admin</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="admin-logout-btn"
                            title="Sign out of Admin"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};
