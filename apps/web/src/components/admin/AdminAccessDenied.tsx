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
                    ? `Signed in as ${userEmail}. This section requires administrator privileges to access.`
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
};
