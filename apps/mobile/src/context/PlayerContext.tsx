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
    TrackType,
    type Track,
} from "react-native-track-player";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SongMetadata, SongDetail, PlayableSong, RepeatMode, QueuePriority } from "@music-cloud/types";
import {
    MAX_QUEUE_SIZE,
    createQueueWindow,
    appendWithLimit,
    addTrackWithPriority,
    getNextQueueIndex,
    getPrevQueueIndex,
    removeTrackFromQueue,
} from "@music-cloud/utils";
import { streamService } from "../services/streamService";
import { downloadService } from "../services/downloadService";
import { playlistService } from "@music-cloud/services";
import { registerRemoteHandlers } from "../services/playbackService";
import { useAuth } from "./AuthContext";
import { useNetwork } from "./NetworkContext";
import { appConfig } from "../config";

export type { PlayableSong };

interface SavedPlayerState {
    currentSong: PlayableSong;
    queue: PlayableSong[];
    currentTime: number;
    duration: number;
    volume: number;
    isShuffle: boolean;
    isLoop: boolean;
    repeatMode?: RepeatMode;
    currentCollectionId?: string | null;
}

function attachTokenToStreamUrl(rawUrl: string, token: string | null): string {
    if (!token || !rawUrl) return rawUrl;
    try {
        const url = new URL(rawUrl);
        const cleanPath = url.pathname.replace(/^\/stream\/[^/]+/, "");
        url.pathname = `/stream/${encodeURIComponent(token)}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
        url.searchParams.set("token", token);
        return url.toString();
    } catch {
        const clean = rawUrl.replace(/^\/stream\/[^/]+/, "");
        const path = `/stream/${encodeURIComponent(token)}${clean.startsWith("/") ? clean : `/${clean}`}`;
        const separator = path.includes("?") ? "&" : "?";
        return `${path}${separator}token=${encodeURIComponent(token)}`;
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
    repeatMode: RepeatMode;
    isShuffle: boolean;
    currentCollectionId: string | null;
    isLiked: boolean;
    isLikeLoading: boolean;
    isNowPlayingOpen: boolean;
    playlistModalSong: SongMetadata | null;
    playSong: (
        song: PlayableSong,
        queueList?: PlayableSong[],
        initialSeekTime?: number,
        collectionId?: string,
    ) => Promise<void>;
    togglePlay: () => Promise<void>;
    nextTrack: () => Promise<void>;
    prevTrack: () => Promise<void>;
    seek: (seconds: number) => Promise<void>;
    setVolume: (vol: number) => Promise<void>;
    toggleMute: () => Promise<void>;
    toggleLoop: () => void;
    toggleRepeatMode: () => void;
    toggleShuffle: () => void;
    toggleLike: () => Promise<void>;
    addToQueue: (song: PlayableSong, position?: QueuePriority) => void;
    removeFromQueue: (songId: string) => void;
    syncCollectionQueue: (collectionId: string, newSongs: PlayableSong[]) => void;
    clearPlayer: () => Promise<void>;
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
                Capability.SkipToPrevious,
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
    const { isOffline } = useNetwork();

    const [currentSong, setCurrentSong] = useState<PlayableSong | null>(null);
    const [queue, setQueue] = useState<PlayableSong[]>([]);
    const [volume, setVolumeState] = useState<number>(
        appConfig.player.default_volume,
    );
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [repeatMode, setRepeatMode] = useState<RepeatMode>("all");
    const [isLoop, setIsLoop] = useState<boolean>(false);
    const [isShuffle, setIsShuffle] = useState<boolean>(false);
    const [currentCollectionId, setCurrentCollectionId] = useState<string | null>(null);
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
    const repeatModeRef = useRef<RepeatMode>(repeatMode);
    const isShuffleRef = useRef<boolean>(isShuffle);
    const currentCollectionIdRef = useRef<string | null>(currentCollectionId);
    const shuffleHistoryRef = useRef<string[]>([]);
    const volumeRef = useRef<number>(volume);
    const isMutedRef = useRef<boolean>(isMuted);
    const playRequestIdRef = useRef<number>(0);
    const playSongRef = useRef<
        | ((
              song: PlayableSong,
              queueList?: PlayableSong[],
              initialSeekTime?: number,
              collectionId?: string,
          ) => Promise<void>)
        | null
    >(null);
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
        repeatModeRef.current = repeatMode;
    }, [repeatMode]);
    useEffect(() => {
        isShuffleRef.current = isShuffle;
    }, [isShuffle]);
    useEffect(() => {
        currentCollectionIdRef.current = currentCollectionId;
    }, [currentCollectionId]);
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
                    repeatMode: overrides?.repeatMode || repeatModeRef.current,
                    currentCollectionId:
                        overrides?.currentCollectionId !== undefined
                            ? overrides.currentCollectionId
                            : currentCollectionIdRef.current,
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
                        const downloaded = await downloadService.isSongDownloaded(
                            parsed.currentSong.id,
                        );
                        // If offline and song is not in downloads, do not restore as active track
                        if (isOffline && !downloaded) {
                            return;
                        }

                        const rawQueue = parsed.queue || [parsed.currentSong];
                        const { queue: boundedQ } = createQueueWindow<PlayableSong>(
                            rawQueue,
                            parsed.currentSong.id,
                        );
                        const rMode: RepeatMode =
                            parsed.repeatMode || (parsed.isLoop ? "one" : "all");

                        setCurrentSong(parsed.currentSong);
                        setQueue(boundedQ);
                        setVolumeState(
                            parsed.volume ?? appConfig.player.default_volume,
                        );
                        setRepeatMode(rMode);
                        repeatModeRef.current = rMode;
                        setIsLoop(rMode === "one");
                        setIsShuffle(Boolean(parsed.isShuffle));
                        if (parsed.currentCollectionId) {
                            setCurrentCollectionId(parsed.currentCollectionId);
                            currentCollectionIdRef.current =
                                parsed.currentCollectionId;
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to restore player state:", err);
            }
        })();
    }, [isOffline]);

    // Clear player completely (resets track, audio engine, queue, and stored state)
    const clearPlayer = useCallback(async () => {
        try {
            await TrackPlayer.reset().catch(() => {});
        } finally {
            setCurrentSong(null);
            currentSongRef.current = null;
            setQueue([]);
            queueRef.current = [];
            AsyncStorage.removeItem(appConfig.storageKeys.playerState).catch(
                () => {},
            );
        }
    }, []);

    // Detect logout transition (authenticated -> unauthenticated) and clear player
    const wasAuthenticatedRef = useRef(isAuthenticated);
    useEffect(() => {
        if (wasAuthenticatedRef.current && !isAuthenticated) {
            clearPlayer();
        }
        wasAuthenticatedRef.current = isAuthenticated;
    }, [isAuthenticated, clearPlayer]);

    // If offline and current song is not downloaded, clear the track from player
    useEffect(() => {
        if (!isOffline || !currentSong) return;

        let active = true;
        downloadService.isSongDownloaded(currentSong.id).then((downloaded) => {
            if (active && !downloaded) {
                clearPlayer();
            }
        });

        return () => {
            active = false;
        };
    }, [isOffline, currentSong, clearPlayer]);

    // Fetch liked status when current song changes
    useEffect(() => {
        if (!currentSong || !isAuthenticated) {
            setIsLiked(false);
            return;
        }

        let active = true;
        setIsLikeLoading(true);

        // Only preload stream token if song is NOT downloaded locally
        downloadService.isSongDownloaded(currentSong.id).then((isDownloaded) => {
            if (active && !isDownloaded) {
                streamService.preloadToken();
            }
        });

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
        registerRemoteHandlers({
            onNext: async () => {
                await handleNextTrackRef.current?.();
            },
            onPrev: async () => {
                await handlePrevTrackRef.current?.();
            },
            onPlay: async () => {
                const state = await TrackPlayer.getPlaybackState().catch(
                    () => null,
                );
                const activeTrack = await TrackPlayer.getActiveTrack().catch(
                    () => null,
                );
                if (
                    !state ||
                    !activeTrack ||
                    state.state === State.None ||
                    state.state === State.Stopped ||
                    state.state === State.Error
                ) {
                    if (currentSongRef.current && playSongRef.current) {
                        await playSongRef.current(
                            currentSongRef.current,
                            queueRef.current,
                            progress.position,
                        );
                        return;
                    }
                }
                await TrackPlayer.play().catch(() => {});
            },
            onPause: async () => {
                await TrackPlayer.pause().catch(() => {});
            },
        });

        const subQueueEnded = TrackPlayer.addEventListener(
            Event.PlaybackQueueEnded,
            async () => {
                if (repeatModeRef.current === "one") {
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
            registerRemoteHandlers({
                onNext: null,
                onPrev: null,
                onPlay: null,
                onPause: null,
            });
            subQueueEnded.remove();
            subActiveTrack.remove();
        };
    }, []);

    const handleNextTrack = useCallback(async () => {
        let q = queueRef.current;
        if (q.length === 0) return;

        const currentId = currentSongRef.current?.id;
        const nextIdx = getNextQueueIndex(q, currentId, {
            isShuffle: isShuffleRef.current,
            repeatMode: repeatModeRef.current,
            playedShuffleIds: shuffleHistoryRef.current,
        });

        if (nextIdx === null) {
            // Repeat mode is off and reached end of queue -> stop playback
            await TrackPlayer.pause().catch(() => {});
            await TrackPlayer.seekTo(0).catch(() => {});
            return;
        }

        if (isShuffleRef.current) {
            shuffleHistoryRef.current.push(q[nextIdx].id);
            if (shuffleHistoryRef.current.length > q.length) {
                shuffleHistoryRef.current.shift();
            }
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
        if (q.length === 0) return;

        const currentPos = await TrackPlayer.getProgress()
            .then((p) => p.position)
            .catch(() => 0);
        if (currentPos > 3) {
            await TrackPlayer.seekTo(0);
            return;
        }

        const currentId = currentSongRef.current?.id;
        const prevIdx = getPrevQueueIndex(q, currentId, {
            isShuffle: isShuffleRef.current,
            repeatMode: repeatModeRef.current,
        });

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
        collectionId?: string,
    ) => {
        // 1. Check if song is downloaded offline
        const localDownloaded = await downloadService.getDownloadedSong(song.id);

        if (!localDownloaded && !authRef.current.isAuthenticated) {
            authRef.current.openAuthModal();
            return;
        }

        if (collectionId !== undefined) {
            setCurrentCollectionId(collectionId);
            currentCollectionIdRef.current = collectionId;
        }

        await setupTrackPlayerIfNeeded();

        const currentRequestId = ++playRequestIdRef.current;

        try {
            // Update queue with bounded window (max 100)
            let updatedQueue = queueRef.current;
            if (queueList && queueList.length > 0) {
                const { queue: boundedQ } = createQueueWindow<PlayableSong>(
                    queueList,
                    song.id,
                );
                updatedQueue = boundedQ;
                setQueue(boundedQ);
            } else if (!queueRef.current.some((s) => s.id === song.id)) {
                updatedQueue = [song, ...queueRef.current.slice(0, MAX_QUEUE_SIZE - 1)];
                setQueue(updatedQueue);
            }

            const effectiveSong: PlayableSong = localDownloaded
                ? {
                      ...song,
                      stream_url: localDownloaded.local_audio_path,
                      cover_art_url:
                          localDownloaded.local_cover_path ||
                          song.cover_art_url,
                  }
                : song;

            setCurrentSong(effectiveSong);
            currentSongRef.current = effectiveSong;

            let trackUrl: string;
            let trackType: TrackType;
            let trackHeaders: Record<string, string> | undefined;

            if (localDownloaded) {
                // Single local audio file (mp3/aac)
                trackUrl = localDownloaded.local_audio_path;
                trackType = TrackType.Default;
                trackHeaders = undefined;
            } else {
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
                const isHls = streamUrl.includes(".m3u8");

                trackUrl = streamUrl;
                trackType = isHls ? TrackType.HLS : TrackType.Default;
                trackHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
            }

            const artworkUri =
                localDownloaded?.local_cover_path ||
                (song.cover_art_url && song.cover_art_url.startsWith("http")
                    ? song.cover_art_url
                    : undefined);

            const track: Track = {
                id: String(song.id),
                url: trackUrl,
                type: trackType,
                title: song.title || "Unknown Title",
                artist: song.artist || "Unknown Artist",
                album: song.album || "Music Cloud",
                artwork: artworkUri,
                duration: (song as SongDetail).duration_sec || localDownloaded?.duration_sec || 0,
                headers: trackHeaders,
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
                currentSong: effectiveSong,
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
        const isCurrentDownloaded = currentSongRef.current
            ? await downloadService.isSongDownloaded(currentSongRef.current.id)
            : false;

        if (!isCurrentDownloaded && !authRef.current.isAuthenticated) {
            authRef.current.openAuthModal();
            return;
        }

        const state = await TrackPlayer.getPlaybackState().catch(() => null);
        const activeTrack = await TrackPlayer.getActiveTrack().catch(
            () => null,
        );

        if (
            !state ||
            !activeTrack ||
            state.state === State.None ||
            state.state === State.Stopped ||
            state.state === State.Error
        ) {
            if (currentSongRef.current) {
                await playSong(
                    currentSongRef.current,
                    queueRef.current,
                    progress.position,
                );
            }
            return;
        }

        // If current song is downloaded, but the active track URL is not local (e.g. was streaming previously),
        // re-play using the local audio file immediately.
        if (
            isCurrentDownloaded &&
            activeTrack &&
            !activeTrack.url.startsWith("file://")
        ) {
            if (currentSongRef.current) {
                await playSong(
                    currentSongRef.current,
                    queueRef.current,
                    progress.position,
                );
                return;
            }
        }

        if (state.state === State.Playing) {
            await TrackPlayer.pause();
        } else {
            await TrackPlayer.play();
        }
    };

    const seek = async (seconds: number) => {
        try {
            const targetSec = Math.max(
                0,
                Math.min(seconds, progress.duration || 0),
            );
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
        await TrackPlayer.setVolume(nextMuted ? 0 : volumeRef.current).catch(
            () => {},
        );
    };

    const toggleRepeatMode = () => {
        const nextMode: RepeatMode =
            repeatMode === "off"
                ? "all"
                : repeatMode === "all"
                  ? "one"
                  : "off";
        setRepeatMode(nextMode);
        repeatModeRef.current = nextMode;
        const nextLoop = nextMode === "one";
        setIsLoop(nextLoop);
        isLoopRef.current = nextLoop;
        saveState({ repeatMode: nextMode, isLoop: nextLoop });
    };

    const toggleLoop = () => {
        toggleRepeatMode();
    };

    const toggleShuffle = () => {
        const nextShuffle = !isShuffle;
        setIsShuffle(nextShuffle);
        isShuffleRef.current = nextShuffle;
        if (!nextShuffle) {
            shuffleHistoryRef.current = [];
        }
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

    const addToQueue = (song: PlayableSong, position: QueuePriority = "end") => {
        const nextQ = addTrackWithPriority(
            queueRef.current,
            song,
            currentSongRef.current?.id,
            position,
            MAX_QUEUE_SIZE,
        );
        queueRef.current = nextQ;
        setQueue(nextQ);
        saveState({ queue: nextQ });
    };

    const removeFromQueue = (songId: string) => {
        const nextQ = removeTrackFromQueue(queueRef.current, songId);
        queueRef.current = nextQ;
        setQueue(nextQ);
        saveState({ queue: nextQ });
    };

    const syncCollectionQueue = (
        collectionId: string,
        newSongs: PlayableSong[],
    ) => {
        const currentId = currentCollectionIdRef.current;
        if (!currentId || !collectionId || !newSongs || newSongs.length === 0) {
            return;
        }
        const normalize = (id: string) => id.toLowerCase().replace(/[\s_]+/g, "-");
        const isMatch =
            currentId === collectionId ||
            currentId.toLowerCase() === collectionId.toLowerCase() ||
            normalize(currentId) === normalize(collectionId);

        if (!isMatch) {
            return;
        }
        const nextQ = appendWithLimit(
            queueRef.current,
            newSongs,
            currentSongRef.current?.id,
            MAX_QUEUE_SIZE,
        );
        queueRef.current = nextQ;
        setQueue(nextQ);
        saveState({ queue: nextQ });
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
                repeatMode,
                isShuffle,
                currentCollectionId,
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
                toggleRepeatMode,
                toggleShuffle,
                toggleLike,
                addToQueue,
                removeFromQueue,
                syncCollectionQueue,
                clearPlayer,
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
