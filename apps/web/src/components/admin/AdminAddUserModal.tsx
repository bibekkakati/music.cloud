import React, { useState } from "react";
import { UserPlus, X, Copy, Check, Shield, User, Loader2, AlertTriangle } from "lucide-react";
import { adminService } from "../../services/adminService";
import { useToast } from "../../context/ToastContext";

interface AdminAddUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUserCreated: () => void;
}

export const AdminAddUserModal: React.FC<AdminAddUserModalProps> = ({
    isOpen,
    onClose,
    onUserCreated,
}) => {
    const { showToast } = useToast();
    const [email, setEmail] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // One-time view state
    const [createdPassword, setCreatedPassword] = useState<string | null>(null);
    const [createdEmail, setCreatedEmail] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleClose = () => {
        if (createdPassword) {
            onUserCreated();
        }
        setEmail("");
        setIsAdmin(false);
        setError(null);
        setCreatedPassword(null);
        setCreatedEmail(null);
        setCopied(false);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError("Email address is required");
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);
            const res = await adminService.createUser({
                email: trimmedEmail,
                is_admin: isAdmin,
            });
            setCreatedEmail(res.user.email);
            setCreatedPassword(res.generated_password);
            showToast("User Created", "success", `Account provisioned for ${res.user.email}`);
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to create user.";
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopy = async () => {
        if (!createdPassword) return;
        try {
            await navigator.clipboard.writeText(createdPassword);
            setCopied(true);
            showToast("Copied", "info", "Password copied to clipboard");
            setTimeout(() => setCopied(false), 2500);
        } catch {
            showToast("Copy Failed", "error", "Could not copy to clipboard");
        }
    };

    return (
        <div className="admin-modal-backdrop" onClick={handleClose}>
            <div
                className="admin-modal-card animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={handleClose}
                    className="app-btn-ghost admin-modal-close"
                    title="Close"
                >
                    <X size={18} />
                </button>

                {!createdPassword ? (
                    <>
                        <div className="admin-modal-header">
                            <div className="admin-modal-icon-badge">
                                <UserPlus size={20} color="var(--app-green)" />
                            </div>
                            <div>
                                <h3 className="admin-modal-title">Provision New User</h3>
                                <p className="admin-modal-subtitle">
                                    Create a system account. A secure 10-character password will be auto-generated.
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="admin-modal-error">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="admin-modal-form">
                            <div className="admin-form-group">
                                <label className="admin-form-label">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    required
                                    placeholder="user@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="admin-form-input"
                                    autoFocus
                                />
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">
                                    Account Role
                                </label>
                                <div className="admin-role-options">
                                    <button
                                        type="button"
                                        onClick={() => setIsAdmin(false)}
                                        className={`admin-role-option-btn ${!isAdmin ? "selected" : ""}`}
                                    >
                                        <User size={16} />
                                        <span>Standard User</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsAdmin(true)}
                                        className={`admin-role-option-btn ${isAdmin ? "selected" : ""}`}
                                    >
                                        <Shield size={16} />
                                        <span>Administrator</span>
                                    </button>
                                </div>
                            </div>

                            <div className="admin-modal-footer">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="admin-modal-btn admin-modal-btn-ghost"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="admin-modal-btn admin-modal-btn-primary"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        "Generate & Create User"
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <>
                        <div className="admin-modal-header">
                            <div className="admin-modal-icon-badge success">
                                <Check size={20} color="var(--app-green)" />
                            </div>
                            <div>
                                <h3 className="admin-modal-title">User Account Created</h3>
                                <p className="admin-modal-subtitle">
                                    One-time view for <strong>{createdEmail}</strong> credentials.
                                </p>
                            </div>
                        </div>

                        <div className="admin-onetime-warning-banner">
                            <AlertTriangle size={18} className="admin-warning-icon" />
                            <div>
                                <strong>Important: Copy this password now!</strong>
                                <p>
                                    For security, passwords are stored using one-way bcrypt hashing. This password will never be shown again.
                                </p>
                            </div>
                        </div>

                        <div className="admin-form-group">
                            <label className="admin-form-label">
                                Auto-Generated Password
                            </label>
                            <div className="admin-credential-display-box">
                                <span className="admin-credential-code">
                                    {createdPassword}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="admin-copy-btn"
                                    title="Copy password to clipboard"
                                >
                                    {copied ? (
                                        <>
                                            <Check size={14} color="var(--app-green)" />
                                            <span>Copied!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={14} />
                                            <span>Copy</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="admin-modal-footer">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="admin-modal-btn admin-modal-btn-primary"
                            >
                                Done
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
