/**
 * Date & Time formatting utilities
 */

export const formatDateAdded = (dateStr?: string): string => {
    if (!dateStr) return "—";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "—";
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHours = Math.floor(diffMin / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMin < 1) return "Just now";
        if (diffMin < 60) return `${diffMin} min ago`;
        if (diffHours < 24)
            return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year:
                date.getFullYear() !== now.getFullYear()
                    ? "numeric"
                    : undefined,
        });
    } catch {
        return "—";
    }
};

export const formatDuration = (seconds?: number): string => {
    if (!seconds || isNaN(seconds)) return "3:20";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

export const formatTime = (seconds?: number): string => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

/**
 * Playlist domain utilities
 */
export const isLikedPlaylist = (
    label?: string,
    isDeletable?: boolean,
): boolean => {
    if (isDeletable === false) return true;
    if (!label) return false;
    const lower = label.trim().toLowerCase();
    return lower === "liked songs" || lower === "liked";
};

/**
 * Pure greeting utility based on local hour
 */
export const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
};
