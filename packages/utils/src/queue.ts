import type {
    RepeatMode,
    QueuePriority,
    QueueNavigationOptions,
    QueueWindowOptions,
} from "@music-cloud/types";

export const MAX_QUEUE_SIZE = 100;
export const MAX_HISTORY_SIZE = 15;

/**
 * Creates a bounded queue window around a target song ID from a potentially large list of songs.
 * Caps the queue at maxSize (default 100) while retaining up to maxHistory (default 15) played songs.
 */
export function createQueueWindow<T extends { id: string }>(
    allSongs: T[],
    targetSongId: string,
    options?: QueueWindowOptions,
): { queue: T[]; currentIndex: number } {
    if (!allSongs || allSongs.length === 0) {
        return { queue: [], currentIndex: -1 };
    }

    const maxSize = options?.maxSize ?? MAX_QUEUE_SIZE;
    const maxHistory = options?.maxHistory ?? MAX_HISTORY_SIZE;

    // If total songs are within maxSize, no slicing needed
    if (allSongs.length <= maxSize) {
        const idx = allSongs.findIndex((s) => s.id === targetSongId);
        return { queue: allSongs, currentIndex: idx >= 0 ? idx : 0 };
    }

    const targetIdx = allSongs.findIndex((s) => s.id === targetSongId);
    if (targetIdx === -1) {
        return { queue: allSongs.slice(0, maxSize), currentIndex: 0 };
    }

    // Determine how many history tracks to include before target
    const startIdx = Math.max(0, targetIdx - maxHistory);
    // Slice up to maxSize items starting from startIdx
    const endIdx = Math.min(allSongs.length, startIdx + maxSize);
    const windowSlice = allSongs.slice(startIdx, endIdx);

    // If we're near the end of allSongs and windowSlice is less than maxSize, expand backwards if possible
    if (windowSlice.length < maxSize && startIdx > 0) {
        const expandedStart = Math.max(0, endIdx - maxSize);
        const finalSlice = allSongs.slice(expandedStart, endIdx);
        const newIdx = finalSlice.findIndex((s) => s.id === targetSongId);
        return { queue: finalSlice, currentIndex: newIdx };
    }

    const newIdx = windowSlice.findIndex((s) => s.id === targetSongId);
    return { queue: windowSlice, currentIndex: newIdx };
}

/**
 * Appends new songs (e.g. from pagination / infinite scroll) to the existing queue.
 * Deduplicates songs and trims oldest played songs if queue exceeds maxSize.
 */
export function appendWithLimit<T extends { id: string }>(
    currentQueue: T[],
    newSongs: T[],
    currentSongId?: string,
    maxSize = MAX_QUEUE_SIZE,
): T[] {
    if (!newSongs || newSongs.length === 0) return currentQueue;

    const existingIds = new Set(currentQueue.map((s) => s.id));
    const uniqueIncoming = newSongs.filter((s) => !existingIds.has(s.id));

    if (uniqueIncoming.length === 0) return currentQueue;

    let combined = [...currentQueue, ...uniqueIncoming];

    if (combined.length <= maxSize) {
        return combined;
    }

    // If combined exceeds maxSize, evict oldest played songs before the currentSongId
    const currentIdx = currentSongId
        ? combined.findIndex((s) => s.id === currentSongId)
        : -1;

    const overflowCount = combined.length - maxSize;
    if (currentIdx > 0 && overflowCount > 0) {
        // Can trim up to currentIdx elements from head, but leave at least 1 history track if possible
        const maxPrunable = Math.max(0, currentIdx - 1);
        const toPrune = Math.min(overflowCount, maxPrunable);
        if (toPrune > 0) {
            combined = combined.slice(toPrune);
        }
    }

    // If still exceeding maxSize (e.g. huge new batch), trim from tail
    if (combined.length > maxSize) {
        combined = combined.slice(0, maxSize);
    }

    return combined;
}

/**
 * Adds a track to the queue with priority.
 * - 'next': Inserts right after current song.
 * - 'end': Appends at the end of the upcoming queue.
 * Trims oldest played tracks if total exceeds maxSize.
 */
export function addTrackWithPriority<T extends { id: string }>(
    currentQueue: T[],
    track: T,
    currentSongId: string | undefined,
    position: QueuePriority = "end",
    maxSize = MAX_QUEUE_SIZE,
): T[] {
    // If track is already in queue, avoid duplicates
    const filteredQueue = currentQueue.filter((s) => s.id !== track.id);
    let updatedQueue: T[];

    if (!currentSongId || filteredQueue.length === 0) {
        updatedQueue = [track, ...filteredQueue];
    } else {
        const currentIdx = filteredQueue.findIndex((s) => s.id === currentSongId);
        if (currentIdx === -1) {
            updatedQueue = [...filteredQueue, track];
        } else if (position === "next") {
            updatedQueue = [
                ...filteredQueue.slice(0, currentIdx + 1),
                track,
                ...filteredQueue.slice(currentIdx + 1),
            ];
        } else {
            updatedQueue = [...filteredQueue, track];
        }
    }

    // If exceeding maxSize, prune oldest played song from front
    if (updatedQueue.length > maxSize) {
        const currentIdx = currentSongId
            ? updatedQueue.findIndex((s) => s.id === currentSongId)
            : -1;
        if (currentIdx > 0) {
            updatedQueue = updatedQueue.slice(1);
        } else {
            updatedQueue = updatedQueue.slice(0, maxSize);
        }
    }

    return updatedQueue;
}

/**
 * Calculates the next track index based on shuffle, repeat mode, and current position.
 * Returns null if repeatMode is 'off' and queue has reached the end (stopping playback).
 */
export function getNextQueueIndex<T extends { id: string }>(
    queue: T[],
    currentSongId: string | undefined,
    options: QueueNavigationOptions,
): number | null {
    if (!queue || queue.length === 0) return null;
    if (queue.length === 1) {
        if (options.repeatMode === "off") return null;
        return 0;
    }

    const currentIdx = currentSongId
        ? queue.findIndex((s) => s.id === currentSongId)
        : -1;

    if (currentIdx === -1) return 0;

    // 1. Repeat ONE: always repeats active track
    if (options.repeatMode === "one") {
        return currentIdx;
    }

    // 2. Shuffle mode
    if (options.isShuffle && queue.length > 1) {
        const playedSet = new Set(options.playedShuffleIds || []);
        // Find indices not yet played in shuffle session
        const unplayedIndices = queue
            .map((s, idx) => ({ id: s.id, idx }))
            .filter((item) => item.idx !== currentIdx && !playedSet.has(item.id))
            .map((item) => item.idx);

        if (unplayedIndices.length > 0) {
            const randomPick =
                unplayedIndices[
                    Math.floor(Math.random() * unplayedIndices.length)
                ];
            return randomPick;
        }

        // All have been played: if repeat 'off', stop; if repeat 'all', pick random excluding current
        if (options.repeatMode === "off") {
            return null;
        }

        let randomIdx = currentIdx;
        let attempts = 0;
        while (randomIdx === currentIdx && attempts < 10) {
            randomIdx = Math.floor(Math.random() * queue.length);
            attempts++;
        }
        return randomIdx;
    }

    // 3. Normal linear progression
    const isAtEnd = currentIdx >= queue.length - 1;
    if (isAtEnd) {
        if (options.repeatMode === "all") {
            return 0; // Wrap around to start
        }
        // repeatMode is 'off' -> Stop playback
        return null;
    }

    return currentIdx + 1;
}

/**
 * Calculates the previous track index based on shuffle and repeat mode.
 */
export function getPrevQueueIndex<T extends { id: string }>(
    queue: T[],
    currentSongId: string | undefined,
    options: { isShuffle?: boolean; repeatMode?: RepeatMode },
): number {
    if (!queue || queue.length === 0) return 0;
    if (queue.length === 1) return 0;

    const currentIdx = currentSongId
        ? queue.findIndex((s) => s.id === currentSongId)
        : -1;

    if (currentIdx <= 0) {
        // At start of queue: wrap to last track if repeat all, or stay at 0
        return options.repeatMode === "all" ? queue.length - 1 : 0;
    }

    return currentIdx - 1;
}

/**
 * Removes a track from queue by song ID.
 */
export function removeTrackFromQueue<T extends { id: string }>(
    queue: T[],
    songId: string,
): T[] {
    return queue.filter((s) => s.id !== songId);
}
