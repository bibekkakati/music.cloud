import React from "react";
import { useToast } from "../context/ToastContext";
import {
    CheckCircle2,
    AlertCircle,
    Info,
    AlertTriangle,
    X,
} from "lucide-react";

export const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div
            style={{
                position: "fixed",
                bottom: "calc(var(--player-height) + 18px)",
                right: 24,
                zIndex: 9999,
                display: "flex",
                flexDirection: "column-reverse",
                gap: 10,
                pointerEvents: "none",
            }}
        >
            {toasts.map((toast) => {
                let icon = <Info size={18} color="#ffffff" />;

                if (toast.type === "success") {
                    icon = <CheckCircle2 size={18} color="#ffffff" />;
                } else if (toast.type === "error") {
                    icon = <AlertCircle size={18} color="#ffffff" />;
                } else if (toast.type === "warning") {
                    icon = <AlertTriangle size={18} color="#ffffff" />;
                }

                return (
                    <div
                        key={toast.id}
                        className="app-toast"
                        style={{
                            background: "#000000",
                            backgroundColor: "#000000",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            boxShadow: "0 16px 36px rgba(0, 0, 0, 0.85)",
                        }}
                    >
                        <div
                            style={{
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                color: "#ffffff",
                            }}
                        >
                            {icon}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontWeight: 700,
                                    fontSize: 13.5,
                                    color: "#ffffff",
                                    lineHeight: 1.3,
                                }}
                            >
                                {toast.title}
                            </div>
                            {toast.description && (
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "rgba(255, 255, 255, 0.7)",
                                        marginTop: 3,
                                        lineHeight: 1.4,
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {toast.description}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => removeToast(toast.id)}
                            className="app-toast-close"
                            title="Dismiss"
                            aria-label="Dismiss notification"
                            style={{
                                color: "rgba(255, 255, 255, 0.6)",
                            }}
                        >
                            <X size={15} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};
