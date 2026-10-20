import React, { useState } from "react";
import { KeyRound, X, Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import type { AdminUserItem } from "../../types";
import { adminService } from "../../services/adminService";
import { useToast } from "../../context/ToastContext";

interface AdminResetPasswordModalProps {
    user: AdminUserItem | null;
    isOpen: boolean;
    onClose: () => void;
    onPasswordReset: () => void;
}

export const AdminResetPasswordModal: React.FC<AdminResetPasswordModalProps> = ({
    user,
    isOpen,
    onClose,
    onPasswordReset,
}) => {
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // One-time view state
    const [resetPassword, setResetPassword] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    if (!isOpen || !user) return null;

    const handleClose = () => {
        if (resetPassword) {
            onPasswordReset();
        }
        setError(null);
        setResetPassword(null);
        setCopied(false);
        onClose();
    };

    const handleConfirmReset = async () => {
        try {
            setIsSubmitting(true);
            setError(null);
            const res = await adminService.resetUserPassword(user.id);
            setResetPassword(res.generated_password);
            showToast(
                "Password Reset",
                "success",
                `New password issued for ${user.email}. Sessions invalidated.`,
            );
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Failed to reset password.";
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopy = async () => {
        if (!resetPassword) return;
        try {
            await navigator.clipboard.writeText(resetPassword);
            setCopied(true);
            showToast("Copied", "info", "New password copied to clipboard");
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

                {!resetPassword ? (
                    <>
                        <div className="admin-modal-header">
                            <div className="admin-modal-icon-badge danger">
                                <KeyRound size={20} color="var(--app-warning, #f59e0b)" />
                            </div>
                            <div>
                                <h3 className="admin-modal-title">Reset User Password</h3>
                                <p className="admin-modal-subtitle">
                                    Issue new credentials for <strong>{user.email}</strong>.
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="admin-modal-error">
                                {error}
                            </div>
                        )}

                        <div className="admin-onetime-warning-banner danger">
                            <AlertTriangle size={18} className="admin-warning-icon" />
                            <div>
                                <strong>Active Sessions Will Be Expired</strong>
                                <p>
                                    Resetting this password will immediately invalidate all active login sessions across all devices for this user.
                                </p>
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
                                type="button"
                                onClick={handleConfirmReset}
                                disabled={isSubmitting}
                                className="admin-modal-btn admin-modal-btn-danger"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Resetting...</span>
                                    </>
                                ) : (
                                    "Generate New Password"
                                )}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="admin-modal-header">
                            <div className="admin-modal-icon-badge success">
                                <Check size={20} color="var(--app-green)" />
                            </div>
                            <div>
                                <h3 className="admin-modal-title">Password Reset Complete</h3>
                                <p className="admin-modal-subtitle">
                                    New credentials for <strong>{user.email}</strong>.
                                </p>
                            </div>
                        </div>

                        <div className="admin-onetime-warning-banner">
                            <AlertTriangle size={18} className="admin-warning-icon" />
                            <div>
                                <strong>One-time view: Copy this password now!</strong>
                                <p>
                                    All previous sessions have been terminated. Provide this new password to the user. It cannot be recovered later.
                                </p>
                            </div>
                        </div>

                        <div className="admin-form-group">
                            <label className="admin-form-label">
                                Newly Issued Password
                            </label>
                            <div className="admin-credential-display-box">
                                <span className="admin-credential-code">
                                    {resetPassword}
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
