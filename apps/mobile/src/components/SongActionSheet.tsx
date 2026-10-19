import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Share,
    Platform,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { SongCoverArt } from "./SongCoverArt";
import { playlistService } from "@music-cloud/services";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { useDownload } from "../context/DownloadContext";
import { useNetwork } from "../context/NetworkContext";
import { appConfig } from "../config";
import type { SongMetadata } from "@music-cloud/types";
import { Alert, ActivityIndicator } from "react-native";

interface SongActionSheetProps {
    visible: boolean;
    song: SongMetadata | null;
    playlistId?: string;
    isPlaylistContext?: boolean;
    canRemoveFromPlaylist?: boolean;
    onClose: () => void;
    onRemoveFromPlaylist?: (song: SongMetadata) => void;
}

export const SongActionSheet: React.FC<SongActionSheetProps> = ({
    visible,
    song,
    canRemoveFromPlaylist = false,
    onClose,
    onRemoveFromPlaylist,
}) => {
    const {
        currentSong,
        isPlaying,
        playSong,
        togglePlay,
        addToQueue,
        openPlaylistModal,
    } = usePlayer();
    const { isAuthenticated, openAuthModal } = useAuth();
    const { isDownloaded, isDownloading, downloadSong, deleteDownloadedSong } =
        useDownload();
    const { isOffline } = useNetwork();

    const [isLiked, setIsLiked] = useState<boolean | null>(null);

    const isCurrentSong = currentSong?.id === song?.id;
    const isThisPlaying = isCurrentSong && isPlaying;

    // Check liked status on mount/song change
    useEffect(() => {
        if (!visible || !song) return;

        if (!isAuthenticated) {
            setIsLiked(false);
            return;
        }

        let active = true;
        playlistService
            .getSongLikedStatus(song.id)
            .then((liked) => {
                if (active) setIsLiked(liked);
            })
            .catch(() => {
                if (active) setIsLiked(false);
            });

        return () => {
            active = false;
        };
    }, [visible, song?.id, isAuthenticated]);

    if (!song) return null;

    const songDownloaded = song ? isDownloaded(song.id) : false;
    const songDownloading = song ? isDownloading(song.id) : false;

    const handleToggleDownload = async () => {
        if (!song) return;

        if (songDownloaded) {
            // Confirm delete
            Alert.alert(
                "Remove Download",
                `Remove "${song.title}" from your downloaded songs?`,
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Remove",
                        style: "destructive",
                        onPress: async () => {
                            try {
                                await deleteDownloadedSong(song.id);
                            } catch (e: any) {
                                Alert.alert(
                                    "Error",
                                    e?.message || "Failed to remove download.",
                                );
                            }
                        },
                    },
                ],
            );
        } else {
            // Need network to download
            if (isOffline) {
                Alert.alert(
                    "Offline",
                    "Cannot download while offline. Please connect to internet.",
                );
                return;
            }
            if (!isAuthenticated) {
                onClose();
                openAuthModal();
                return;
            }
            try {
                await downloadSong(song);
            } catch (e: any) {
                Alert.alert(
                    "Download Error",
                    e?.message || "Failed to download song.",
                );
            }
        }
    };

    const handlePlayToggle = () => {
        onClose();
        if (isCurrentSong) {
            togglePlay();
        } else {
            playSong(song, [song]);
        }
    };

    const handlePlayNext = () => {
        if (!song) return;
        addToQueue(song, "next");
        onClose();
    };

    const handleAddToQueue = () => {
        if (!song) return;
        addToQueue(song, "end");
        onClose();
    };

    const handleToggleLike = async () => {
        if (isOffline) {
            Alert.alert("Offline", "Cannot update likes while offline.");
            return;
        }
        if (!isAuthenticated) {
            onClose();
            openAuthModal();
            return;
        }

        const prevLiked = isLiked ?? false;
        const nextLiked = !prevLiked;
        // OPTIMISTIC UPDATE: Immediate visual toggle
        setIsLiked(nextLiked);

        try {
            const res = await playlistService.toggleLikeSong(song.id);
            if (typeof res?.liked === "boolean") {
                setIsLiked(res.liked);
            }
        } catch (e) {
            console.warn("Failed to toggle like in ActionSheet, reverting:", e);
            setIsLiked(prevLiked);
        }
    };

    const handleAddToPlaylist = () => {
        if (isOffline) {
            Alert.alert("Offline", "Cannot manage playlists while offline.");
            return;
        }
        onClose();
        if (!isAuthenticated) {
            openAuthModal();
            return;
        }
        openPlaylistModal(song);
    };

    const handleShare = async () => {
        onClose();
        try {
            await Share.share({
                message: `Listen to "${song.title}" by ${song.artist} on Music Cloud!`,
                title: song.title,
            });
        } catch {
            // User cancelled or share error
        }
    };

    const handleRemove = () => {
        if (isOffline) {
            Alert.alert("Offline", "Cannot edit playlists while offline.");
            return;
        }
        onClose();
        if (onRemoveFromPlaylist) {
            onRemoveFromPlaylist(song);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.backdrop}>
                    <TouchableWithoutFeedback
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={styles.sheetContainer}>
                            {/* Handle Bar */}
                            <View style={styles.dragHandle} />

                            {/* Song Header Info */}
                            <View style={styles.songHeader}>
                                <SongCoverArt
                                    src={song.cover_art_url}
                                    size={50}
                                    borderRadius={6}
                                    iconSize={24}
                                    style={styles.cover}
                                />
                                <View style={styles.songMeta}>
                                    <Text
                                        style={styles.songTitle}
                                        numberOfLines={1}
                                    >
                                        {song.title}
                                    </Text>
                                    <Text
                                        style={styles.songArtist}
                                        numberOfLines={1}
                                    >
                                        {song.artist}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            {/* Action 1: Play / Pause */}
                            <TouchableOpacity
                                style={styles.actionItem}
                                onPress={handlePlayToggle}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={isThisPlaying ? "pause" : "play"}
                                    size={22}
                                    color={
                                        isThisPlaying
                                            ? appConfig.colors.accentGreen
                                            : "#ffffff"
                                    }
                                />
                                <Text
                                    style={[
                                        styles.actionLabel,
                                        isThisPlaying && {
                                            color: appConfig.colors.accentGreen,
                                        },
                                    ]}
                                >
                                    {isThisPlaying ? "Pause" : "Play"}
                                </Text>
                            </TouchableOpacity>

                            {/* Action 1.5: Play next */}
                            <TouchableOpacity
                                style={styles.actionItem}
                                onPress={handlePlayNext}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="return-down-forward-outline"
                                    size={22}
                                    color="#ffffff"
                                />
                                <Text style={styles.actionLabel}>
                                    Play next
                                </Text>
                            </TouchableOpacity>

                            {/* Action 1.6: Add to queue */}
                            <TouchableOpacity
                                style={styles.actionItem}
                                onPress={handleAddToQueue}
                                activeOpacity={0.7}
                            >
                                <MaterialIcons
                                    name="queue-music"
                                    size={24}
                                    color="#ffffff"
                                />
                                <Text style={styles.actionLabel}>
                                    Add to queue
                                </Text>
                            </TouchableOpacity>

                            {/* Action 2: Like / Unlike */}
                            <TouchableOpacity
                                style={[
                                    styles.actionItem,
                                    isOffline && { opacity: 0.4 },
                                ]}
                                onPress={handleToggleLike}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={isLiked ? "heart" : "heart-outline"}
                                    size={22}
                                    color={
                                        isLiked
                                            ? appConfig.colors.accentGreen
                                            : "#ffffff"
                                    }
                                />
                                <Text
                                    style={[
                                        styles.actionLabel,
                                        isLiked && {
                                            color: appConfig.colors.accentGreen,
                                        },
                                    ]}
                                >
                                    {isLiked
                                        ? "Remove from Liked Songs"
                                        : "Save to Liked Songs"}
                                </Text>
                            </TouchableOpacity>

                            {/* Action 3: Add to playlist */}
                            <TouchableOpacity
                                style={[
                                    styles.actionItem,
                                    isOffline && { opacity: 0.4 },
                                ]}
                                onPress={handleAddToPlaylist}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="add-circle-outline"
                                    size={22}
                                    color="#ffffff"
                                />
                                <Text style={styles.actionLabel}>
                                    Add to playlist
                                </Text>
                            </TouchableOpacity>

                            {/* Action 4: Download / Remove Download */}
                            <TouchableOpacity
                                style={[
                                    styles.actionItem,
                                    !songDownloaded &&
                                        isOffline && { opacity: 0.4 },
                                ]}
                                onPress={handleToggleDownload}
                                disabled={songDownloading}
                                activeOpacity={0.7}
                            >
                                {songDownloading ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={appConfig.colors.accentGreen}
                                        style={{ width: 22, marginRight: 0 }}
                                    />
                                ) : (
                                    <Ionicons
                                        name={
                                            songDownloaded
                                                ? "trash-bin-outline"
                                                : "arrow-down-circle-outline"
                                        }
                                        size={22}
                                        color={
                                            songDownloaded
                                                ? "#f87171"
                                                : "#ffffff"
                                        }
                                    />
                                )}
                                <Text
                                    style={[
                                        styles.actionLabel,
                                        songDownloaded && { color: "#f87171" },
                                    ]}
                                >
                                    {songDownloading
                                        ? "Downloading..."
                                        : songDownloaded
                                          ? "Remove Download"
                                          : "Download Song"}
                                </Text>
                            </TouchableOpacity>

                            {/* Action 5: Remove from this playlist (if applicable) */}
                            {canRemoveFromPlaylist && (
                                <TouchableOpacity
                                    style={[
                                        styles.actionItem,
                                        isOffline && { opacity: 0.4 },
                                    ]}
                                    onPress={handleRemove}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name="trash-outline"
                                        size={22}
                                        color="#f87171"
                                    />
                                    <Text
                                        style={[
                                            styles.actionLabel,
                                            { color: "#f87171" },
                                        ]}
                                    >
                                        Remove from this playlist
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* Action 6: Share */}
                            <TouchableOpacity
                                style={styles.actionItem}
                                onPress={handleShare}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="share-social-outline"
                                    size={22}
                                    color="#ffffff"
                                />
                                <Text style={styles.actionLabel}>Share</Text>
                            </TouchableOpacity>

                            {/* Cancel Button */}
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={onClose}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.cancelText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        justifyContent: "flex-end",
    },
    sheetContainer: {
        backgroundColor: "#242424",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingTop: 10,
        paddingBottom: Platform.OS === "ios" ? 38 : 24,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 20,
    },
    dragHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255, 255, 255, 0.25)",
        alignSelf: "center",
        marginBottom: 14,
    },
    songHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    cover: {
        marginRight: 14,
    },
    songMeta: {
        flex: 1,
    },
    songTitle: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 4,
    },
    songArtist: {
        color: appConfig.colors.subText,
        fontSize: 13,
    },
    divider: {
        height: 1,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        marginBottom: 8,
    },
    actionItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        gap: 16,
    },
    actionLabel: {
        color: "#eaeaea",
        fontSize: 15,
        fontWeight: "500",
    },
    cancelBtn: {
        marginTop: 12,
        paddingVertical: 14,
        borderRadius: 24,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        alignItems: "center",
        justifyContent: "center",
    },
    cancelText: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "600",
    },
});
