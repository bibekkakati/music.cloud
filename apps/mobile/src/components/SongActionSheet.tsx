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
import { Ionicons } from "@expo/vector-icons";
import { SongCoverArt } from "./SongCoverArt";
import { playlistService } from "@music-cloud/services";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { appConfig } from "../config";
import type { SongMetadata } from "@music-cloud/types";

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
    const { currentSong, isPlaying, playSong, togglePlay, openPlaylistModal } =
        usePlayer();
    const { isAuthenticated, openAuthModal } = useAuth();

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

    const handlePlayToggle = () => {
        onClose();
        if (isCurrentSong) {
            togglePlay();
        } else {
            playSong(song, [song]);
        }
    };

    const handleToggleLike = async () => {
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

                            {/* Action 2: Like / Unlike */}
                            <TouchableOpacity
                                style={styles.actionItem}
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
                                style={styles.actionItem}
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

                            {/* Action 4: Remove from this playlist (if applicable) */}
                            {canRemoveFromPlaylist && (
                                <TouchableOpacity
                                    style={styles.actionItem}
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

                            {/* Action 5: Share */}
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
