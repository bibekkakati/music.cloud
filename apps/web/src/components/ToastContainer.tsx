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
                let icon = <Info size={18} color="#3d91f4" />;
                let accentColor = "#3d91f4";

                if (toast.type === "success") {
                    icon = <CheckCircle2 size={18} color="var(--app-green)" />;
                    accentColor = "var(--app-green)";
                } else if (toast.type === "error") {
                    icon = <AlertCircle size={18} color="#f15e6c" />;
                    accentColor = "#f15e6c";
                } else if (toast.type === "warning") {
                    icon = <AlertTriangle size={18} color="#fbbf24" />;
                    accentColor = "#fbbf24";
                }

                return (
                    <div
                        key={toast.id}
                        className="app-toast"
                        style={{
                            borderLeft: `4px solid ${accentColor}`,
                        }}
                    >
                        <div
                            style={{
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            {icon}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontWeight: 700,
                                    fontSize: 13.5,
                                    color: "var(--app-text)",
                                    lineHeight: 1.3,
                                }}
                            >
                                {toast.title}
                            </div>
                            {toast.description && (
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--app-subtext)",
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
                        >
                            <X size={15} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};
