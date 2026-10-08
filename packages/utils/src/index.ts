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

/**
 * Browse / Search categories shared across web and mobile
 */
export interface BrowseCategory {
    id: string;
    title: string;
    name: string;
    color: string;
}

export const BROWSE_CATEGORIES: BrowseCategory[] = [
    {
        id: "personalised",
        title: "Made For You",
        name: "Made For You",
        color: "#006450",
    },
    {
        id: "new-releases",
        title: "New Releases",
        name: "New Releases",
        color: "#e8115b",
    },
    { id: "hindi", title: "Hindi", name: "Hindi", color: "#8c1932" },
    { id: "english", title: "English", name: "English", color: "#7358ff" },
    { id: "assamese", title: "Assamese", name: "Assamese", color: "#af2896" },
    { id: "bengali", title: "Bengali", name: "Bengali", color: "#c9d56dff" },
    { id: "pop", title: "Pop", name: "Pop", color: "#8d67ab" },
    { id: "hip-hop", title: "Hip-Hop", name: "Hip-Hop", color: "#ba5d07" },
    { id: "rock", title: "Rock", name: "Rock", color: "#e91429" },
    {
        id: "electronic",
        title: "Electronic",
        name: "Electronic",
        color: "#0d73ec",
    },
    { id: "chill", title: "Chill", name: "Chill", color: "#27856a" },
    { id: "focus", title: "Focus", name: "Focus", color: "#477d95" },
    { id: "workout", title: "Workout", name: "Workout", color: "#503750" },
];

export const CATEGORIES = BROWSE_CATEGORIES;
