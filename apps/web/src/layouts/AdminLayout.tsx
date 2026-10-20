import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AdminSidebar } from "../components/admin/AdminSidebar";
import { AdminNavbar } from "../components/admin/AdminNavbar";
import { AdminAccessDenied } from "../components/admin/AdminAccessDenied";
import { Player } from "../components/Player";
import { Loader2 } from "lucide-react";

export const AdminLayout: React.FC = () => {
    const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const location = useLocation();

    // Auto-close mobile drawer on route navigation
    useEffect(() => {
        setMobileDrawerOpen(false);
    }, [location.pathname]);

    if (isLoading) {
        return (
            <div className="app-loading-screen">
                <Loader2
                    size={40}
                    className="animate-spin"
                    color="var(--app-green)"
                />
            </div>
        );
    }

    if (!isAuthenticated || !isAdmin) {
        return (
            <div className="admin-denied-screen">
                <AdminAccessDenied
                    userEmail={user?.email}
                    isAuthenticated={isAuthenticated}
                />
            </div>
        );
    }

    return (
        <div className="admin-layout">
            {/* Dedicated Admin Sidebar */}
            <AdminSidebar
                isOpen={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
            />

            {/* Main Admin Island */}
            <div className="panel admin-content-island">
                <AdminNavbar
                    onToggleSidebar={() => setMobileDrawerOpen(!mobileDrawerOpen)}
                />

                <main className="admin-main-scroll">
                    <Outlet />
                </main>
            </div>

            {/* Bottom Player for Audio Auditioning */}
            <Player />
        </div>
    );
};

export default AdminLayout;
