import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    FlatList,
    TextInput,
    ActivityIndicator,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePlayer } from "../context/PlayerContext";
import { useUI } from "../context/UIContext";
import { playlistService } from "@music-cloud/services";
import { isLikedPlaylist } from "@music-cloud/utils";
import { appConfig } from "../config";
import type { PlaylistSummary } from "@music-cloud/types";

export const PlaylistModal: React.FC = () => {
    const { playlistModalSong, closePlaylistModal } = usePlayer();
    const { triggerPlaylistRefresh, playlistRefreshTrigger } = useUI();

    const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // Inline playlist creation state (matching web)
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (!playlistModalSong) return;

        let active = true;
        setIsLoading(true);

        playlistService
            .getAllPlaylists(playlistModalSong.id)
            .then((data) => {
                if (active) setPlaylists(data);
            })
            .catch((err) => {
                console.warn("Failed to load playlists:", err);
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [playlistModalSong, playlistRefreshTrigger]);

    if (!playlistModalSong) return null;

    const handleToggleSongInPlaylist = async (playlist: PlaylistSummary) => {
        const isCurrentlyIn = playlist.contains_song;
        const targetState = !isCurrentlyIn;

        // OPTIMISTIC UPDATE: Instant checkbox toggle without waiting for API
        setPlaylists((prev) =>
            prev.map((p) =>
                p.id === playlist.id ? { ...p, contains_song: targetState } : p,
            ),
        );

        try {
            if (isCurrentlyIn) {
                await playlistService.removeSongFromPlaylistBySongId(
                    playlist.id,
                    playlistModalSong.id,
                );
            } else {
                await playlistService.addSongToPlaylist({
                    playlist_id: playlist.id,
                    song_id: playlistModalSong.id,
                });
            }
            triggerPlaylistRefresh();
        } catch (err: any) {
            console.warn("Failed to update playlist song, reverting:", err);
            // Revert if API fails
            setPlaylists((prev) =>
                prev.map((p) =>
                    p.id === playlist.id
                        ? { ...p, contains_song: isCurrentlyIn }
                        : p,
                ),
            );
            Alert.alert(
                "Error",
                err?.response?.data?.detail || "Failed to update playlist",
            );
        }
    };

    const handleCreateNewPlaylist = async () => {
        const trimmed = newPlaylistName.trim();
        if (!trimmed) return;

        setIsCreating(true);
        const tempId = `temp-${Date.now()}`;
        const playlist: PlaylistSummary = {
            id: tempId,
            label: trimmed,
            contains_song: true,
            is_deletable: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        // Optimistically insert new playlist with song added immediately
        setPlaylists((prev) => [playlist, ...prev]);
        setIsCreatingNew(false);
        setNewPlaylistName("");

        try {
            const newPl = await playlistService.createPlaylist({
                label: trimmed,
            });
            await playlistService.addSongToPlaylist({
                playlist_id: newPl.id,
                song_id: playlistModalSong.id,
            });
            triggerPlaylistRefresh();

            setPlaylists((prev) =>
                prev.map((p) =>
                    p.id === tempId
                        ? { ...p, ...newPl, contains_song: true }
                        : p,
                ),
            );
        } catch (err: any) {
            setPlaylists((prev) => prev.filter((p) => p.id !== tempId));
            Alert.alert(
                "Error",
                err?.response?.data?.detail || "Failed to create playlist",
            );
        } finally {
            setIsCreating(false);
        }
    };

    const filteredPlaylists = playlists.filter((p) =>
        p.label.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    return (
        <Modal
            visible={!!playlistModalSong}
            transparent
            animationType="fade"
            onRequestClose={closePlaylistModal}
        >
            <TouchableWithoutFeedback onPress={closePlaylistModal}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={styles.modalContent}>
                            {/* Header */}
                            <Text style={styles.title}>Add to playlist</Text>

                            {/* Search Box */}
                            <View style={styles.searchBox}>
                                <Ionicons
                                    name="search"
                                    size={16}
                                    color={appConfig.colors.subText}
                                />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Find a playlist"
                                    placeholderTextColor={
                                        appConfig.colors.subText
                                    }
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    clearButtonMode="while-editing"
                                />
                            </View>

                            {/* Inline Create Playlist or New Playlist Button */}
                            {isCreatingNew ? (
                                <View style={styles.inlineCreateRow}>
                                    <TextInput
                                        style={styles.inlineInput}
                                        placeholder="New playlist name"
                                        placeholderTextColor={
                                            appConfig.colors.subText
                                        }
                                        value={newPlaylistName}
                                        onChangeText={setNewPlaylistName}
                                        autoFocus
                                        onSubmitEditing={
                                            handleCreateNewPlaylist
                                        }
                                        returnKeyType="done"
                                    />
                                    <TouchableOpacity
                                        style={[
                                            styles.inlineCreateBtn,
                                            !newPlaylistName.trim() &&
                                                styles.inlineCreateBtnDisabled,
                                        ]}
                                        onPress={handleCreateNewPlaylist}
                                        disabled={
                                            !newPlaylistName.trim() ||
                                            isCreating
                                        }
                                    >
                                        {isCreating ? (
                                            <ActivityIndicator
                                                size="small"
                                                color="#000000"
                                            />
                                        ) : (
                                            <Text
                                                style={
                                                    styles.inlineCreateBtnText
                                                }
                                            >
                                                Create
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.inlineCancelBtn}
                                        onPress={() => {
                                            setIsCreatingNew(false);
                                            setNewPlaylistName("");
                                        }}
                                    >
                                        <Ionicons
                                            name="close"
                                            size={20}
                                            color={appConfig.colors.subText}
                                        />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.newPlaylistRow}
                                    onPress={() => setIsCreatingNew(true)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name="add"
                                        size={20}
                                        color="#ffffff"
                                    />
                                    <Text style={styles.newPlaylistText}>
                                        New playlist
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <View style={styles.divider} />

                            {/* Playlists List */}
                            {isLoading ? (
                                <View style={styles.centerContainer}>
                                    <ActivityIndicator
                                        color={appConfig.colors.accentGreen}
                                    />
                                </View>
                            ) : (
                                <FlatList
                                    data={filteredPlaylists}
                                    keyExtractor={(item) => item.id}
                                    style={styles.list}
                                    showsVerticalScrollIndicator={false}
                                    renderItem={({ item }) => {
                                        const isLiked = isLikedPlaylist(
                                            item.label,
                                            item.is_deletable,
                                        );
                                        const isToggling =
                                            actionLoadingId === item.id;

                                        return (
                                            <TouchableOpacity
                                                style={styles.playlistRow}
                                                onPress={() =>
                                                    handleToggleSongInPlaylist(
                                                        item,
                                                    )
                                                }
                                                activeOpacity={0.7}
                                            >
                                                {isLiked ? (
                                                    <LinearGradient
                                                        colors={[
                                                            "#450af5",
                                                            "#8e8ee5",
                                                        ]}
                                                        style={
                                                            styles.likedSquare
                                                        }
                                                    >
                                                        <Ionicons
                                                            name="heart"
                                                            size={16}
                                                            color="#ffffff"
                                                        />
                                                    </LinearGradient>
                                                ) : (
                                                    <View
                                                        style={
                                                            styles.defaultSquare
                                                        }
                                                    >
                                                        <Ionicons
                                                            name="musical-notes"
                                                            size={16}
                                                            color={
                                                                appConfig.colors
                                                                    .subText
                                                            }
                                                        />
                                                    </View>
                                                )}

                                                <View
                                                    style={styles.playlistInfo}
                                                >
                                                    <View
                                                        style={styles.labelRow}
                                                    >
                                                        <Text
                                                            style={
                                                                styles.playlistName
                                                            }
                                                            numberOfLines={1}
                                                        >
                                                            {isLiked
                                                                ? "Liked Songs"
                                                                : item.label}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* Radio / Check Indicator */}
                                                <View
                                                    style={
                                                        styles.checkboxContainer
                                                    }
                                                >
                                                    {isToggling ? (
                                                        <ActivityIndicator
                                                            size="small"
                                                            color={
                                                                appConfig.colors
                                                                    .accentGreen
                                                            }
                                                        />
                                                    ) : (
                                                        <Ionicons
                                                            name={
                                                                item.contains_song
                                                                    ? "checkmark-circle"
                                                                    : "ellipse-outline"
                                                            }
                                                            size={22}
                                                            color={
                                                                item.contains_song
                                                                    ? appConfig
                                                                          .colors
                                                                          .accentGreen
                                                                    : appConfig
                                                                          .colors
                                                                          .subText
                                                            }
                                                        />
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    }}
                                    ListEmptyComponent={
                                        <View style={styles.emptyContainer}>
                                            <Text style={styles.emptyText}>
                                                No playlists found
                                            </Text>
                                        </View>
                                    }
                                />
                            )}

                            {/* Footer Actions */}
                            <View style={styles.footerRow}>
                                <TouchableOpacity
                                    onPress={closePlaylistModal}
                                    style={styles.cancelBtn}
                                >
                                    <Text style={styles.cancelText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    modalContent: {
        width: "100%",
        maxWidth: 380,
        maxHeight: 460,
        backgroundColor: "#282828",
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
        elevation: 16,
    },
    title: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 16,
    },
    searchBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#3e3e3e",
        borderRadius: 4,
        paddingHorizontal: 10,
        height: 38,
        gap: 8,
        marginBottom: 14,
    },
    searchInput: {
        flex: 1,
        color: "#ffffff",
        fontSize: 13,
    },
    newPlaylistRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
    },
    newPlaylistText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "600",
    },
    inlineCreateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginVertical: 4,
    },
    inlineInput: {
        flex: 1,
        height: 36,
        backgroundColor: "#383838",
        borderRadius: 4,
        paddingHorizontal: 10,
        color: "#ffffff",
        fontSize: 13,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
    },
    inlineCreateBtn: {
        backgroundColor: appConfig.colors.accentGreen,
        borderRadius: 18,
        paddingHorizontal: 14,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
    },
    inlineCreateBtnDisabled: {
        opacity: 0.5,
    },
    inlineCreateBtnText: {
        color: "#000000",
        fontSize: 13,
        fontWeight: "700",
    },
    inlineCancelBtn: {
        padding: 6,
    },
    divider: {
        height: 1,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        marginVertical: 6,
    },
    list: {
        flexGrow: 0,
        maxHeight: 220,
    },
    centerContainer: {
        height: 120,
        justifyContent: "center",
        alignItems: "center",
    },
    playlistRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        gap: 12,
    },
    likedSquare: {
        width: 38,
        height: 38,
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
    },
    defaultSquare: {
        width: 38,
        height: 38,
        borderRadius: 4,
        backgroundColor: "#383838",
        alignItems: "center",
        justifyContent: "center",
    },
    playlistInfo: {
        flex: 1,
    },
    labelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    playlistName: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "600",
    },
    pinBadge: {
        fontSize: 12,
    },
    checkboxContainer: {
        padding: 4,
    },
    emptyContainer: {
        paddingVertical: 20,
        alignItems: "center",
    },
    emptyText: {
        color: appConfig.colors.subText,
        fontSize: 13,
    },
    footerRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 12,
    },
    cancelBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    cancelText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "600",
    },
});
