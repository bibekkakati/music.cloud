import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { songService } from "@music-cloud/services";
import { getGreeting } from "@music-cloud/utils";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { SongCard } from "../components/SongCard";
import { appConfig } from "../config";
import type { SongMetadata } from "@music-cloud/types";

export const HomeScreen: React.FC = () => {
    const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
    const {
        isAuthenticated,
        isLoading: isAuthLoading,
        openAuthModal,
    } = useAuth();

    const [songs, setSongs] = useState<SongMetadata[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState<boolean>(false);

    const fetchSongs = useCallback(
        async (cursorVal?: string, append = false) => {
            if (!isAuthenticated) {
                setSongs([]);
                setCursor(undefined);
                setHasMore(false);
                setIsLoading(false);
                setIsRefreshing(false);
                setIsLoadingMore(false);
                return;
            }

            try {
                if (append) {
                    setIsLoadingMore(true);
                } else {
                    setIsLoading(true);
                }

                const data = await songService.getAllSongs(cursorVal);
                const songList = data?.songs || [];

                if (append) {
                    setSongs((prev) => {
                        const existingIds = new Set(prev.map((s) => s.id));
                        const uniqueNew = songList.filter(
                            (s) => !existingIds.has(s.id),
                        );
                        return [...prev, ...uniqueNew];
                    });
                } else {
                    setSongs(songList);
                }

                const nextCursor = data?.cursor;
                const hasValidCursor =
                    typeof nextCursor === "string" && nextCursor.trim() !== "";

                setHasMore(hasValidCursor);
                setCursor(hasValidCursor ? nextCursor.trim() : undefined);
            } catch (err) {
                console.warn("Failed to load songs:", err);
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
                setIsLoadingMore(false);
            }
        },
        [isAuthenticated],
    );

    useEffect(() => {
        fetchSongs();
    }, [fetchSongs]);

    const onRefresh = () => {
        setIsRefreshing(true);
        setCursor(undefined);
        fetchSongs(undefined, false);
    };

    const handleLoadMore = () => {
        if (!isLoadingMore && hasMore && cursor) {
            fetchSongs(cursor, true);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <View style={styles.container}>
                {/* Top Navbar Header */}
                <AppHeader />

                {!isAuthenticated && !isAuthLoading ? (
                    /* Unauthenticated Landing Experience */
                    <ScrollView
                        style={styles.landingScroll}
                        contentContainerStyle={styles.landingContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Hero Welcome Card */}
                        <LinearGradient
                            colors={["#1e3a8a", "#172554", "#121212"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.heroCard}
                        >
                            {/* Pill Badge */}
                            <View style={styles.heroBadge}>
                                <Ionicons
                                    name="radio"
                                    size={13}
                                    color={appConfig.colors.accentGreen}
                                />
                                <Text style={styles.heroBadgeText}>
                                    PRIVATE AUDIO CLOUD
                                </Text>
                            </View>

                            {/* Big Headline */}
                            <Text style={styles.heroHeadline}>
                                Listen to your private library without limits.
                            </Text>

                            {/* Subtitle */}
                            <Text style={styles.heroDesc}>
                                Stream pristine HLS audio segments straight from
                                edge workers. Sign in to browse all songs, build
                                custom playlists, and manage your library.
                            </Text>

                            {/* CTA Button */}
                            <TouchableOpacity
                                style={styles.heroCtaBtn}
                                onPress={openAuthModal}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name="log-in-outline"
                                    size={18}
                                    color="#000000"
                                />
                                <Text style={styles.heroCtaText}>
                                    Log in to Start Listening
                                </Text>
                            </TouchableOpacity>
                        </LinearGradient>

                        {/* Features Shelf */}
                        <View style={styles.featuresSection}>
                            <Text style={styles.featuresHeading}>Features</Text>

                            {/* Feature 1 */}
                            <View style={styles.featureCard}>
                                <Ionicons
                                    name="sparkles"
                                    size={26}
                                    color={appConfig.colors.accentGreen}
                                    style={styles.featureIcon}
                                />
                                <Text style={styles.featureTitle}>
                                    High-Fidelity HLS
                                </Text>
                                <Text style={styles.featureDesc}>
                                    Multi-bitrate AAC and MP3 audio stream
                                    segments cached at edge workers.
                                </Text>
                            </View>

                            {/* Feature 2 */}
                            <View style={styles.featureCard}>
                                <Ionicons
                                    name="musical-notes"
                                    size={26}
                                    color={appConfig.colors.accentGreen}
                                    style={styles.featureIcon}
                                />
                                <Text style={styles.featureTitle}>
                                    Custom Playlists
                                </Text>
                                <Text style={styles.featureDesc}>
                                    Create, organize, and manage custom
                                    playlists synced across all your devices.
                                </Text>
                            </View>

                            {/* Feature 3: Private & Secure */}
                            <View style={styles.featureCard}>
                                <Ionicons
                                    name="shield-checkmark"
                                    size={26}
                                    color={appConfig.colors.accentGreen}
                                    style={styles.featureIcon}
                                />
                                <Text style={styles.featureTitle}>
                                    Private & Secure
                                </Text>
                                <Text style={styles.featureDesc}>
                                    Edge-validated short-lived stream JWT tokens
                                    preventing unauthorized hotlinking.
                                </Text>
                            </View>
                        </View>
                    </ScrollView>
                ) : isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator
                            size="large"
                            color={appConfig.colors.accentGreen}
                        />
                    </View>
                ) : (
                    /* Authenticated Song Catalog */
                    <FlatList
                        data={songs}
                        keyExtractor={(item) => item.id}
                        numColumns={3}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={onRefresh}
                                tintColor={appConfig.colors.accentGreen}
                            />
                        }
                        ListHeaderComponent={
                            <View style={styles.shelfHeader}>
                                <Text style={styles.greetingText}>
                                    {getGreeting()}
                                </Text>

                                <View style={styles.shelfTitleRow}>
                                    <Text style={styles.shelfTitle}>
                                        Made For You
                                    </Text>
                                    <Text style={styles.shelfSubtitle}>
                                        Stream your private high-fidelity cloud
                                        audio catalog
                                    </Text>
                                </View>
                            </View>
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons
                                    name="musical-notes-outline"
                                    size={48}
                                    color={appConfig.colors.subText}
                                />
                                <Text style={styles.emptyText}>
                                    No tracks found
                                </Text>
                                <Text style={styles.emptySubtext}>
                                    Upload audio or pull down to refresh
                                </Text>
                            </View>
                        }
                        ListFooterComponent={
                            hasMore ? (
                                <View style={styles.footerContainer}>
                                    <TouchableOpacity
                                        style={styles.loadMoreBtn}
                                        activeOpacity={0.8}
                                        disabled={isLoadingMore}
                                        onPress={handleLoadMore}
                                    >
                                        {isLoadingMore ? (
                                            <ActivityIndicator
                                                size="small"
                                                color="#000000"
                                            />
                                        ) : (
                                            <>
                                                <Ionicons
                                                    name="arrow-down-circle-outline"
                                                    size={18}
                                                    color="#000000"
                                                />
                                                <Text style={styles.loadMoreText}>
                                                    Load More
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ) : null
                        }
                        renderItem={({ item }) => (
                            <SongCard
                                song={item}
                                isCurrent={currentSong?.id === item.id}
                                isPlaying={
                                    isPlaying && currentSong?.id === item.id
                                }
                                onPress={() => {
                                    if (currentSong?.id === item.id) {
                                        togglePlay();
                                    } else {
                                        playSong(item, songs);
                                    }
                                }}
                            />
                        )}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: appConfig.colors.background,
    },
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    landingScroll: {
        flex: 1,
    },
    landingContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 90,
    },
    heroCard: {
        borderRadius: 12,
        padding: 24,
        marginBottom: 28,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
    },
    heroBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: "flex-start",
        gap: 6,
        marginBottom: 16,
    },
    heroBadgeText: {
        color: "#ffffff",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.8,
    },
    heroHeadline: {
        color: "#ffffff",
        fontSize: 26,
        fontWeight: "900",
        lineHeight: 32,
        letterSpacing: -0.5,
        marginBottom: 14,
    },
    heroDesc: {
        color: "#cbd5e1",
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 22,
    },
    heroCtaBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: appConfig.colors.accentGreen,
        borderRadius: 24,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignSelf: "flex-start",
    },
    heroCtaText: {
        color: "#000000",
        fontSize: 14,
        fontWeight: "800",
    },
    featuresSection: {
        gap: 12,
    },
    featuresHeading: {
        color: "#ffffff",
        fontSize: 20,
        fontWeight: "800",
        marginBottom: 6,
    },
    featureCard: {
        backgroundColor: "#181818",
        borderRadius: 8,
        padding: 18,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    featureIcon: {
        marginBottom: 10,
    },
    featureTitle: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "700",
        marginBottom: 4,
    },
    featureDesc: {
        color: appConfig.colors.subText,
        fontSize: 12,
        lineHeight: 17,
    },
    listContent: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 140,
    },
    shelfHeader: {
        marginBottom: 18,
        marginTop: 6,
    },
    greetingText: {
        color: "#ffffff",
        fontSize: 26,
        fontWeight: "800",
        letterSpacing: -0.4,
        marginBottom: 20,
    },
    shelfTitleRow: {
        marginBottom: 4,
    },
    shelfTitle: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "800",
        marginBottom: 2,
    },
    shelfSubtitle: {
        color: appConfig.colors.subText,
        fontSize: 12,
    },
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
    },
    emptyText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "700",
        marginTop: 12,
    },
    emptySubtext: {
        color: appConfig.colors.subText,
        fontSize: 12,
        marginTop: 4,
    },
    footerContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 24,
        paddingBottom: 20,
    },
    loadMoreBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: appConfig.colors.accentGreen,
        paddingVertical: 12,
        paddingHorizontal: 28,
        borderRadius: 24,
        gap: 8,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    loadMoreText: {
        color: "#000000",
        fontSize: 14,
        fontWeight: "700",
        letterSpacing: 0.2,
    },
});
