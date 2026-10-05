import React, {
    createContext,
    useContext,
    useState,
    useRef,
    useEffect,
    useCallback,
} from "react";
import Hls from "hls.js";
import type { SongMetadata, SongDetail } from "../types";
import { streamService } from "../services/streamService";
import { playlistService } from "../services/playlistService";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { appConfig } from "../config";

export type PlayableSong = SongMetadata | SongDetail;

const PLAYER_STORAGE_KEY = appConfig.ui.localStorage_keys.player_state;

interface SavedPlayerState {
    currentSong: PlayableSong;
    queue: PlayableSong[];
    currentTime: number;
    duration: number;
    volume: number;
    isShuffle: boolean;
    isLoop: boolean;
}

const loadSavedPlayerState = (): SavedPlayerState | null => {
    try {
        // Only load saved state if the user is authenticated
        const token = localStorage.getItem("music_cloud_token");
        if (!token) {
            localStorage.removeItem(PLAYER_STORAGE_KEY);
            return null;
        }

        const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (
            parsed &&
            parsed.currentSong &&
            typeof parsed.currentSong === "object" &&
            typeof parsed.currentSong.id === "string"
        ) {
            return {
                currentSong: parsed.currentSong,
                queue: Array.isArray(parsed.queue) ? parsed.queue : [parsed.currentSong],
                currentTime:
                    typeof parsed.currentTime === "number" &&
                    !isNaN(parsed.currentTime) &&
                    parsed.currentTime >= 0
                        ? parsed.currentTime
                        : 0,
                duration:
                    typeof parsed.duration === "number" &&
                    !isNaN(parsed.duration) &&
                    parsed.duration >= 0
                        ? parsed.duration
                        : 0,
                volume:
                    typeof parsed.volume === "number" &&
                    !isNaN(parsed.volume) &&
                    parsed.volume >= 0 &&
                    parsed.volume <= 1
                        ? parsed.volume
                        : 1.0,
                isShuffle: Boolean(parsed.isShuffle),
                isLoop: Boolean(parsed.isLoop),
            };
        }
    } catch (e) {
        console.warn("Failed to load player state from localStorage", e);
    }
    return null;
};

/**
 * Real-world measured bandwidth (bps) persisted in-memory across tracks in current session.
 */
let sessionEstimatedBandwidth: number | null = null;

function getInitialStartLevel(): number {
    // 1. Check if user turned on Data Saver or has a known slow connection (2G)
    if (typeof navigator !== "undefined") {
        const conn = (navigator as unknown as {
            connection?: { saveData?: boolean; effectiveType?: string };
        })?.connection;
        if (
            conn?.saveData ||
            conn?.effectiveType === "2g" ||
            conn?.effectiveType === "slow-2g"
        ) {
            return 0; // Safely force lowest level (256k / 132k)
        }
    }

    // 2. If we already measured this user's speed in this session:
    if (sessionEstimatedBandwidth !== null) {
        // If speed is >= 600 kbps (well above 320 kbps), let HLS.js pick top level (-1 with high estimate)
        // If speed is struggling (< 600 kbps), start at lowest level (0)
        return sessionEstimatedBandwidth >= 600_000 ? -1 : 0;
    }

    // 3. First song on standard/fast network (broadband, Wi-Fi, 4G, 5G): Auto ABR starting at highest available (320k)
    return -1;
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
    streamToken: string | null;
    isLiked: boolean;
    isLikeLoading: boolean;
    isPlayerDisabled: boolean;
    toggleLike: () => Promise<void>;
    playSong: (
        song: PlayableSong,
        queueList?: PlayableSong[],
        initialSeekTime?: number,
    ) => Promise<void>;
    togglePlay: () => void;
    nextTrack: () => void;
    prevTrack: () => void;
    seek: (seconds: number) => void;
    setVolume: (vol: number) => void;
    toggleMute: () => void;
    toggleLoop: () => void;
    toggleShuffle: () => void;
    addToQueue: (song: PlayableSong) => void;
    resetAndStopPlayer: () => void;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const savedState = useRef<SavedPlayerState | null>(loadSavedPlayerState());

    const [currentSong, setCurrentSong] = useState<PlayableSong | null>(
        () => savedState.current?.currentSong || null,
    );
    const [queue, setQueue] = useState<PlayableSong[]>(
        () => savedState.current?.queue || [],
    );
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(
        () => savedState.current?.currentTime || 0,
    );
    const [duration, setDuration] = useState<number>(
        () =>
            savedState.current?.duration ||
            (savedState.current?.currentSong as SongDetail)?.duration_sec ||
            0,
    );
    const [volume, setVolumeState] = useState<number>(() =>
        typeof savedState.current?.volume === "number"
            ? savedState.current.volume
            : appConfig.player.default_volume,
    );
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [isLoop, setIsLoop] = useState<boolean>(
        () => Boolean(savedState.current?.isLoop),
    );
    const [isShuffle, setIsShuffle] = useState<boolean>(
        () => Boolean(savedState.current?.isShuffle),
    );
    const [streamToken, setStreamToken] = useState<string | null>(null);

    // Song Like Status
    const [isLiked, setIsLiked] = useState<boolean>(false);
    const [isLikeLoading, setIsLikeLoading] = useState<boolean>(false);

    const { isAuthenticated } = useAuth();
    const { showToast } = useToast();

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const currentSongRef = useRef<PlayableSong | null>(currentSong);
    const queueRef = useRef<PlayableSong[]>(queue);
    const currentTimeRef = useRef<number>(currentTime);
    const durationRef = useRef<number>(duration);
    const volumeRef = useRef<number>(volume);
    const isShuffleRef = useRef<boolean>(isShuffle);
    const isLoopRef = useRef<boolean>(isLoop);
    const lastSaveTimeRef = useRef<number>(0);

    // Synchronize refs
    useEffect(() => {
        currentSongRef.current = currentSong;
    }, [currentSong]);

    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    useEffect(() => {
        currentTimeRef.current = currentTime;
    }, [currentTime]);

    useEffect(() => {
        durationRef.current = duration;
    }, [duration]);

    useEffect(() => {
        volumeRef.current = volume;
    }, [volume]);

    useEffect(() => {
        isShuffleRef.current = isShuffle;
    }, [isShuffle]);

    useEffect(() => {
        isLoopRef.current = isLoop;
    }, [isLoop]);

    // Stop playback, destroy streams, reset state, and clear storage
    const resetAndStopPlayer = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.removeAttribute("src");
            audioRef.current.load();
        }
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
        setCurrentSong(null);
        setQueue([]);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setStreamToken(null);
        setIsLiked(false);
        localStorage.removeItem(PLAYER_STORAGE_KEY);
    }, []);

    // Trigger cleanup when user gets logged out or is unauthenticated
    useEffect(() => {
        if (!isAuthenticated) {
            resetAndStopPlayer();
        }
    }, [isAuthenticated, resetAndStopPlayer]);

    // Direct event listener for auth:unauthorized and auth:logout
    useEffect(() => {
        const handleLogoutOrUnauthorized = () => {
            resetAndStopPlayer();
        };
        window.addEventListener("auth:unauthorized", handleLogoutOrUnauthorized);
        window.addEventListener("auth:logout", handleLogoutOrUnauthorized);
        return () => {
            window.removeEventListener("auth:unauthorized", handleLogoutOrUnauthorized);
            window.removeEventListener("auth:logout", handleLogoutOrUnauthorized);
        };
    }, [resetAndStopPlayer]);

    // Persist full player state to localStorage only if authenticated
    const savePlayerState = useCallback(
        (overrides?: Partial<SavedPlayerState>) => {
            try {
                if (!isAuthenticated) {
                    localStorage.removeItem(PLAYER_STORAGE_KEY);
                    return;
                }
                const song =
                    overrides?.currentSong !== undefined
                        ? overrides.currentSong
                        : currentSongRef.current;
                if (!song) {
                    localStorage.removeItem(PLAYER_STORAGE_KEY);
                    return;
                }
                const curQ =
                    overrides?.queue !== undefined
                        ? overrides.queue
                        : queueRef.current;
                const stateToSave: SavedPlayerState = {
                    currentSong: song,
                    queue: curQ && curQ.length > 0 ? curQ : [song],
                    currentTime:
                        overrides?.currentTime !== undefined
                            ? overrides.currentTime
                            : audioRef.current?.currentTime ||
                              currentTimeRef.current ||
                              0,
                    duration:
                        overrides?.duration !== undefined
                            ? overrides.duration
                            : audioRef.current?.duration ||
                              durationRef.current ||
                              0,
                    volume:
                        overrides?.volume !== undefined
                            ? overrides.volume
                            : volumeRef.current,
                    isShuffle:
                        overrides?.isShuffle !== undefined
                            ? overrides.isShuffle
                            : isShuffleRef.current,
                    isLoop:
                        overrides?.isLoop !== undefined
                            ? overrides.isLoop
                            : isLoopRef.current,
                };
                localStorage.setItem(
                    PLAYER_STORAGE_KEY,
                    JSON.stringify(stateToSave),
                );
            } catch (e) {
                console.warn(
                    "Failed to persist player state to localStorage",
                    e,
                );
            }
        },
        [isAuthenticated],
    );

    // Save on beforeunload to capture last precise playback position
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isAuthenticated && currentSongRef.current) {
                savePlayerState({
                    currentTime:
                        audioRef.current?.currentTime || currentTimeRef.current,
                    duration:
                        audioRef.current?.duration || durationRef.current,
                });
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () =>
            window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isAuthenticated, savePlayerState]);

    // Save on config changes (volume, shuffle, loop, queue, duration)
    useEffect(() => {
        if (isAuthenticated && currentSong) {
            savePlayerState({
                volume,
                isShuffle,
                isLoop,
                queue,
                duration,
            });
        }
    }, [isAuthenticated, volume, isShuffle, isLoop, queue, duration, currentSong, savePlayerState]);

    // Fetch liked status when currentSong or auth changes
    useEffect(() => {
        if (!currentSong || !isAuthenticated) {
            setIsLiked(false);
            return;
        }

        let isSubscribed = true;
        setIsLikeLoading(true);

        playlistService
            .getSongLikedStatus(currentSong.id)
            .then((liked) => {
                if (isSubscribed) {
                    setIsLiked(liked);
                }
            })
            .catch(() => {
                if (isSubscribed) {
                    setIsLiked(false);
                }
            })
            .finally(() => {
                if (isSubscribed) {
                    setIsLikeLoading(false);
                }
            });

        return () => {
            isSubscribed = false;
        };
    }, [currentSong?.id, isAuthenticated]);

    // Optimistic toggle like
    const toggleLike = useCallback(async () => {
        if (!currentSong) return;
        if (!isAuthenticated) {
            showToast("Sign In Required", "info", "Please log in to like songs");
            return;
        }

        const songId = currentSong.id;
        const previousLiked = isLiked;
        const optimisticLiked = !previousLiked;

        // 1. Optimistic update
        setIsLiked(optimisticLiked);

        try {
            const res = await playlistService.toggleLikeSong(songId);
            setIsLiked(res.liked);
            if (res.liked) {
                showToast("Added to Liked Songs", "success", currentSong.title);
            } else {
                showToast("Removed from Liked Songs", "info", currentSong.title);
            }
            // Notify UI so playlists refresh if a new Liked playlist was generated
            window.dispatchEvent(new CustomEvent("playlist-mutation"));
        } catch (err: unknown) {
            // 2. Undo optimistic state on error
            setIsLiked(previousLiked);
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                "Failed to update liked status";
            showToast("Error", "error", msg);
        }
    }, [currentSong, isAuthenticated, isLiked, showToast]);

    // Initialize Audio instance and bind event listeners
    useEffect(() => {
        const audio = new Audio();
        audio.volume = volumeRef.current;
        audioRef.current = audio;

        const handleTimeUpdate = () => {
            const cur = audio.currentTime;
            setCurrentTime(cur);
            currentTimeRef.current = cur;

            const now = Date.now();
            if (now - lastSaveTimeRef.current > 1500) {
                lastSaveTimeRef.current = now;
                savePlayerState({ currentTime: cur });
            }
        };

        const handleLoadedMetadata = () => {
            if (
                audio.duration &&
                !isNaN(audio.duration) &&
                audio.duration > 0
            ) {
                setDuration(audio.duration);
                durationRef.current = audio.duration;
                savePlayerState({ duration: audio.duration });
            }
        };

        const handlePlay = () => {
            setIsPlaying(true);
        };

        const handlePause = () => {
            setIsPlaying(false);
            savePlayerState({ currentTime: audio.currentTime });
        };

        const handleError = () => {
            setIsPlaying(false);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            if (isLoopRef.current) {
                // If repeat is active, replay current song directly from local buffer
                audio.currentTime = 0;
                setCurrentTime(0);
                savePlayerState({ currentTime: 0 });
                audio
                    .play()
                    .then(() => setIsPlaying(true))
                    .catch(() => setIsPlaying(false));
            } else {
                handleNext();
            }
        };

        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("play", handlePlay);
        audio.addEventListener("playing", handlePlay);
        audio.addEventListener("pause", handlePause);
        audio.addEventListener("error", handleError);
        audio.addEventListener("ended", handleEnded);

        // Listen for background stream token renewals (at < 10 mins remaining)
        const unsubscribe = streamService.onTokenRenewed((newToken) => {
            setStreamToken(newToken);
        });

        return () => {
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("playing", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audio.removeEventListener("error", handleError);
            audio.removeEventListener("ended", handleEnded);
            audio.pause();
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            unsubscribe();
        };
    }, [savePlayerState]);

    const playSong = useCallback(
        async (
            song: PlayableSong,
            queueList?: PlayableSong[],
            initialSeekTime?: number,
        ) => {
            if (!isAuthenticated) {
                showToast("Sign In Required", "info", "Please log in to play music");
                window.dispatchEvent(new CustomEvent("auth:required"));
                return;
            }

            const audio = audioRef.current;
            const isSameSong = currentSongRef.current?.id === song.id;
            const hasActiveSource = Boolean(
                hlsRef.current ||
                    (audio &&
                        audio.src &&
                        audio.src !== window.location.href &&
                        audio.src !== ""),
            );

            const seekTarget =
                typeof initialSeekTime === "number" &&
                !isNaN(initialSeekTime) &&
                initialSeekTime > 0
                    ? initialSeekTime
                    : 0;

            // REQUIREMENT 3: If same song is getting played in repeat, do not fetch segments repeatedly if available in local
            if (isSameSong && hasActiveSource && audio) {
                if (seekTarget > 0) {
                    audio.currentTime = seekTarget;
                    setCurrentTime(seekTarget);
                } else {
                    audio.currentTime = 0;
                    setCurrentTime(0);
                }
                audio
                    .play()
                    .then(() => setIsPlaying(true))
                    .catch((err) => {
                        console.warn(
                            "Playback play() prevented or failed:",
                            err,
                        );
                        setIsPlaying(false);
                    });
                return;
            }

            // Update queue
            let updatedQueue: PlayableSong[];
            if (queueList && queueList.length > 0) {
                updatedQueue = queueList;
                setQueue(queueList);
            } else {
                updatedQueue = queueRef.current.some((s) => s.id === song.id)
                    ? queueRef.current
                    : [song, ...queueRef.current];
                setQueue(updatedQueue);
            }

            const activeSong: PlayableSong = {
                ...song,
                cover_art_url:
                    song.cover_art_url || (song as SongDetail).cover_art_url,
                stream_url:
                    song.stream_url ||
                    (song as SongDetail).master_aac_key ||
                    (song as SongDetail).master_mp3_key,
            };

            setCurrentSong(activeSong);
            currentSongRef.current = activeSong;

            const songDetail = activeSong as SongDetail;
            const targetDuration = songDetail.duration_sec || 0;
            setDuration(targetDuration);
            durationRef.current = targetDuration;
            setCurrentTime(seekTarget);
            currentTimeRef.current = seekTarget;
            setIsPlaying(false);

            savePlayerState({
                currentSong: activeSong,
                queue: updatedQueue,
                currentTime: seekTarget,
                duration: targetDuration,
            });

            try {
                // Check if current stream token is expired or missing, request for a new token
                const token = await streamService.getValidStreamToken();
                setStreamToken(token);

                // Master stream URL prepared by backend when loading song list
                const masterUrl =
                    activeSong.stream_url ||
                    (song as SongDetail).master_aac_key ||
                    (song as SongDetail).master_mp3_key;

                if (!masterUrl) {
                    console.error("No stream URL available for song:", song.id);
                    setIsPlaying(false);
                    return;
                }

                // Pass the master playlist URL so HLS.js can detect all available renditions (256k, 320k) and perform ABR
                const hlsStreamUrl = streamService.getHlsStreamUrl(masterUrl);

                if (!audio) return;

                // REQUIREMENT 3: Enable buffer retention so repeated playback uses local cached segments
                if (Hls.isSupported()) {
                    if (hlsRef.current) {
                        hlsRef.current.destroy();
                        hlsRef.current = null;
                    }

                    const initialStartLevel = getInitialStartLevel();

                    const hls = new Hls({
                        xhrSetup: (xhr) => {
                            xhr.withCredentials = true;
                            xhr.setRequestHeader(
                                "Authorization",
                                `Bearer ${token}`,
                            );
                        },
                        enableWorker: true,
                        lowLatencyMode: false,
                        // Intelligent initial level:
                        // - 2G / Data Saver / struggling network: 0 (256k / lowest)
                        // - Fast network / Wi-Fi / 4G / 5G / broadband: -1 (Auto ABR choosing 320k)
                        startLevel: initialStartLevel,
                        // Provide a healthy 5 Mbps initial estimate so auto ABR starts at top quality (320k) on fast networks
                        abrEwmaDefaultEstimate:
                            sessionEstimatedBandwidth && sessionEstimatedBandwidth > 0
                                ? sessionEstimatedBandwidth
                                : 5_000_000,
                        // Progressive loading: buffer segments ahead
                        maxBufferLength:
                            appConfig.player.default_target_duration_seconds *
                            appConfig.player.max_buffer_ahead_segments,
                        maxMaxBufferLength:
                            appConfig.player.default_target_duration_seconds *
                            appConfig.player.max_buffer_ahead_segments,
                        // Retain played segments behind playhead for seamless repeat/loop
                        backBufferLength:
                            appConfig.player.back_buffer_length_seconds,
                    });

                    // Track real-world measured bandwidth across loaded segments in the current session
                    hls.on(Hls.Events.FRAG_LOADED, () => {
                        if (hls.bandwidthEstimate && hls.bandwidthEstimate > 0) {
                            sessionEstimatedBandwidth = hls.bandwidthEstimate;
                        }
                    });

                    hlsRef.current = hls;
                    hls.loadSource(hlsStreamUrl);
                    hls.attachMedia(audio);

                    // Dynamically lock buffer ahead to configured segments based on playlist target duration
                    hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
                        const targetDurationSec =
                            data.details?.targetduration ||
                            appConfig.player.default_target_duration_seconds;
                        const maxAheadSecs =
                            targetDurationSec *
                            appConfig.player.max_buffer_ahead_segments;
                        hls.config.maxBufferLength = maxAheadSecs;
                        hls.config.maxMaxBufferLength = maxAheadSecs;
                    });

                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        if (seekTarget > 0) {
                            audio.currentTime = seekTarget;
                        }
                        audio.play().catch((err) => {
                            console.warn(
                                "Playback play() prevented or failed:",
                                err,
                            );
                            setIsPlaying(false);
                        });
                    });

                    hls.on(Hls.Events.ERROR, (_event, data) => {
                        if (data.fatal) {
                            console.error("Fatal HLS stream error:", data);
                            setIsPlaying(false);
                            switch (data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    hls.startLoad();
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    hls.recoverMediaError();
                                    break;
                                default:
                                    hls.destroy();
                                    hlsRef.current = null;
                                    break;
                            }
                        }
                    });
                } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
                    // Native Safari HLS support
                    audio.src = hlsStreamUrl;
                    if (seekTarget > 0) {
                        const onLoaded = () => {
                            audio.currentTime = seekTarget;
                            audio.removeEventListener(
                                "loadedmetadata",
                                onLoaded,
                            );
                        };
                        audio.addEventListener("loadedmetadata", onLoaded);
                    }
                    audio.play().catch((err) => {
                        console.warn(
                            "Native HLS play() prevented or failed:",
                            err,
                        );
                        setIsPlaying(false);
                    });
                } else {
                    setIsPlaying(false);
                }
            } catch (err) {
                console.error("Error initiating HLS stream:", err);
                setIsPlaying(false);
            }
        },
        [savePlayerState],
    );

    const togglePlay = useCallback(() => {
        if (!isAuthenticated) {
            showToast("Sign In Required", "info", "Please log in to play music");
            window.dispatchEvent(new CustomEvent("auth:required"));
            return;
        }
        if (!currentSong && queue.length > 0) {
            playSong(queue[0]);
            return;
        }
        if (!currentSong) return;

        const audio = audioRef.current;
        const hasActiveSource = Boolean(
            hlsRef.current ||
                (audio &&
                    audio.src &&
                    audio.src !== window.location.href &&
                    audio.src !== ""),
        );

        if (!hasActiveSource) {
            playSong(
                currentSong,
                queue.length > 0 ? queue : [currentSong],
                currentTime,
            );
            return;
        }

        if (audio) {
            if (audio.paused) {
                audio.play().catch((err) => {
                    console.warn("Playback play() prevented or failed:", err);
                    setIsPlaying(false);
                });
            } else {
                audio.pause();
                setIsPlaying(false);
            }
        }
    }, [currentSong, queue, currentTime, playSong]);

    const handleNext = useCallback(() => {
        if (!isAuthenticated || !queue.length || !currentSongRef.current) return;
        const currentId = currentSongRef.current.id;
        const currentIndex = queue.findIndex((s) => s.id === currentId);
        if (currentIndex === -1) {
            playSong(queue[0]);
            return;
        }

        let nextIndex: number;
        if (isShuffle) {
            if (queue.length > 1) {
                let randomIndex = currentIndex;
                while (randomIndex === currentIndex) {
                    randomIndex = Math.floor(Math.random() * queue.length);
                }
                nextIndex = randomIndex;
            } else {
                nextIndex = 0;
            }
        } else {
            nextIndex = (currentIndex + 1) % queue.length;
        }

        playSong(queue[nextIndex]);
    }, [isAuthenticated, queue, isShuffle, playSong]);

    const handlePrev = useCallback(() => {
        if (!isAuthenticated || !queue.length || !currentSongRef.current) return;
        const audio = audioRef.current;
        // If more than 3 seconds played, restart the current track without refetching
        if (audio && audio.currentTime > 3) {
            audio.currentTime = 0;
            setCurrentTime(0);
            audio
                .play()
                .then(() => setIsPlaying(true))
                .catch(() => {});
            return;
        }

        const currentId = currentSongRef.current.id;
        const currentIndex = queue.findIndex((s) => s.id === currentId);
        if (currentIndex <= 0) {
            playSong(queue[queue.length - 1]);
        } else {
            playSong(queue[currentIndex - 1]);
        }
    }, [isAuthenticated, queue, playSong]);

    const seek = useCallback(
        (seconds: number) => {
            if (!isAuthenticated) return;
            const audio = audioRef.current;
            if (audio && !isNaN(audio.duration) && audio.duration > 0) {
                audio.currentTime = seconds;
            }
            setCurrentTime(seconds);
            currentTimeRef.current = seconds;
            savePlayerState({ currentTime: seconds });
        },
        [isAuthenticated, savePlayerState],
    );

    const setVolume = useCallback(
        (vol: number) => {
            setVolumeState(vol);
            volumeRef.current = vol;
            if (audioRef.current) {
                audioRef.current.volume = vol;
            }
            if (vol > 0 && isMuted) {
                setIsMuted(false);
            }
            savePlayerState({ volume: vol });
        },
        [isMuted, savePlayerState],
    );

    const toggleMute = useCallback(() => {
        setIsMuted((prev) => {
            const next = !prev;
            if (audioRef.current) {
                audioRef.current.muted = next;
            }
            return next;
        });
    }, []);

    const toggleLoop = useCallback(() => {
        setIsLoop((prev) => !prev);
    }, []);

    const toggleShuffle = useCallback(() => {
        setIsShuffle((prev) => !prev);
    }, []);

    const addToQueue = useCallback((song: PlayableSong) => {
        if (!isAuthenticated) {
            showToast("Sign In Required", "info", "Please log in to add to queue");
            window.dispatchEvent(new CustomEvent("auth:required"));
            return;
        }
        setQueue((prev) => {
            if (prev.some((s) => s.id === song.id)) return prev;
            return [...prev, song];
        });
    }, [isAuthenticated, showToast]);

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
                streamToken,
                isLiked,
                isLikeLoading,
                isPlayerDisabled: !isAuthenticated || !currentSong,
                toggleLike,
                playSong,
                togglePlay,
                nextTrack: handleNext,
                prevTrack: handlePrev,
                seek,
                setVolume,
                toggleMute,
                toggleLoop,
                toggleShuffle,
                addToQueue,
                resetAndStopPlayer,
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
