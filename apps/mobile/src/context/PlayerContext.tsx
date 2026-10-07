import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SongMetadata, SongDetail } from '@music-cloud/types';
import { streamService } from '../services/streamService';
import { playlistService } from '../services/playlistService';
import { useAuth } from './AuthContext';
import { appConfig } from '../config';

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

function appendTokenToUrl(rawUrl: string, token: string | null): string {
  if (!token || !rawUrl) return rawUrl;
  const separator = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${separator}token=${encodeURIComponent(token)}`;
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
  playSong: (song: PlayableSong, queueList?: PlayableSong[], initialSeekTime?: number) => Promise<void>;
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

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, openAuthModal } = useAuth();

  const [currentSong, setCurrentSong] = useState<PlayableSong | null>(null);
  const [queue, setQueue] = useState<PlayableSong[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(appConfig.player.default_volume);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoop, setIsLoop] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isLikeLoading, setIsLikeLoading] = useState<boolean>(false);

  // Modals state
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState<boolean>(false);
  const [playlistModalSong, setPlaylistModalSong] = useState<SongMetadata | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const currentSongRef = useRef<PlayableSong | null>(null);
  const queueRef = useRef<PlayableSong[]>(queue);
  const isLoopRef = useRef<boolean>(isLoop);
  const isShuffleRef = useRef<boolean>(isShuffle);
  const volumeRef = useRef<number>(volume);
  const isMutedRef = useRef<boolean>(isMuted);

  // Sync refs
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { isLoopRef.current = isLoop; }, [isLoop]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // Configure Audio session mode for background playback
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    }).catch((err) => {
      console.warn('Failed to set audio mode:', err);
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
        const raw = await AsyncStorage.getItem(appConfig.storageKeys.playerState);
        if (raw) {
          const parsed: SavedPlayerState = JSON.parse(raw);
          if (parsed?.currentSong) {
            setCurrentSong(parsed.currentSong);
            setQueue(parsed.queue || [parsed.currentSong]);
            setCurrentTime(parsed.currentTime || 0);
            setDuration(parsed.duration || 0);
            setVolumeState(parsed.volume ?? appConfig.player.default_volume);
            setIsLoop(Boolean(parsed.isLoop));
            setIsShuffle(Boolean(parsed.isShuffle));
          }
        }
      } catch (e) {
        console.warn('Failed to load player state from storage:', e);
      }
    })();
  }, []);

  // Save player state changes
  const saveState = useCallback(async (overrides?: Partial<SavedPlayerState>) => {
    if (!currentSongRef.current) return;
    try {
      const stateToSave: SavedPlayerState = {
        currentSong: overrides?.currentSong || currentSongRef.current,
        queue: overrides?.queue || queueRef.current,
        currentTime: overrides?.currentTime ?? 0,
        duration: overrides?.duration ?? 0,
        volume: overrides?.volume ?? volumeRef.current,
        isShuffle: overrides?.isShuffle ?? isShuffleRef.current,
        isLoop: overrides?.isLoop ?? isLoopRef.current,
      };
      await AsyncStorage.setItem(appConfig.storageKeys.playerState, JSON.stringify(stateToSave));
    } catch {
      // Ignore write errors
    }
  }, []);

  // Fetch liked status when current song changes
  useEffect(() => {
    if (!currentSong || !isAuthenticated) {
      setIsLiked(false);
      return;
    }

    let active = true;
    setIsLikeLoading(true);

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
    const q = queueRef.current;
    if (q.length === 0) return;

    const currentIdx = q.findIndex((s) => s.id === currentSongRef.current?.id);
    let nextIdx = 0;

    if (isShuffleRef.current && q.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * q.length);
      } while (nextIdx === currentIdx);
    } else {
      nextIdx = (currentIdx + 1) % q.length;
    }

    const nextSong = q[nextIdx];
    if (nextSong) {
      await playSong(nextSong, q, 0);
    }
  }, []);

  const handlePlaybackStatusUpdate = useCallback((status: AudioStatus) => {
    setIsPlaying(status.playing);
    setCurrentTime(status.currentTime);
    if (status.duration > 0) {
      setDuration(status.duration);
    }

    if (status.didJustFinish) {
      if (isLoopRef.current) {
        playerRef.current?.seekTo(0);
        playerRef.current?.play();
      } else {
        handleNextTrack();
      }
    }
  }, [handleNextTrack]);

  const playSong = async (
    song: PlayableSong,
    queueList?: PlayableSong[],
    initialSeekTime = 0
  ) => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

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

      if (isSameSong && playerRef.current) {
        if (initialSeekTime > 0) {
          await playerRef.current.seekTo(initialSeekTime);
        } else {
          await playerRef.current.seekTo(0);
        }
        playerRef.current.play();
        setIsPlaying(true);
        return;
      }

      // Stop & remove previous player
      if (playerRef.current) {
        try {
          playerRef.current.remove();
        } catch {}
        playerRef.current = null;
      }

      // Get valid streaming token
      const token = await streamService.getValidStreamToken();
      const rawStreamUrl =
        song.stream_url ||
        (song as SongDetail).master_aac_key ||
        (song as SongDetail).master_mp3_key;

      if (!rawStreamUrl) {
        console.error('No stream URL available for song:', song.id);
        setIsPlaying(false);
        return;
      }

      const streamUrl = appendTokenToUrl(rawStreamUrl, token);

      const player = createAudioPlayer(streamUrl, {
        updateInterval: 400,
      });

      player.volume = isMutedRef.current ? 0 : volumeRef.current;
      player.loop = isLoopRef.current;

      player.addListener('playbackStatusUpdate', handlePlaybackStatusUpdate);

      // Support Lock Screen & System notifications
      player.setActiveForLockScreen(true, {
        title: song.title,
        artist: song.artist,
        artworkUrl: song.cover_art_url || undefined,
      });

      if (initialSeekTime > 0) {
        await player.seekTo(initialSeekTime);
      }

      player.play();
      playerRef.current = player;
      setIsPlaying(true);

      saveState({
        currentSong: song,
        queue: updatedQueue,
        currentTime: initialSeekTime,
        duration: targetDuration,
      });
    } catch (err) {
      console.error('Failed to play song:', err);
      setIsPlaying(false);
    }
  };

  const togglePlay = async () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    if (!playerRef.current) {
      if (currentSongRef.current) {
        await playSong(currentSongRef.current, queueRef.current, currentTime);
      }
      return;
    }

    try {
      if (playerRef.current.playing) {
        playerRef.current.pause();
        setIsPlaying(false);
      } else {
        playerRef.current.play();
        setIsPlaying(true);
      }
    } catch (e) {
      console.warn('Toggle play error:', e);
    }
  };

  const handlePrevTrack = async () => {
    const q = queueRef.current;
    if (q.length === 0) return;

    if (currentTime > 3 && playerRef.current) {
      await playerRef.current.seekTo(0);
      return;
    }

    const currentIdx = q.findIndex((s) => s.id === currentSongRef.current?.id);
    const prevIdx = (currentIdx - 1 + q.length) % q.length;
    const prevSong = q[prevIdx];
    if (prevSong) {
      await playSong(prevSong, q, 0);
    }
  };

  const seek = async (seconds: number) => {
    if (!playerRef.current) return;
    try {
      const targetSec = Math.max(0, Math.min(seconds, duration));
      await playerRef.current.seekTo(targetSec);
      setCurrentTime(targetSec);
    } catch (err) {
      console.warn('Seek error:', err);
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
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => !prev);
  };

  const toggleLike = async () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    if (!currentSong || isLikeLoading) return;

    setIsLikeLoading(true);
    try {
      const res = await playlistService.toggleLikeSong(currentSong.id);
      setIsLiked(res.liked);
    } catch (e) {
      console.warn('Toggle like error:', e);
    } finally {
      setIsLikeLoading(false);
    }
  };

  const addToQueue = (song: PlayableSong) => {
    setQueue((prev) => (prev.some((s) => s.id === song.id) ? prev : [...prev, song]));
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
        openNowPlaying: () => setIsNowPlayingOpen(true),
        closeNowPlaying: () => setIsNowPlayingOpen(false),
        openPlaylistModal: (song: SongMetadata) => setPlaylistModalSong(song),
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
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
