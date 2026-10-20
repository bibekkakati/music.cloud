import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

interface AdminAccessDeniedProps {
    userEmail?: string;
    isAuthenticated: boolean;
}

export const AdminAccessDenied: React.FC<AdminAccessDeniedProps> = ({
    userEmail,
    isAuthenticated,
}) => {
    return (
        <div className="admin-denied-container animate-fade-in">
            <div className="admin-denied-icon-box">
                <ShieldAlert size={32} color="#ef4444" />
            </div>

            <h1 className="admin-denied-title">
                Admin Access Required
            </h1>

            <p className="admin-denied-desc">
                {isAuthenticated
                    ? `Signed in as ${userEmail}. This section requires administrator privileges to access.`
                    : "This page requires administrator access. Please sign in with an administrator account to proceed."}
            </p>

            <Link
                to="/"
                className="app-btn-pill admin-denied-btn"
            >
                Back to Home
            </Link>
        </div>
    );
};
