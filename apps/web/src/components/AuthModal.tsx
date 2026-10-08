import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { X, Lock, Mail, Loader2 } from "lucide-react";
import { Logo } from "./Logo";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) {
            setError("Please enter both email and passcode");
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);
            await login({ email: email.trim(), password: password.trim() });
            onClose();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response
                    ?.data?.detail || "Authentication failed.";
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                backdropFilter: "blur(8px)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
            onClick={onClose}
        >
            <div
                className="animate-fade-in"
                style={{
                    width: "100%",
                    maxWidth: 440,
                    borderRadius: 8,
                    padding: "40px 36px",
                    position: "relative",
                    background: "#282828",
                    boxShadow: "0 24px 48px rgba(0, 0, 0, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="app-btn-ghost"
                    style={{ position: "absolute", top: 16, right: 16 }}
                >
                    <X size={20} />
                </button>

                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                        <Logo size={56} />
                    </div>
                    <h2
                        style={{
                            fontSize: 24,
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                            color: "#ffffff",
                        }}
                    >
                        Log in to Music Cloud
                    </h2>
                    <p
                        style={{
                            color: "var(--app-subtext)",
                            fontSize: 13,
                            marginTop: 8,
                        }}
                    >
                        Enter your email and passcode. New accounts are
                        registered automatically.
                    </p>
                </div>

                {error && (
                    <div
                        style={{
                            padding: "12px 14px",
                            borderRadius: 4,
                            background: "rgba(239, 68, 68, 0.15)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#fca5a5",
                            fontSize: 13,
                            marginBottom: 18,
                        }}
                    >
                        {error}
                    </div>
                )}

                <form
                    onSubmit={handleSubmit}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 18,
                    }}
                >
                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#ffffff",
                                marginBottom: 8,
                            }}
                        >
                            Email address
                        </label>
                        <div style={{ position: "relative" }}>
                            <Mail
                                size={18}
                                style={{
                                    position: "absolute",
                                    left: 14,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "var(--app-subtext)",
                                }}
                            />
                            <input
                                type="email"
                                required
                                placeholder="name@domain.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "12px 14px 12px 42px",
                                    fontSize: 14,
                                    borderRadius: 4,
                                    background: "#121212",
                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                    color: "#fff",
                                    outline: "none",
                                }}
                                onFocus={(e) =>
                                    (e.currentTarget.style.borderColor = "#fff")
                                }
                                onBlur={(e) =>
                                    (e.currentTarget.style.borderColor =
                                        "rgba(255, 255, 255, 0.2)")
                                }
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#ffffff",
                                marginBottom: 8,
                            }}
                        >
                            Passcode
                        </label>
                        <div style={{ position: "relative" }}>
                            <Lock
                                size={18}
                                style={{
                                    position: "absolute",
                                    left: 14,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "var(--app-subtext)",
                                }}
                            />
                            <input
                                type="password"
                                required
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "12px 14px 12px 42px",
                                    fontSize: 14,
                                    borderRadius: 4,
                                    background: "#121212",
                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                    color: "#fff",
                                    outline: "none",
                                }}
                                onFocus={(e) =>
                                    (e.currentTarget.style.borderColor = "#fff")
                                }
                                onBlur={(e) =>
                                    (e.currentTarget.style.borderColor =
                                        "rgba(255, 255, 255, 0.2)")
                                }
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="app-btn-green"
                        style={{
                            width: "100%",
                            padding: "14px",
                            fontSize: 15,
                            marginTop: 10,
                            opacity: isSubmitting ? 0.7 : 1,
                        }}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Logging In...</span>
                            </>
                        ) : (
                            "Log In"
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
