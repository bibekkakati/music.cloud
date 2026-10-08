import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { playlistService } from "@music-cloud/services";
import { isLikedPlaylist, BROWSE_CATEGORIES } from "@music-cloud/utils";
import { usePlayer } from "../context/PlayerContext";
import { useUI } from "../context/UIContext";
import { SongRow } from "../components/SongRow";
import { SongActionSheet } from "../components/SongActionSheet";
import { PlaylistActionSheet } from "../components/PlaylistActionSheet";
import { EditPlaylistModal } from "../components/EditPlaylistModal";
import { appConfig } from "../config";
import type {
    PlaylistDetail,
    PlaylistSongItem,
    SongMetadata,
} from "@music-cloud/types";

export const SongCollectionView: React.FC = () => {
    const route = useRoute<any>();
    const navigation = useNavigation();
    const { playlistId, categoryId, title: initialTitle } = route.params || {};

    const isCategoryMode = Boolean(categoryId) || !playlistId;
    const resolvedCategory = isCategoryMode
        ? BROWSE_CATEGORIES.find(
              (c) =>
                  c.id.toLowerCase() ===
                  (categoryId || "").toLowerCase(),
          )
        : null;

    const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
    const { triggerPlaylistRefresh } = useUI();

    const [collection, setCollection] = useState<PlaylistDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [actionSheetSong, setActionSheetSong] = useState<SongMetadata | null>(null);
    const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
    const [isPlaylistMenuOpen, setIsPlaylistMenuOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            if (isCategoryMode) {
                const label =
                    initialTitle ||
                    (resolvedCategory ? resolvedCategory.title : categoryId) ||
                    "Category";
                const data = await playlistService.getCategorySongs(label);
                setCollection(data);
            } else {
                if (!playlistId) return;
                const data = await playlistService.getPlaylistSongs(playlistId);
                setCollection(data);
            }
        } catch (err) {
            console.warn("Failed to load collection detail:", err);
        } finally {
            setIsLoading(false);
        }
    }, [isCategoryMode, initialTitle, resolvedCategory, categoryId, playlistId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const collectionSongs: SongMetadata[] = (collection?.songs || []).map(
        (s: PlaylistSongItem) => ({
            id: s.id,
            title: s.title || "Unknown Title",
            artist: s.artist || "Unknown Artist",
            duration_sec: s.duration_sec ?? undefined,
            cover_art_url: s.cover_art_url,
            stream_url: s.stream_url,
        }),
    );

    const handlePlayAll = () => {
        if (collectionSongs.length > 0) {
            playSong(collectionSongs[0], collectionSongs);
        }
    };

    const handleRemoveSong = (song: SongMetadata) => {
        if (isCategoryMode || !playlistId) return;
        Alert.alert(
            "Remove Song",
            `Remove "${song.title}" from ${collection?.label}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        // OPTIMISTIC: remove song from list immediately
                        const previousCollection = collection;
                        setCollection((prev: PlaylistDetail | null) =>
                            prev
                                ? {
                                      ...prev,
                                      songs: prev.songs.filter(
                                          (s: PlaylistSongItem) =>
                                              s.id !== song.id,
                                      ),
                                  }
                                : null,
                        );

                        try {
                            await playlistService.removeSongFromPlaylistBySongId(
                                playlistId,
                                song.id,
                            );
                            triggerPlaylistRefresh();
                        } catch (err) {
                            console.warn("Failed to remove song, reverting:", err);
                            setCollection(previousCollection);
                            Alert.alert("Error", "Failed to remove song from playlist");
                        }
                    },
                },
            ],
        );
    };

    const handleDeletePlaylist = async () => {
        if (isCategoryMode || !playlistId) return;
        // OPTIMISTIC: Navigate back and trigger library refresh immediately
        triggerPlaylistRefresh();
        navigation.goBack();

        try {
            await playlistService.removePlaylist(playlistId);
        } catch (err: any) {
            console.warn("Failed to delete playlist on server:", err);
            triggerPlaylistRefresh();
        }
    };

    const handleEditSuccess = (updated: { id: string; label: string }) => {
        setCollection((prev: PlaylistDetail | null) =>
            prev ? { ...prev, label: updated.label } : null,
        );
    };

    const isLikedSongs = !isCategoryMode && isLikedPlaylist(
        collection?.label || initialTitle,
        collection?.is_deletable,
    );

    const categoryBgColor = resolvedCategory?.color || "#5038a0";

    const displayTitle = isCategoryMode
        ? (resolvedCategory ? resolvedCategory.title : initialTitle || collection?.label || "Category")
        : (isLikedSongs ? "Liked Songs" : collection?.label || initialTitle || "Playlist");

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Top Navigation */}
                <View style={styles.topNav}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backBtn}
                    >
                        <Ionicons name="arrow-back" size={24} color="#ffffff" />
                    </TouchableOpacity>

                    {!isCategoryMode && collection?.is_deletable && (
                        <TouchableOpacity
                            onPress={() => setIsPlaylistMenuOpen(true)}
                            style={styles.menuBtn}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons
                                name="ellipsis-horizontal"
                                size={24}
                                color="#ffffff"
                            />
                        </TouchableOpacity>
                    )}
                </View>

                {isLoading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator
                            size="large"
                            color={appConfig.colors.accentGreen}
                        />
                    </View>
                ) : (
                    <FlatList
                        data={collectionSongs}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={
                            <View style={styles.heroContainer}>
                                {/* Artwork Box */}
                                <LinearGradient
                                    colors={
                                        isCategoryMode
                                            ? [categoryBgColor, "#121212"]
                                            : isLikedSongs
                                            ? ["#450af5", "#8e8ee5"]
                                            : ["#333333", "#1e1e1e"]
                                    }
                                    style={styles.heroArtwork}
                                >
                                    <Ionicons
                                        name={
                                            isLikedSongs
                                                ? "heart"
                                                : "musical-notes"
                                        }
                                        size={64}
                                        color="#ffffff"
                                    />
                                </LinearGradient>

                                {/* Collection Info */}
                                <Text style={styles.heroTitle}>
                                    {displayTitle}
                                </Text>
                                <Text style={styles.heroSubtitle}>
                                    {collectionSongs.length}{" "}
                                    {collectionSongs.length === 1
                                        ? "song"
                                        : "songs"}
                                </Text>

                                {/* Controls Bar */}
                                <View style={styles.heroActions}>
                                    <TouchableOpacity
                                        style={styles.playAllBtn}
                                        onPress={handlePlayAll}
                                        disabled={collectionSongs.length === 0}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons
                                            name="play"
                                            size={28}
                                            color="#000000"
                                            style={{ marginLeft: 3 }}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>
                                    {isCategoryMode
                                        ? `No songs in ${displayTitle} yet`
                                        : "No songs in this playlist yet"}
                                </Text>
                            </View>
                        }
                        renderItem={({ item }) => (
                            <SongRow
                                song={item}
                                isCurrent={currentSong?.id === item.id}
                                isPlaying={
                                    isPlaying && currentSong?.id === item.id
                                }
                                onPress={() => {
                                    if (currentSong?.id === item.id) {
                                        togglePlay();
                                    } else {
                                        playSong(item, collectionSongs);
                                    }
                                }}
                                onMorePress={() => {
                                    setActionSheetSong(item);
                                    setIsActionSheetOpen(true);
                                }}
                            />
                        )}
                    />
                )}
            </View>

            {/* Context Menu Action Sheet (matching web SongContextMenu) */}
            <SongActionSheet
                visible={isActionSheetOpen}
                song={actionSheetSong}
                playlistId={isCategoryMode ? undefined : playlistId}
                isPlaylistContext={!isCategoryMode}
                canRemoveFromPlaylist={!isCategoryMode && !isLikedSongs && Boolean(playlistId)}
                onClose={() => {
                    setIsActionSheetOpen(false);
                    setActionSheetSong(null);
                }}
                onRemoveFromPlaylist={(song) => {
                    handleRemoveSong(song);
                }}
            />

            {/* Playlist Context Menu (Rename / Delete) */}
            {!isCategoryMode && (
                <PlaylistActionSheet
                    visible={isPlaylistMenuOpen}
                    playlist={collection}
                    onClose={() => setIsPlaylistMenuOpen(false)}
                    onEdit={() => setIsEditModalOpen(true)}
                    onDelete={() => handleDeletePlaylist()}
                />
            )}

            {/* Edit Playlist Modal */}
            {!isCategoryMode && (
                <EditPlaylistModal
                    visible={isEditModalOpen}
                    playlist={collection}
                    onClose={() => setIsEditModalOpen(false)}
                    onSuccess={handleEditSuccess}
                />
            )}
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
    topNav: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    backBtn: {
        padding: 6,
    },
    menuBtn: {
        padding: 6,
    },
    heroContainer: {
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    heroArtwork: {
        width: 160,
        height: 160,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 8,
    },
    heroTitle: {
        color: appConfig.colors.primaryText,
        fontSize: 22,
        fontWeight: "800",
        textAlign: "center",
        marginBottom: 6,
    },
    heroSubtitle: {
        color: appConfig.colors.subText,
        fontSize: 14,
        marginBottom: 16,
    },
    heroActions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    playAllBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: appConfig.colors.accentGreen,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 5,
    },
    listContent: {
        paddingBottom: 140,
    },
    centerContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyContainer: {
        paddingTop: 40,
        alignItems: "center",
    },
    emptyText: {
        color: appConfig.colors.subText,
        fontSize: 14,
    },
});
