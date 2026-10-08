import React, {
    createContext,
    useContext,
    useState,
    useRef,
    useEffect,
    useCallback,
} from "react";
import TrackPlayer, {
    Capability,
    State,
    Event,
    usePlaybackState,
    useProgress,
    type Track,
} from "react-native-track-player";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SongMetadata, SongDetail } from "@music-cloud/types";
import { streamService } from "../services/streamService";
import { playlistService, songService } from "@music-cloud/services";
import { useAuth } from "./AuthContext";
import { appConfig } from "../config";

export type PlayableSong = SongMetadata | SongDetail;

interface SavedPlayerState {
    currentSong: PlayableSong;
    queue: PlayableSong[];
    currentTime: number;
    duration: number;
    volume: number;
    isShuffle: boolean;
    isLoop: boolean;
}

function attachTokenToStreamUrl(rawUrl: string, token: string | null): string {
    if (!token || !rawUrl) return rawUrl;
    try {
        const url = new URL(rawUrl);
        const cleanPath = url.pathname.replace(/^\/stream\/[^/]+/, "");
        url.pathname = `/stream/${encodeURIComponent(token)}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
        return url.toString();
    } catch {
        const clean = rawUrl.replace(/^\/stream\/[^/]+/, "");
        return `/stream/${encodeURIComponent(token)}${clean.startsWith("/") ? clean : `/${clean}`}`;
    }
}

interface PlayerContextValue {
    currentSong: PlayableSong | null;
    queue: PlayableSong[];
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    isLoop: boolean;
    isShuffle: boolean;
    isLiked: boolean;
    isLikeLoading: boolean;
    isNowPlayingOpen: boolean;
    playlistModalSong: SongMetadata | null;
    playSong: (
        song: PlayableSong,
        queueList?: PlayableSong[],
        initialSeekTime?: number,
    ) => Promise<void>;
    togglePlay: () => Promise<void>;
    nextTrack: () => Promise<void>;
    prevTrack: () => Promise<void>;
    seek: (seconds: number) => Promise<void>;
    setVolume: (vol: number) => Promise<void>;
    toggleMute: () => Promise<void>;
    toggleLoop: () => void;
    toggleShuffle: () => void;
    toggleLike: () => Promise<void>;
    addToQueue: (song: PlayableSong) => void;
    openNowPlaying: () => void;
    closeNowPlaying: () => void;
    openPlaylistModal: (song: SongMetadata) => void;
    closePlaylistModal: () => void;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

let isTrackPlayerInitialized = false;

async function setupTrackPlayerIfNeeded() {
    if (isTrackPlayerInitialized) return;
    try {
        await TrackPlayer.setupPlayer({
            autoHandleInterruptions: true,
        });
    } catch (e: any) {
        // Might already be initialized in dev/hot reload
        if (!e?.message?.includes("already")) {
            console.warn("TrackPlayer setup error:", e);
        }
    }

    try {
        await TrackPlayer.updateOptions({
            capabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
                Capability.SeekTo,
                Capability.Stop,
            ],
            compactCapabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
            ],
            notificationCapabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
                Capability.SeekTo,
            ],
        });
    } catch (e) {
        console.warn("Failed to update TrackPlayer options:", e);
    }
    isTrackPlayerInitialized = true;
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { isAuthenticated, openAuthModal } = useAuth();

    const [currentSong, setCurrentSong] = useState<PlayableSong | null>(null);
    const [queue, setQueue] = useState<PlayableSong[]>([]);
    const [volume, setVolumeState] = useState<number>(
        appConfig.player.default_volume,
    );
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [isLoop, setIsLoop] = useState<boolean>(false);
    const [isShuffle, setIsShuffle] = useState<boolean>(false);
    const [isLiked, setIsLiked] = useState<boolean>(false);
    const [isLikeLoading, setIsLikeLoading] = useState<boolean>(false);

    // Modals state
    const [isNowPlayingOpen, setIsNowPlayingOpen] = useState<boolean>(false);
    const [playlistModalSong, setPlaylistModalSong] =
        useState<SongMetadata | null>(null);

    // Track Player hooks for real-time state and progress
    const playbackState = usePlaybackState();
    const progress = useProgress(400);

    const isPlaying =
        playbackState.state === State.Playing ||
        playbackState.state === State.Buffering;

    const currentSongRef = useRef<PlayableSong | null>(null);
    const queueRef = useRef<PlayableSong[]>(queue);
    const isLoopRef = useRef<boolean>(isLoop);
    const isShuffleRef = useRef<boolean>(isShuffle);
    const volumeRef = useRef<number>(volume);
    const isMutedRef = useRef<boolean>(isMuted);
    const playRequestIdRef = useRef<number>(0);
    const playSongRef = useRef<((song: PlayableSong, queueList?: PlayableSong[], initialSeekTime?: number) => Promise<void>) | null>(null);
    const handleNextTrackRef = useRef<(() => Promise<void>) | null>(null);
    const handlePrevTrackRef = useRef<(() => Promise<void>) | null>(null);
    const authRef = useRef({ isAuthenticated, openAuthModal });

    // Sync refs
    useEffect(() => {
        authRef.current = { isAuthenticated, openAuthModal };
    }, [isAuthenticated, openAuthModal]);
    useEffect(() => {
        currentSongRef.current = currentSong;
    }, [currentSong]);
    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);
    useEffect(() => {
        isLoopRef.current = isLoop;
    }, [isLoop]);
    useEffect(() => {
        isShuffleRef.current = isShuffle;
    }, [isShuffle]);
    useEffect(() => {
        volumeRef.current = volume;
    }, [volume]);
    useEffect(() => {
        isMutedRef.current = isMuted;
    }, [isMuted]);

    // Initialize Track Player on mount
    useEffect(() => {
        setupTrackPlayerIfNeeded();
    }, []);

    // Save state persistence helper
    const saveState = useCallback(
        async (overrides?: Partial<SavedPlayerState>) => {
            if (!currentSongRef.current) return;
            try {
                const stateToSave: SavedPlayerState = {
                    currentSong:
                        overrides?.currentSong || currentSongRef.current,
                    queue: overrides?.queue || queueRef.current,
                    currentTime: overrides?.currentTime ?? progress.position,
                    duration: overrides?.duration ?? progress.duration,
                    volume: overrides?.volume ?? volumeRef.current,
                    isShuffle: overrides?.isShuffle ?? isShuffleRef.current,
                    isLoop: overrides?.isLoop ?? isLoopRef.current,
                };
                await AsyncStorage.setItem(
                    appConfig.storageKeys.playerState,
                    JSON.stringify(stateToSave),
                );
            } catch {
                // Ignore write errors
            }
        },
        [progress.position, progress.duration],
    );

    // Restore saved player state on mount
    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(
                    appConfig.storageKeys.playerState,
                );
                if (raw) {
                    const parsed: SavedPlayerState = JSON.parse(raw);
                    if (parsed?.currentSong) {
                        setCurrentSong(parsed.currentSong);
                        setQueue(parsed.queue || [parsed.currentSong]);
                        setVolumeState(
                            parsed.volume ?? appConfig.player.default_volume,
                        );
                        setIsLoop(Boolean(parsed.isLoop));
                        setIsShuffle(Boolean(parsed.isShuffle));
                    }
                }
            } catch (err) {
                console.error("Failed to restore player state:", err);
            }
        })();
    }, []);

    // Fetch liked status when current song changes
    useEffect(() => {
        if (!currentSong || !isAuthenticated) {
            setIsLiked(false);
            return;
        }

        let active = true;
        setIsLikeLoading(true);

        streamService.preloadToken();

        playlistService
            .getSongLikedStatus(currentSong.id)
            .then((liked) => {
                if (active) setIsLiked(liked);
            })
            .catch(() => {
                if (active) setIsLiked(false);
            })
            .finally(() => {
                if (active) setIsLikeLoading(false);
            });

        return () => {
            active = false;
        };
    }, [currentSong, isAuthenticated]);

    // Handle track ended & track change events from OS remote controls
    useEffect(() => {
        const subQueueEnded = TrackPlayer.addEventListener(
            Event.PlaybackQueueEnded,
            async () => {
                if (isLoopRef.current) {
                    await TrackPlayer.seekTo(0);
                    await TrackPlayer.play();
                } else {
                    handleNextTrackRef.current?.();
                }
            },
        );

        const subActiveTrack = TrackPlayer.addEventListener(
            Event.PlaybackActiveTrackChanged,
            async (event) => {
                if (event.track) {
                    const songInQueue = queueRef.current.find(
                        (s) => s.id === event.track?.id,
                    );
                    if (songInQueue) {
                        setCurrentSong(songInQueue);
                    }
                }
            },
        );

        return () => {
            subQueueEnded.remove();
            subActiveTrack.remove();
        };
    }, []);

    const handleNextTrack = useCallback(async () => {
        let q = queueRef.current;
        if (q.length <= 1) {
            try {
                const all = await songService.getAllSongs();
                if (Array.isArray(all) && all.length > 0) {
                    q = all;
                    queueRef.current = all;
                    setQueue(all);
                }
            } catch {}
        }
        if (q.length === 0) return;

        const currentIdx = q.findIndex(
            (s) => s.id === currentSongRef.current?.id,
        );
        let nextIdx = 0;

        if (isShuffleRef.current && q.length > 1) {
            let attempts = 0;
            do {
                nextIdx = Math.floor(Math.random() * q.length);
                attempts++;
            } while (nextIdx === currentIdx && attempts < 10);
        } else {
            nextIdx = (currentIdx + 1) % q.length;
        }

        const nextSong = q[nextIdx];
        if (nextSong) {
            if (playSongRef.current) {
                await playSongRef.current(nextSong, q, 0);
            }
        }
    }, []);

    const handlePrevTrack = useCallback(async () => {
        let q = queueRef.current;
        if (q.length <= 1) {
            try {
                const all = await songService.getAllSongs();
                if (Array.isArray(all) && all.length > 0) {
                    q = all;
                    queueRef.current = all;
                    setQueue(all);
                }
            } catch {}
        }
        if (q.length === 0) return;

        const currentPos = await TrackPlayer.getProgress().then((p) => p.position).catch(() => 0);
        if (currentPos > 3) {
            await TrackPlayer.seekTo(0);
            return;
        }

        const currentIdx = q.findIndex(
            (s) => s.id === currentSongRef.current?.id,
        );
        let prevIdx = 0;
        if (isShuffleRef.current && q.length > 1) {
            let attempts = 0;
            do {
                prevIdx = Math.floor(Math.random() * q.length);
                attempts++;
            } while (prevIdx === currentIdx && attempts < 10);
        } else {
            prevIdx = (currentIdx - 1 + q.length) % q.length;
        }
        const prevSong = q[prevIdx];
        if (prevSong) {
            if (playSongRef.current) {
                await playSongRef.current(prevSong, q, 0);
            }
        }
    }, []);

    const playSong = async (
        song: PlayableSong,
        queueList?: PlayableSong[],
        initialSeekTime = 0,
    ) => {
        if (!authRef.current.isAuthenticated) {
            authRef.current.openAuthModal();
            return;
        }

        await setupTrackPlayerIfNeeded();

        const currentRequestId = ++playRequestIdRef.current;

        try {
            // Update queue
            let updatedQueue = queueRef.current;
            if (queueList && queueList.length > 0) {
                updatedQueue = queueList;
                setQueue(queueList);
            } else if (!queueRef.current.some((s) => s.id === song.id)) {
                updatedQueue = [song, ...queueRef.current];
                setQueue(updatedQueue);
            }

            setCurrentSong(song);
            currentSongRef.current = song;

            // Get valid streaming token
            const token = await streamService.getValidStreamToken();

            if (currentRequestId !== playRequestIdRef.current) {
                return;
            }

            const rawStreamUrl =
                song.stream_url ||
                (song as SongDetail).master_aac_key ||
                (song as SongDetail).master_mp3_key;

            if (!rawStreamUrl) {
                console.error("No stream URL available for song:", song.id);
                return;
            }

            const streamUrl = attachTokenToStreamUrl(rawStreamUrl, token);

            const track: Track = {
                id: song.id,
                url: streamUrl,
                title: song.title || "Unknown Title",
                artist: song.artist || "Unknown Artist",
                album: "Music Cloud",
                artwork:
                    song.cover_art_url && song.cover_art_url.startsWith("http")
                        ? song.cover_art_url
                        : undefined,
                duration: (song as SongDetail).duration_sec || 0,
                headers: token
                    ? { Authorization: `Bearer ${token}` }
                    : undefined,
            };

            await TrackPlayer.reset();
            await TrackPlayer.add(track);

            if (initialSeekTime > 0) {
                await TrackPlayer.seekTo(initialSeekTime);
            }

            await TrackPlayer.setVolume(
                isMutedRef.current ? 0 : volumeRef.current,
            );
            await TrackPlayer.play();

            saveState({
                currentSong: song,
                queue: updatedQueue,
                currentTime: initialSeekTime,
                duration: track.duration || 0,
            });
        } catch (err) {
            if (currentRequestId === playRequestIdRef.current) {
                console.error("Failed to play song:", err);
            }
        }
    };

    useEffect(() => {
        playSongRef.current = playSong;
        handleNextTrackRef.current = handleNextTrack;
        handlePrevTrackRef.current = handlePrevTrack;
    });

    const togglePlay = async () => {
        if (!authRef.current.isAuthenticated) {
            authRef.current.openAuthModal();
            return;
        }

        const state = await TrackPlayer.getPlaybackState().catch(() => null);
        if (!state || state.state === State.None || state.state === State.Stopped) {
            if (currentSongRef.current) {
                await playSong(
                    currentSongRef.current,
                    queueRef.current,
                    progress.position,
                );
            }
            return;
        }

        if (state.state === State.Playing) {
            await TrackPlayer.pause();
        } else {
            await TrackPlayer.play();
        }
    };

    const seek = async (seconds: number) => {
        try {
            const targetSec = Math.max(0, Math.min(seconds, progress.duration || 0));
            await TrackPlayer.seekTo(targetSec);
        } catch (err) {
            console.warn("Seek error:", err);
        }
    };

    const setVolume = async (vol: number) => {
        const clamped = Math.max(0, Math.min(1, vol));
        setVolumeState(clamped);
        volumeRef.current = clamped;
        if (!isMutedRef.current) {
            await TrackPlayer.setVolume(clamped).catch(() => {});
        }
    };

    const toggleMute = async () => {
        const nextMuted = !isMuted;
        setIsMuted(nextMuted);
        isMutedRef.current = nextMuted;
        await TrackPlayer.setVolume(nextMuted ? 0 : volumeRef.current).catch(() => {});
    };

    const toggleLoop = () => {
        const nextLoop = !isLoop;
        setIsLoop(nextLoop);
        isLoopRef.current = nextLoop;
        saveState({ isLoop: nextLoop });
    };

    const toggleShuffle = () => {
        const nextShuffle = !isShuffle;
        setIsShuffle(nextShuffle);
        isShuffleRef.current = nextShuffle;
        saveState({ isShuffle: nextShuffle });
    };

    const toggleLike = async () => {
        if (!authRef.current.isAuthenticated) {
            authRef.current.openAuthModal();
            return;
        }
        if (!currentSong) return;

        const previousState = isLiked;
        const targetLiked = !previousState;
        setIsLiked(targetLiked);

        try {
            const res = await playlistService.toggleLikeSong(currentSong.id);
            if (typeof res?.liked === "boolean") {
                setIsLiked(res.liked);
            }
        } catch (e) {
            console.warn("Toggle like error, reverting:", e);
            setIsLiked(previousState);
        }
    };

    const addToQueue = (song: PlayableSong) => {
        setQueue((prev) =>
            prev.some((s) => s.id === song.id) ? prev : [...prev, song],
        );
    };

    return (
        <PlayerContext.Provider
            value={{
                currentSong,
                queue,
                isPlaying,
                currentTime: progress.position,
                duration: progress.duration,
                volume,
                isMuted,
                isLoop,
                isShuffle,
                isLiked,
                isLikeLoading,
                isNowPlayingOpen,
                playlistModalSong,
                playSong,
                togglePlay,
                nextTrack: handleNextTrack,
                prevTrack: handlePrevTrack,
                seek,
                setVolume,
                toggleMute,
                toggleLoop,
                toggleShuffle,
                toggleLike,
                addToQueue,
                openNowPlaying: () => {
                    setIsNowPlayingOpen(true);
                },
                closeNowPlaying: () => {
                    setIsNowPlayingOpen(false);
                },
                openPlaylistModal: (song: SongMetadata) =>
                    setPlaylistModalSong(song),
                closePlaylistModal: () => setPlaylistModalSong(null),
            }}
        >
            {children}
        </PlayerContext.Provider>
    );
};

export const usePlayer = (): PlayerContextValue => {
    const context = useContext(PlayerContext);
    if (!context) {
        throw new Error("usePlayer must be used within a PlayerProvider");
    }
    return context;
};
