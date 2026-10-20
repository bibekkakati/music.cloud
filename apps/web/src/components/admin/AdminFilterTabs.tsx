import React from "react";

export interface FilterTabOption<T extends string = string> {
    value: T;
    label: string;
    count?: number;
    color?: string;
    icon?: React.ReactNode;
}

export interface AdminFilterTabsProps<T extends string = string> {
    options: FilterTabOption<T>[];
    value: T;
    onChange: (value: T) => void;
    label?: string;
    icon?: React.ReactNode;
    className?: string;
}

export function AdminFilterTabs<T extends string = string>({
    options,
    value,
    onChange,
    label,
    icon,
    className = "",
}: AdminFilterTabsProps<T>) {
    return (
        <div className={`admin-filter-group ${className}`}>
            {(label || icon) && (
                <div className="admin-filter-label">
                    {icon}
                    {label && <span>{label}</span>}
                </div>
            )}
            {options.map((opt) => {
                const isActive =
                    value.toUpperCase() === opt.value.toUpperCase();
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={`app-tag-pill admin-filter-pill ${
                            isActive ? "active" : ""
                        }`}
                    >
                        {opt.color && (
                            <span
                                className="admin-filter-dot"
                                style={{ backgroundColor: opt.color }}
                            />
                        )}
                        {opt.icon && (
                            <span className="admin-filter-icon">
                                {opt.icon}
                            </span>
                        )}
                        <span>{opt.label}</span>
                        {typeof opt.count === "number" && (
                            <span className="admin-filter-count">
                                {opt.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
