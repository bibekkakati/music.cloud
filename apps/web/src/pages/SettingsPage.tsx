import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
    getActiveApiBaseUrl,
    getDefaultApiBaseUrl,
    updateApiBaseUrl,
} from "../api";
import {
    Link as LinkIcon,
    CheckCircle2,
    AlertCircle,
    Activity,
    RotateCcw,
    Save,
    LogOut,
    LogIn,
    ShieldCheck,
    Info,
    Loader2,
} from "lucide-react";

interface SettingsPageProps {
    onOpenAuthModal?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
    onOpenAuthModal,
}) => {
    const { user, isAuthenticated, logout } = useAuth();
    const { showToast } = useToast();

    const [backendUrl, setBackendUrl] = useState<string>("");
    const [initialUrl, setInitialUrl] = useState<string>("");
    const defaultUrl = getDefaultApiBaseUrl();

    // Connection test state
    const [isTesting, setIsTesting] = useState<boolean>(false);
    const [testResult, setTestResult] = useState<{
        status: "success" | "error";
        message: string;
        latency?: number;
    } | null>(null);

    // Save & logout state
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

    useEffect(() => {
        const active = getActiveApiBaseUrl();
        setBackendUrl(active);
        setInitialUrl(active);
    }, []);

    const handleTestConnection = async () => {
        const trimmed = backendUrl.trim().replace(/\/+$/, "");
        if (!trimmed) {
            setTestResult({
                status: "error",
                message: "Please enter a valid Backend URL to test.",
            });
            return;
        }

        if (!/^https?:\/\//i.test(trimmed)) {
            setTestResult({
                status: "error",
                message: "Backend URL must start with http:// or https://",
            });
            return;
        }

        setIsTesting(true);
        setTestResult(null);
        const startTime = performance.now();

        try {
            // Attempt to ping /health endpoint or root with a short timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const res = await fetch(`${trimmed}/health`, {
                method: "GET",
                signal: controller.signal,
                headers: { Accept: "application/json" },
            }).catch(() => {
                // Fallback attempt to root
                return fetch(trimmed, {
                    method: "GET",
                    signal: controller.signal,
                });
            });

            clearTimeout(timeoutId);
            const latency = Math.round(performance.now() - startTime);

            if (res && res.status < 500) {
                setTestResult({
                    status: "success",
                    message: `Server reachable (HTTP ${res.status})`,
                    latency,
                });
                showToast(
                    "Connection Successful",
                    "success",
                    `Responded in ${latency}ms`,
                );
            } else {
                setTestResult({
                    status: "error",
                    message: `Server returned error status (${res?.status || "unknown"})`,
                    latency,
                });
            }
        } catch (err: any) {
            const latency = Math.round(performance.now() - startTime);
            const isAbort = err?.name === "AbortError";
            setTestResult({
                status: "error",
                message: isAbort
                    ? "Connection timed out after 6 seconds"
                    : "Unable to connect. Check URL or CORS settings.",
                latency,
            });
            showToast(
                "Connection Failed",
                "error",
                "Could not connect to the specified server.",
            );
        } finally {
            setIsTesting(false);
        }
    };

    const handleSaveUrl = () => {
        const trimmed = backendUrl.trim().replace(/\/+$/, "");
        if (!trimmed) {
            showToast(
                "Validation Error",
                "error",
                "Backend URL cannot be empty.",
            );
            return;
        }

        if (!/^https?:\/\//i.test(trimmed)) {
            showToast(
                "Invalid URL",
                "error",
                "Backend URL must start with http:// or https://",
            );
            return;
        }

        setIsSaving(true);
        try {
            const updated = updateApiBaseUrl(trimmed);
            setBackendUrl(updated);
            setInitialUrl(updated);
            showToast(
                "Backend Saved",
                "success",
                `API Base URL updated to ${updated}`,
            );
        } catch {
            showToast("Error", "error", "Failed to persist backend URL.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetUrl = () => {
        setIsSaving(true);
        try {
            const restored = updateApiBaseUrl(defaultUrl);
            setBackendUrl(restored);
            setInitialUrl(restored);
            setTestResult(null);
            showToast(
                "Reset to Default",
                "info",
                `Backend URL restored to default: ${restored || "Default URL"}`,
            );
        } catch {
            showToast("Error", "error", "Failed to reset backend URL.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        if (
            !window.confirm("Are you sure you want to log out of MusicCloud?")
        ) {
            return;
        }
        setIsLoggingOut(true);
        try {
            await logout();
        } finally {
            setIsLoggingOut(false);
        }
    };

    const isUrlModified = backendUrl.trim() !== initialUrl.trim();
    const isUsingDefault =
        backendUrl.trim().replace(/\/+$/, "") ===
        defaultUrl.trim().replace(/\/+$/, "");

    return (
        <div className="settings-page-container">
            {/* Page Header */}
            <header className="settings-header">
                <h1 className="settings-title">Settings</h1>
                <p className="settings-subtitle">
                    Manage your private server connection, session, and
                    application preferences.
                </p>
            </header>

            <div className="settings-content-grid">
                {/* Section 1: Server Configuration */}
                <div className="settings-card panel">
                    <div className="settings-card-body">
                        {/* URL Input */}
                        <div className="settings-input-group">
                            <label
                                className="settings-label"
                                htmlFor="backend-url-input"
                            >
                                Backend URL
                            </label>
                            <div className="settings-input-wrapper">
                                <LinkIcon
                                    size={18}
                                    className="settings-input-icon"
                                    color="var(--app-subtext)"
                                />
                                <input
                                    id="backend-url-input"
                                    type="url"
                                    value={backendUrl}
                                    onChange={(e) => {
                                        setBackendUrl(e.target.value);
                                        setTestResult(null);
                                    }}
                                    placeholder="https://api.yourcloud.com"
                                    className="settings-text-input"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                />
                            </div>
                        </div>

                        {/* Status Badges */}
                        <div className="settings-meta-row">
                            {/* Ping / Connection Result */}
                            {testResult && (
                                <div
                                    className={`settings-test-badge ${
                                        testResult.status === "success"
                                            ? "test-success"
                                            : "test-error"
                                    }`}
                                >
                                    {testResult.status === "success" ? (
                                        <CheckCircle2 size={15} />
                                    ) : (
                                        <AlertCircle size={15} />
                                    )}
                                    <span>{testResult.message}</span>
                                    {testResult.latency !== undefined && (
                                        <span className="settings-latency">
                                            ({testResult.latency}ms)
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions Row */}
                        <div className="settings-actions-row">
                            <div className="settings-actions-left">
                                <button
                                    onClick={handleSaveUrl}
                                    disabled={isSaving || !isUrlModified}
                                    className="app-btn-pill settings-btn-primary"
                                    title="Save and apply backend URL"
                                >
                                    {isSaving ? (
                                        <Loader2
                                            size={16}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <Save size={16} />
                                    )}
                                    <span>Save & Apply</span>
                                </button>

                                <button
                                    onClick={handleTestConnection}
                                    disabled={isTesting || !backendUrl.trim()}
                                    className="app-btn-ghost settings-btn-secondary"
                                    title="Ping backend server to verify status"
                                >
                                    {isTesting ? (
                                        <Loader2
                                            size={16}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <Activity size={16} />
                                    )}
                                    <span>Test Connection</span>
                                </button>
                            </div>

                            <button
                                onClick={handleResetUrl}
                                disabled={isSaving || isUsingDefault}
                                className="app-btn-ghost settings-btn-reset"
                                title="Reset to environment default"
                            >
                                <RotateCcw size={16} />
                                <span>Reset to Default</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Section 2: Account & Session */}
                <div className="settings-card panel">
                    <div className="settings-card-body">
                        {isAuthenticated && user ? (
                            <div className="settings-user-profile-row">
                                <div className="settings-avatar-group">
                                    <div className="settings-user-avatar">
                                        {user.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="settings-user-meta">
                                        <span className="settings-user-email">
                                            {user.email}
                                        </span>
                                        <div className="settings-user-role-row">
                                            {user.is_admin ? (
                                                <span className="settings-badge badge-admin">
                                                    <ShieldCheck size={13} />
                                                    <span>Administrator</span>
                                                </span>
                                            ) : (
                                                <span className="settings-badge badge-neutral">
                                                    Member
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="settings-logout-btn"
                                    title="Log out of MusicCloud"
                                >
                                    {isLoggingOut ? (
                                        <Loader2
                                            size={16}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <LogOut size={16} />
                                    )}
                                    <span>Log out</span>
                                </button>
                            </div>
                        ) : (
                            <div className="settings-guest-box">
                                <p className="settings-guest-text">
                                    You are currently using MusicCloud as a
                                    guest. Sign in to access your cloud library,
                                    create playlists, and stream high-fidelity
                                    audio.
                                </p>
                                <button
                                    onClick={() => {
                                        if (onOpenAuthModal) onOpenAuthModal();
                                        else
                                            window.dispatchEvent(
                                                new CustomEvent(
                                                    "auth:required",
                                                ),
                                            );
                                    }}
                                    className="app-btn-pill settings-login-btn"
                                >
                                    <LogIn size={16} />
                                    <span>Log in</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Section 3: App Information */}
                <div className="settings-card panel settings-info-card">
                    <div className="settings-info-content">
                        <div className="settings-info-icon">
                            <Info size={18} color="var(--app-subtext)" />
                        </div>
                        <div className="settings-info-text">
                            <span className="settings-info-version">
                                MusicCloud Web • v1.1.0
                            </span>
                            <span className="settings-info-sub">
                                Private High-Fidelity Audio Streaming Cloud
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
