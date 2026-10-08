import React, {
    createContext,
    useContext,
    useState,
    useRef,
    useEffect,
    useCallback,
} from "react";
import {
    createAudioPlayer,
    setAudioModeAsync,
    type AudioPlayer,
    type AudioStatus,
} from "expo-audio";
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

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { isAuthenticated, openAuthModal } = useAuth();

    const [currentSong, setCurrentSong] = useState<PlayableSong | null>(null);
    const [queue, setQueue] = useState<PlayableSong[]>([]);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
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

    const playerRef = useRef<AudioPlayer | null>(null);
    const currentSongRef = useRef<PlayableSong | null>(null);
    const queueRef = useRef<PlayableSong[]>(queue);
    const isLoopRef = useRef<boolean>(isLoop);
    const isShuffleRef = useRef<boolean>(isShuffle);
    const volumeRef = useRef<number>(volume);
    const isMutedRef = useRef<boolean>(isMuted);
    const playRequestIdRef = useRef<number>(0);
    const playSongRef = useRef<((song: PlayableSong, queueList?: PlayableSong[], initialSeekTime?: number) => Promise<void>) | null>(null);
    const handleNextTrackRef = useRef<(() => Promise<void>) | null>(null);
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

    // Configure Audio session mode for background playback
    useEffect(() => {
        setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: "doNotMix",
        }).catch((err) => {
            console.warn("Failed to set audio mode:", err);
        });

        return () => {
            if (playerRef.current) {
                playerRef.current.remove();
                playerRef.current = null;
            }
        };
    }, []);

    // Restore saved player state
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
                        setCurrentTime(parsed.currentTime || 0);
                        setDuration(parsed.duration || 0);
                        setVolumeState(
                            parsed.volume ?? appConfig.player.default_volume,
                        );
                        setIsLoop(Boolean(parsed.isLoop));
                        setIsShuffle(Boolean(parsed.isShuffle));
                    }
                }
            } catch (e) {
                console.warn("Failed to load player state from storage:", e);
            }
        })();
    }, []);

    // Save player state changes
    const saveState = useCallback(
        async (overrides?: Partial<SavedPlayerState>) => {
            if (!currentSongRef.current) return;
            try {
                const stateToSave: SavedPlayerState = {
                    currentSong:
                        overrides?.currentSong || currentSongRef.current,
                    queue: overrides?.queue || queueRef.current,
                    currentTime: overrides?.currentTime ?? 0,
                    duration: overrides?.duration ?? 0,
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
        [],
    );

    // Fetch liked status when current song changes
    useEffect(() => {
        if (!currentSong || !isAuthenticated) {
            setIsLiked(false);
            return;
        }

        let active = true;
        setIsLikeLoading(true);

        // Preload stream token into memory cache as soon as authenticated
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

    const isSeekingRef = useRef<boolean>(false);
    const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handlePlaybackStatusUpdate = useCallback(
        (status: AudioStatus) => {
            // Avoid play button flicker: only set isPlaying to false when explicitly paused or stopped
            if (status.timeControlStatus === "paused") {
                setIsPlaying(false);
            } else if (
                status.timeControlStatus === "playing" ||
                status.playing
            ) {
                setIsPlaying(true);
            }

            // Only update currentTime if user is not actively seeking to prevent jumping/flickering
            if (!isSeekingRef.current) {
                setCurrentTime(status.currentTime);
            }
            if (status.duration > 0) {
                setDuration(status.duration);
            }

            if (status.didJustFinish) {
                if (isLoopRef.current) {
                    playerRef.current?.seekTo(0);
                    playerRef.current?.play();
                } else {
                    handleNextTrackRef.current?.();
                }
            }
        },
        [],
    );

    const playSong = async (
        song: PlayableSong,
        queueList?: PlayableSong[],
        initialSeekTime = 0,
    ) => {
        if (!authRef.current.isAuthenticated) {
            authRef.current.openAuthModal();
            return;
        }

        const currentRequestId = ++playRequestIdRef.current;

        try {
            const isSameSong = currentSongRef.current?.id === song.id;

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

            const songDetail = song as SongDetail;
            const targetDuration = songDetail.duration_sec || 0;
            setDuration(targetDuration);
            setCurrentTime(initialSeekTime);
            // Instant UI response for playback state
            setIsPlaying(true);

            if (isSameSong && playerRef.current) {
                if (initialSeekTime > 0) {
                    await playerRef.current.seekTo(initialSeekTime);
                } else {
                    await playerRef.current.seekTo(0);
                }
                playerRef.current.play();
                return;
            }

            // Stop & remove previous player immediately
            if (playerRef.current) {
                try {
                    playerRef.current.pause();
                    playerRef.current.remove();
                } catch {}
                playerRef.current = null;
            }

            // Get valid streaming token
            const token = await streamService.getValidStreamToken();

            // Check if a newer play request was issued while waiting for the token
            if (currentRequestId !== playRequestIdRef.current) {
                return;
            }

            const rawStreamUrl =
                song.stream_url ||
                (song as SongDetail).master_aac_key ||
                (song as SongDetail).master_mp3_key;

            if (!rawStreamUrl) {
                console.error("No stream URL available for song:", song.id);
                setIsPlaying(false);
                return;
            }

            const streamUrl = attachTokenToStreamUrl(rawStreamUrl, token);

            const player = createAudioPlayer(
                {
                    uri: streamUrl,
                    headers: token
                        ? { Authorization: `Bearer ${token}` }
                        : undefined,
                },
                {
                    updateInterval: 400,
                },
            );

            // Check if cancelled before configuring
            if (currentRequestId !== playRequestIdRef.current) {
                try {
                    player.pause();
                    player.remove();
                } catch {}
                return;
            }

            player.volume = isMutedRef.current ? 0 : volumeRef.current;
            player.loop = isLoopRef.current;

            player.addListener("playbackStatusUpdate", (status) => {
                if (currentRequestId === playRequestIdRef.current) {
                    handlePlaybackStatusUpdate(status);
                }
            });

            // Non-blocking lockscreen registration so playback starts immediately
            try {
                player.setActiveForLockScreen(
                    true,
                    {
                        title: song.title,
                        artist: song.artist,
                        albumTitle: "Music Cloud",
                        artworkUrl: song.cover_art_url || undefined,
                    },
                    {
                        showSeekForward: false,
                        showSeekBackward: false,
                    },
                );
            } catch {}

            if (initialSeekTime > 0) {
                await player.seekTo(initialSeekTime);
            }

            // Check if cancelled before playing
            if (currentRequestId !== playRequestIdRef.current) {
                try {
                    player.pause();
                    player.remove();
                } catch {}
                return;
            }

            // Ensure old player is removed
            const existingPlayer = playerRef.current as AudioPlayer | null;
            if (existingPlayer) {
                try {
                    existingPlayer.pause();
                    existingPlayer.remove();
                } catch {}
            }

            player.play();
            playerRef.current = player;

            saveState({
                currentSong: song,
                queue: updatedQueue,
                currentTime: initialSeekTime,
                duration: targetDuration,
            });
        } catch (err) {
            if (currentRequestId === playRequestIdRef.current) {
                console.error("Failed to play song:", err);
                setIsPlaying(false);
            }
        }
    };

    useEffect(() => {
        playSongRef.current = playSong;
        handleNextTrackRef.current = handleNextTrack;
    });

    const togglePlay = async () => {
        if (!authRef.current.isAuthenticated) {
            authRef.current.openAuthModal();
            return;
        }
        if (!playerRef.current) {
            if (currentSongRef.current) {
                await playSong(
                    currentSongRef.current,
                    queueRef.current,
                    currentTime,
                );
            }
            return;
        }

        const willPlay = !isPlaying;
        setIsPlaying(willPlay);

        try {
            if (willPlay) {
                playerRef.current.play();
            } else {
                playerRef.current.pause();
            }
        } catch (e) {
            console.warn("Toggle play error:", e);
            setIsPlaying(!willPlay);
        }
    };

    const handlePrevTrack = async () => {
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

        if (currentTime > 3 && playerRef.current) {
            await playerRef.current.seekTo(0);
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
            await playSong(prevSong, q, 0);
        }
    };

    const seek = async (seconds: number) => {
        if (!playerRef.current) return;
        try {
            const targetSec = Math.max(0, Math.min(seconds, duration));
            // Lock status updates from rolling back the slider
            isSeekingRef.current = true;
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
            // Immediately and optimistically set currentTime
            setCurrentTime(targetSec);
            await playerRef.current.seekTo(targetSec);
        } catch (err) {
            console.warn("Seek error:", err);
        } finally {
            // Hold lock briefly (250ms) so stale status frames don't rewind time
            seekTimeoutRef.current = setTimeout(() => {
                isSeekingRef.current = false;
            }, 250);
        }
    };

    const setVolume = async (vol: number) => {
        const clamped = Math.max(0, Math.min(1, vol));
        setVolumeState(clamped);
        volumeRef.current = clamped;
        if (playerRef.current && !isMutedRef.current) {
            playerRef.current.volume = clamped;
        }
    };

    const toggleMute = async () => {
        const nextMuted = !isMuted;
        setIsMuted(nextMuted);
        isMutedRef.current = nextMuted;
        if (playerRef.current) {
            playerRef.current.muted = nextMuted;
        }
    };

    const toggleLoop = () => {
        const nextLoop = !isLoop;
        setIsLoop(nextLoop);
        isLoopRef.current = nextLoop;
        if (playerRef.current) {
            playerRef.current.loop = nextLoop;
        }
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
        // OPTIMISTIC UPDATE: Immediate instant feedback without waiting for API
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
                currentTime,
                duration,
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
