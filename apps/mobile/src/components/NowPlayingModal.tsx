import React, { useState, useRef, useEffect, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Animated,
    PanResponder,
    BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { formatTime } from "@music-cloud/utils";
import type { SongMetadata } from "@music-cloud/types";
import { songService } from "@music-cloud/services";
import { usePlayer, type PlayableSong } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { SongCoverArt } from "./SongCoverArt";
import { SongActionSheet } from "./SongActionSheet";
import { appConfig } from "../config";

const { width, height } = Dimensions.get("window");
const HORIZONTAL_PADDING = 28;
const CONTENT_WIDTH = width - HORIZONTAL_PADDING * 2;

export const NowPlayingModal: React.FC = () => {
    const insets = useSafeAreaInsets();
    const { isAuthenticated, openAuthModal } = useAuth();
    const {
        currentSong,
        queue,
        isPlaying,
        currentTime,
        duration,
        isLoop,
        isShuffle,
        isLiked,
        isNowPlayingOpen,
        playSong,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        toggleLoop,
        toggleShuffle,
        toggleLike,
        closeNowPlaying,
        openPlaylistModal,
    } = usePlayer();

    // Fallback queue if queue from player has only 1 song or is empty
    const [fallbackQueue, setFallbackQueue] = useState<PlayableSong[]>([]);

    useEffect(() => {
        if (queue.length <= 1) {
            songService
                .getAllSongs(appConfig.songs_limit)
                .then((res) => {
                    const all = res?.songs;
                    if (Array.isArray(all) && all.length > 1) {
                        setFallbackQueue(all);
                    }
                })
                .catch(() => {});
        }
    }, [queue.length]);

    const effectiveQueue = queue.length > 1 ? queue : fallbackQueue;

    // Displayed song for seamless transition without flickering
    const [displaySong, setDisplaySong] = useState<PlayableSong | null>(
        currentSong,
    );
    const [pageIndex, setPageIndex] = useState(0);
    const pageIndexRef = useRef(0);
    const isSwipeTransitionRef = useRef(false);

    // Sync displaySong when currentSong changes externally (e.g. Next button, Lock Screen)
    useEffect(() => {
        if (!currentSong) return;

        if (isSwipeTransitionRef.current) {
            // Handled seamlessly by swipe gesture; keep virtual page position intact
            isSwipeTransitionRef.current = false;
            setDisplaySong(currentSong);
            return;
        }

        // External track change: reset carousel to center
        if (!displaySong || currentSong.id !== displaySong.id) {
            setDisplaySong(currentSong);
            pageIndexRef.current = 0;
            setPageIndex(0);
            slideX.setValue(0);
        }
    }, [currentSong?.id]);

    // Preserve song during close transition to prevent visual flash
    const lastSongRef = useRef<SongMetadata | null>(currentSong);
    if (displaySong || currentSong) {
        lastSongRef.current = (displaySong || currentSong) as SongMetadata;
    }
    const song = (displaySong ||
        currentSong ||
        lastSongRef.current) as SongMetadata | null;

    // Up Next & Previous song computation
    const currentIdx = effectiveQueue.findIndex((s) => s.id === song?.id);
    const hasMultipleSongs = effectiveQueue.length > 1 && currentIdx !== -1;

    const nextSong = useMemo(() => {
        if (!hasMultipleSongs) return null;
        if (isShuffle && effectiveQueue.length > 2) {
            const candidates = effectiveQueue.filter(
                (_, idx) => idx !== currentIdx,
            );
            return (
                candidates[Math.floor(Math.random() * candidates.length)] ||
                effectiveQueue[(currentIdx + 1) % effectiveQueue.length]
            );
        }
        return effectiveQueue[(currentIdx + 1) % effectiveQueue.length];
    }, [song?.id, effectiveQueue, isShuffle, currentIdx, hasMultipleSongs]);

    const prevSong = useMemo(() => {
        if (!hasMultipleSongs) return null;
        return effectiveQueue[
            (currentIdx - 1 + effectiveQueue.length) % effectiveQueue.length
        ];
    }, [song?.id, effectiveQueue, currentIdx, hasMultipleSongs]);

    const [isSliding, setIsSliding] = useState(false);
    const [slidingValue, setSlidingValue] = useState(0);
    const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

    // Stable Scrubber measurements (prevents coordinate jumping and flickering)
    const scrubberRef = useRef<View>(null);
    const scrubberPageXRef = useRef<number>(HORIZONTAL_PADDING);
    const sliderWidthRef = useRef<number>(CONTENT_WIDTH);
    const slidingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );

    useEffect(() => {
        return () => {
            if (slidingTimeoutRef.current) {
                clearTimeout(slidingTimeoutRef.current);
            }
        };
    }, []);

    const measureScrubber = () => {
        scrubberRef.current?.measure((_x, _y, w, _h, pageX) => {
            if (typeof pageX === "number" && !isNaN(pageX) && pageX > 0) {
                scrubberPageXRef.current = pageX;
            }
            if (typeof w === "number" && w > 0) {
                sliderWidthRef.current = w;
            }
        });
    };

    const handleSeekTouch = (pageX: number) => {
        const sw = sliderWidthRef.current || CONTENT_WIDTH;
        const relX = pageX - scrubberPageXRef.current;
        const ratio = Math.max(0, Math.min(1, relX / sw));
        const targetSec = ratio * (duration || 100);
        setSlidingValue(targetSec);
        return targetSec;
    };

    // Dynamic cover size: matches exact content width on standard phones,
    // gracefully constrained if remaining vertical height is restricted
    const estimatedNonCoverHeight =
        insets.top + Math.max(insets.bottom, 20) + 360;
    const maxCoverHeight = Math.max(200, height - estimatedNonCoverHeight);
    const coverSize = Math.min(CONTENT_WIDTH, maxCoverHeight);

    // Vertical translateY translation for native-speed sheet animation
    const panY = useRef(new Animated.Value(height)).current;
    // Horizontal translateX translation for gallery carousel slide animation
    const slideX = useRef(new Animated.Value(0)).current;

    const isTransitioningRef = useRef(false);
    const activeArtworkGestureRef = useRef<"none" | "horizontal" | "vertical">(
        "none",
    );

    // Mutable refs to prevent stale closures in PanResponder
    const nextSongRef = useRef(nextSong);
    nextSongRef.current = nextSong;

    const prevSongRef = useRef(prevSong);
    prevSongRef.current = prevSong;

    const effectiveQueueRef = useRef(effectiveQueue);
    effectiveQueueRef.current = effectiveQueue;

    const coverSizeRef = useRef(coverSize);
    coverSizeRef.current = coverSize;

    const playSongRef = useRef(playSong);
    playSongRef.current = playSong;

    const handleCloseRef = useRef<() => void>(() => {});

    // Handle smooth dismiss
    const handleClose = () => {
        Animated.timing(panY, {
            toValue: height,
            duration: 220,
            useNativeDriver: true,
        }).start(() => {
            closeNowPlaying();
        });
    };
    handleCloseRef.current = handleClose;

    // Slide up when opened, slide down when closed
    useEffect(() => {
        if (isNowPlayingOpen) {
            pageIndexRef.current = 0;
            setPageIndex(0);
            slideX.setValue(0);
            Animated.spring(panY, {
                toValue: 0,
                damping: 28,
                mass: 0.8,
                stiffness: 220,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(panY, {
                toValue: height,
                duration: 220,
                useNativeDriver: true,
            }).start();
        }
    }, [isNowPlayingOpen]);

    // Android hardware back button handler
    useEffect(() => {
        if (!isNowPlayingOpen) return;
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            handleClose();
            return true;
        });
        return () => sub.remove();
    }, [isNowPlayingOpen]);

    // PanResponder for Header: vertical downward swipe-to-close gesture
    const headerPanResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                const { dx, dy } = gestureState;
                return dy > 8 && dy > Math.abs(dx);
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                const { dy, vy } = gestureState;
                if (dy > 110 || vy > 0.45) {
                    handleCloseRef.current();
                } else {
                    Animated.spring(panY, {
                        toValue: 0,
                        damping: 24,
                        stiffness: 240,
                        useNativeDriver: true,
                    }).start();
                }
            },
            onPanResponderTerminate: () => {
                Animated.spring(panY, {
                    toValue: 0,
                    damping: 24,
                    stiffness: 240,
                    useNativeDriver: true,
                }).start();
            },
        }),
    ).current;

    // PanResponder for Artwork Area:
    // - Edge-to-edge horizontal slide (left for next song, right for prev song)
    // - Visible upcoming album art gallery slideshow
    // - Jump to song if visible > 40% (or quick flick)
    // - Downward vertical swipe to dismiss modal
    const artworkPanResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                if (isTransitioningRef.current) return false;
                const { dx, dy } = gestureState;
                const isHorizontal =
                    Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy);
                const isVerticalDown = dy > 8 && dy > Math.abs(dx);
                return isHorizontal || isVerticalDown;
            },
            onPanResponderGrant: (_, gestureState) => {
                const { dx, dy } = gestureState;
                if (Math.abs(dx) > Math.abs(dy)) {
                    activeArtworkGestureRef.current = "horizontal";
                } else if (dy > 0) {
                    activeArtworkGestureRef.current = "vertical";
                } else {
                    activeArtworkGestureRef.current = "none";
                }
            },
            onPanResponderMove: (_, gestureState) => {
                if (isTransitioningRef.current) return;
                const { dx, dy } = gestureState;

                if (activeArtworkGestureRef.current === "none") {
                    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
                        activeArtworkGestureRef.current = "horizontal";
                    } else if (dy > Math.abs(dx) && dy > 6) {
                        activeArtworkGestureRef.current = "vertical";
                    }
                }

                if (activeArtworkGestureRef.current === "horizontal") {
                    const targetNext = nextSongRef.current;
                    const targetPrev = prevSongRef.current;
                    const baseTranslate = -pageIndexRef.current * width;

                    // Clamped resistance if no adjacent song
                    if (dx < 0 && !targetNext) {
                        slideX.setValue(
                            baseTranslate + Math.max(-width * 0.25, dx * 0.25),
                        );
                    } else if (dx > 0 && !targetPrev) {
                        slideX.setValue(
                            baseTranslate + Math.min(width * 0.25, dx * 0.25),
                        );
                    } else {
                        slideX.setValue(
                            baseTranslate +
                                Math.max(-width, Math.min(width, dx)),
                        );
                    }
                } else if (activeArtworkGestureRef.current === "vertical") {
                    if (dy > 0) {
                        panY.setValue(dy);
                    }
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                const gesture = activeArtworkGestureRef.current;
                activeArtworkGestureRef.current = "none";

                if (gesture === "horizontal") {
                    const { dx, vx } = gestureState;
                    const targetNext = nextSongRef.current;
                    const targetPrev = prevSongRef.current;
                    const currentQueue = effectiveQueueRef.current;
                    const currentCover = coverSizeRef.current;
                    const currentPage = pageIndexRef.current;
                    const baseTranslate = -currentPage * width;

                    // Exact 40% visibility threshold:
                    // padding between slot edge and cover art = (width - currentCover) / 2
                    // threshold = padding + 40% of coverSize
                    const slotCoverPadding = (width - currentCover) / 2;
                    const threshold40Percent =
                        slotCoverPadding + currentCover * 0.4;

                    const shouldGoNext =
                        !!targetNext &&
                        (dx < -threshold40Percent || (vx < -0.45 && dx < -30));
                    const shouldGoPrev =
                        !!targetPrev &&
                        (dx > threshold40Percent || (vx > 0.45 && dx > 30));

                    if (shouldGoNext && targetNext) {
                        isTransitioningRef.current = true;
                        isSwipeTransitionRef.current = true;
                        const targetTranslate = -(currentPage + 1) * width;
                        Animated.timing(slideX, {
                            toValue: targetTranslate,
                            duration: 180,
                            useNativeDriver: true,
                        }).start(async () => {
                            const newPage = currentPage + 1;
                            pageIndexRef.current = newPage;
                            setPageIndex(newPage);
                            setDisplaySong(targetNext);
                            isTransitioningRef.current = false;
                            await playSongRef.current(
                                targetNext,
                                currentQueue,
                                0,
                            );
                        });
                    } else if (shouldGoPrev && targetPrev) {
                        isTransitioningRef.current = true;
                        isSwipeTransitionRef.current = true;
                        const targetTranslate = -(currentPage - 1) * width;
                        Animated.timing(slideX, {
                            toValue: targetTranslate,
                            duration: 180,
                            useNativeDriver: true,
                        }).start(async () => {
                            const newPage = currentPage - 1;
                            pageIndexRef.current = newPage;
                            setPageIndex(newPage);
                            setDisplaySong(targetPrev);
                            isTransitioningRef.current = false;
                            await playSongRef.current(
                                targetPrev,
                                currentQueue,
                                0,
                            );
                        });
                    } else {
                        Animated.spring(slideX, {
                            toValue: baseTranslate,
                            damping: 24,
                            stiffness: 240,
                            useNativeDriver: true,
                        }).start();
                    }
                } else if (gesture === "vertical") {
                    const { dy, vy } = gestureState;
                    if (dy > 110 || vy > 0.45) {
                        handleCloseRef.current();
                    } else {
                        Animated.spring(panY, {
                            toValue: 0,
                            damping: 24,
                            stiffness: 240,
                            useNativeDriver: true,
                        }).start();
                    }
                } else {
                    const baseTranslate = -pageIndexRef.current * width;
                    Animated.spring(slideX, {
                        toValue: baseTranslate,
                        damping: 24,
                        stiffness: 240,
                        useNativeDriver: true,
                    }).start();
                    Animated.spring(panY, {
                        toValue: 0,
                        damping: 24,
                        stiffness: 240,
                        useNativeDriver: true,
                    }).start();
                }
            },
            onPanResponderTerminate: () => {
                activeArtworkGestureRef.current = "none";
                const baseTranslate = -pageIndexRef.current * width;
                Animated.spring(slideX, {
                    toValue: baseTranslate,
                    damping: 24,
                    stiffness: 240,
                    useNativeDriver: true,
                }).start();
                Animated.spring(panY, {
                    toValue: 0,
                    damping: 24,
                    stiffness: 240,
                    useNativeDriver: true,
                }).start();
            },
        }),
    ).current;

    if (!song) return null;

    // Scrubber calculations (sleek 12px circular thumb)
    const displayTime = isSliding ? slidingValue : currentTime;
    const progressPercent =
        duration > 0
            ? Math.min(100, Math.max(0, (displayTime / duration) * 100))
            : 0;

    return (
        <>
            <Animated.View
                pointerEvents={isNowPlayingOpen ? "auto" : "none"}
                style={[
                    styles.sheetContainer,
                    {
                        transform: [{ translateY: panY }],
                    },
                ]}
            >
                <LinearGradient
                    colors={["#2c2c2c", "#1a1a1a", "#121212"]}
                    style={styles.gradientContainer}
                >
                    <View
                        style={[
                            styles.content,
                            {
                                paddingTop:
                                    insets.top > 0 ? insets.top + 6 : 14,
                                paddingBottom: Math.max(insets.bottom, 20),
                            },
                        ]}
                    >
                        {/* Upper Section: Header Bar & Vertically Centered Artwork (Edge-to-Edge Swipe Area) */}
                        <View style={styles.topSection}>
                            {/* Top Header Bar */}
                            <View
                                style={styles.header}
                                {...headerPanResponder.panHandlers}
                            >
                                <TouchableOpacity
                                    onPress={handleClose}
                                    style={styles.headerBtn}
                                    hitSlop={{
                                        top: 14,
                                        bottom: 14,
                                        left: 14,
                                        right: 14,
                                    }}
                                >
                                    <Ionicons
                                        name="chevron-down"
                                        size={24}
                                        color="#ffffff"
                                    />
                                </TouchableOpacity>

                                <View style={styles.headerTitleBox}>
                                    <Text style={styles.headerSubtitle}>
                                        PLAYING FROM LIBRARY
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setIsActionSheetOpen(true)}
                                    style={styles.headerBtn}
                                    hitSlop={{
                                        top: 14,
                                        bottom: 14,
                                        left: 14,
                                        right: 14,
                                    }}
                                >
                                    <Ionicons
                                        name="ellipsis-horizontal"
                                        size={24}
                                        color="#ffffff"
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Vertically Centered Artwork Section - Edge to Edge Gallery Carousel */}
                            <View
                                style={styles.artworkSection}
                                {...artworkPanResponder.panHandlers}
                            >
                                <Animated.View
                                    style={[
                                        styles.carouselTrack,
                                        {
                                            transform: [{ translateX: slideX }],
                                        },
                                    ]}
                                >
                                    {/* Previous Song Slot */}
                                    <View
                                        key={`page-${pageIndex - 1}`}
                                        style={[
                                            styles.slideSlot,
                                            { left: (pageIndex - 1) * width },
                                        ]}
                                    >
                                        {prevSong ? (
                                            <SongCoverArt
                                                src={prevSong.cover_art_url}
                                                size={coverSize}
                                                borderRadius={6}
                                                iconSize={72}
                                                transition={0}
                                                style={styles.coverArt}
                                            />
                                        ) : null}
                                    </View>

                                    {/* Current Song Slot */}
                                    <View
                                        key={`page-${pageIndex}`}
                                        style={[
                                            styles.slideSlot,
                                            { left: pageIndex * width },
                                        ]}
                                    >
                                        <SongCoverArt
                                            src={song.cover_art_url}
                                            size={coverSize}
                                            borderRadius={6}
                                            iconSize={72}
                                            transition={0}
                                            style={styles.coverArt}
                                        />
                                    </View>

                                    {/* Next Song Slot */}
                                    <View
                                        key={`page-${pageIndex + 1}`}
                                        style={[
                                            styles.slideSlot,
                                            { left: (pageIndex + 1) * width },
                                        ]}
                                    >
                                        {nextSong ? (
                                            <SongCoverArt
                                                src={nextSong.cover_art_url}
                                                size={coverSize}
                                                borderRadius={6}
                                                iconSize={72}
                                                transition={0}
                                                style={styles.coverArt}
                                            />
                                        ) : null}
                                    </View>
                                </Animated.View>
                            </View>
                        </View>

                        {/* Bottom Section: Ergonomic One-Hand Accessible Controls with Equal Spacing */}
                        <View style={styles.bottomControlsContainer}>
                            {/* Tier 1: Track Details & Actions (Heart + Add to Playlist) */}
                            <View style={styles.metaRow}>
                                <View style={styles.metaText}>
                                    <Text
                                        style={styles.title}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                    >
                                        {song.title}
                                    </Text>
                                    <Text
                                        style={styles.artist}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                    >
                                        {song.artist}
                                    </Text>
                                </View>

                                <View style={styles.metaActions}>
                                    {/* Like Button (Heart) */}
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (!isAuthenticated) {
                                                openAuthModal();
                                                return;
                                            }
                                            toggleLike();
                                        }}
                                        style={styles.metaActionBtn}
                                        hitSlop={{
                                            top: 12,
                                            bottom: 12,
                                            left: 8,
                                            right: 8,
                                        }}
                                    >
                                        <Ionicons
                                            name={
                                                isLiked
                                                    ? "heart"
                                                    : "heart-outline"
                                            }
                                            size={26}
                                            color={
                                                isLiked
                                                    ? appConfig.colors
                                                          .accentGreen
                                                    : "#ffffff"
                                            }
                                        />
                                    </TouchableOpacity>

                                    {/* Add to Playlist Button */}
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (!isAuthenticated) {
                                                openAuthModal();
                                                return;
                                            }
                                            openPlaylistModal(song);
                                        }}
                                        style={styles.metaActionBtn}
                                        hitSlop={{
                                            top: 12,
                                            bottom: 12,
                                            left: 8,
                                            right: 8,
                                        }}
                                    >
                                        <Ionicons
                                            name="add-circle-outline"
                                            size={28}
                                            color="#ffffff"
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Tier 2: Scrubber / Seeker */}
                            <View style={styles.sliderContainer}>
                                <View
                                    ref={scrubberRef}
                                    style={styles.scrubberTouchArea}
                                    onLayout={measureScrubber}
                                    onStartShouldSetResponder={() => true}
                                    onMoveShouldSetResponder={() => true}
                                    onResponderGrant={(e) => {
                                        measureScrubber();
                                        if (slidingTimeoutRef.current) {
                                            clearTimeout(
                                                slidingTimeoutRef.current,
                                            );
                                        }
                                        setIsSliding(true);
                                        handleSeekTouch(e.nativeEvent.pageX);
                                    }}
                                    onResponderMove={(e) => {
                                        handleSeekTouch(e.nativeEvent.pageX);
                                    }}
                                    onResponderRelease={async (e) => {
                                        const targetSec = handleSeekTouch(
                                            e.nativeEvent.pageX,
                                        );
                                        await seek(targetSec);
                                        if (slidingTimeoutRef.current) {
                                            clearTimeout(
                                                slidingTimeoutRef.current,
                                            );
                                        }
                                        slidingTimeoutRef.current = setTimeout(
                                            () => {
                                                setIsSliding(false);
                                            },
                                            200,
                                        );
                                    }}
                                    onResponderTerminate={() => {
                                        setIsSliding(false);
                                    }}
                                >
                                    <View
                                        pointerEvents="none"
                                        style={styles.scrubberTrackBg}
                                    >
                                        <View
                                            style={[
                                                styles.scrubberTrackActive,
                                                {
                                                    width: `${progressPercent}%`,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <View
                                        pointerEvents="none"
                                        style={[
                                            styles.scrubberThumb,
                                            { left: `${progressPercent}%` },
                                        ]}
                                    />
                                </View>

                                <View style={styles.timeRow}>
                                    <Text style={styles.timeText}>
                                        {formatTime(displayTime)}
                                    </Text>
                                    <Text style={styles.timeText}>
                                        {formatTime(duration)}
                                    </Text>
                                </View>
                            </View>

                            {/* Tier 3: Playback Controls (Shuffle, Prev, Play/Pause, Next, Loop) */}
                            <View style={styles.controlsRow}>
                                {/* Shuffle */}
                                <TouchableOpacity
                                    onPress={toggleShuffle}
                                    style={styles.controlBtn}
                                    hitSlop={{
                                        top: 14,
                                        bottom: 14,
                                        left: 14,
                                        right: 14,
                                    }}
                                >
                                    <Ionicons
                                        name="shuffle"
                                        size={24}
                                        color={
                                            isShuffle
                                                ? appConfig.colors.accentGreen
                                                : appConfig.colors.subText
                                        }
                                    />
                                    {isShuffle && (
                                        <View style={styles.activeDot} />
                                    )}
                                </TouchableOpacity>

                                {/* Previous Track */}
                                <TouchableOpacity
                                    onPress={prevTrack}
                                    style={styles.controlBtn}
                                    hitSlop={{
                                        top: 14,
                                        bottom: 14,
                                        left: 14,
                                        right: 14,
                                    }}
                                >
                                    <Ionicons
                                        name="play-skip-back"
                                        size={28}
                                        color="#ffffff"
                                    />
                                </TouchableOpacity>

                                {/* Play / Pause Button */}
                                <TouchableOpacity
                                    onPress={togglePlay}
                                    activeOpacity={0.85}
                                    style={styles.playPauseBtn}
                                >
                                    <Ionicons
                                        name={isPlaying ? "pause" : "play"}
                                        size={30}
                                        color="#000000"
                                        style={{
                                            marginLeft: isPlaying ? 0 : 2,
                                        }}
                                    />
                                </TouchableOpacity>

                                {/* Next Track */}
                                <TouchableOpacity
                                    onPress={nextTrack}
                                    style={styles.controlBtn}
                                    hitSlop={{
                                        top: 14,
                                        bottom: 14,
                                        left: 14,
                                        right: 14,
                                    }}
                                >
                                    <Ionicons
                                        name="play-skip-forward"
                                        size={28}
                                        color="#ffffff"
                                    />
                                </TouchableOpacity>

                                {/* Loop / Repeat */}
                                <TouchableOpacity
                                    onPress={toggleLoop}
                                    style={styles.controlBtn}
                                    hitSlop={{
                                        top: 14,
                                        bottom: 14,
                                        left: 14,
                                        right: 14,
                                    }}
                                >
                                    <Ionicons
                                        name="repeat"
                                        size={24}
                                        color={
                                            isLoop
                                                ? appConfig.colors.accentGreen
                                                : appConfig.colors.subText
                                        }
                                    />
                                    {isLoop && (
                                        <View style={styles.activeDot} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Tier 4: Bottom Utility Row (Audio Device + Quick Playlist) */}
                            <View style={styles.bottomUtilityRow}>
                                <View style={styles.deviceRow}>
                                    <Ionicons
                                        name="headset"
                                        size={16}
                                        color={appConfig.colors.accentGreen}
                                    />
                                    <Text style={styles.deviceName}>
                                        Music Cloud Audio
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() => {
                                        if (!isAuthenticated) {
                                            openAuthModal();
                                            return;
                                        }
                                        openPlaylistModal(song);
                                    }}
                                    style={styles.bottomUtilBtn}
                                    hitSlop={{
                                        top: 10,
                                        bottom: 10,
                                        left: 10,
                                        right: 10,
                                    }}
                                >
                                    <Ionicons
                                        name="list"
                                        size={22}
                                        color={appConfig.colors.subText}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </LinearGradient>
            </Animated.View>

            {/* In-player Song Options Action Sheet */}
            <SongActionSheet
                visible={isActionSheetOpen}
                song={song}
                onClose={() => setIsActionSheetOpen(false)}
            />
        </>
    );
};

const styles = StyleSheet.create({
    sheetContainer: {
        ...StyleSheet.absoluteFill,
        zIndex: 1000,
        elevation: 20,
        backgroundColor: "#121212",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: "hidden",
    },
    gradientContainer: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        justifyContent: "space-between",
    },
    topSection: {
        flex: 1,
        width: width,
        marginHorizontal: -HORIZONTAL_PADDING,
    },
    header: {
        width: "100%",
        paddingHorizontal: HORIZONTAL_PADDING,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 4,
    },
    headerBtn: {
        padding: 4,
    },
    headerTitleBox: {
        alignItems: "center",
        flex: 1,
        paddingHorizontal: 12,
    },
    headerSubtitle: {
        color: appConfig.colors.subText,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1.2,
        textTransform: "uppercase",
    },
    artworkSection: {
        flex: 1,
        width: width,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    carouselTrack: {
        width: width,
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    slideSlot: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: width,
        justifyContent: "center",
        alignItems: "center",
    },
    coverArt: {
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 16,
    },
    bottomControlsContainer: {
        width: "100%",
        gap: 24,
        marginVertical: 6,
    },
    metaRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    metaText: {
        flex: 1,
        marginRight: 16,
    },
    title: {
        color: "#ffffff",
        fontSize: 22,
        fontWeight: "800",
        letterSpacing: -0.3,
        marginBottom: 2,
    },
    artist: {
        color: appConfig.colors.subText,
        fontSize: 15,
        fontWeight: "500",
    },
    metaActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
    },
    metaActionBtn: {
        padding: 4,
    },
    sliderContainer: {
        width: "100%",
    },
    scrubberTouchArea: {
        width: "100%",
        height: 28,
        justifyContent: "center",
    },
    scrubberTrackBg: {
        width: "100%",
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        overflow: "hidden",
    },
    scrubberTrackActive: {
        height: 4,
        borderRadius: 2,
        backgroundColor: "#ffffff",
    },
    scrubberThumb: {
        position: "absolute",
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#ffffff",
        marginLeft: -6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
        elevation: 3,
    },
    timeRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 2,
    },
    timeText: {
        color: appConfig.colors.subText,
        fontSize: 12,
        fontWeight: "500",
    },
    controlsRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    controlBtn: {
        padding: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    playPauseBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 8,
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: appConfig.colors.accentGreen,
        marginTop: 3,
        alignSelf: "center",
    },
    bottomUtilityRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 4,
        marginTop: 12,
    },
    deviceRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    deviceName: {
        color: appConfig.colors.accentGreen,
        fontSize: 12,
        fontWeight: "600",
    },
    bottomUtilBtn: {
        padding: 6,
    },
});
