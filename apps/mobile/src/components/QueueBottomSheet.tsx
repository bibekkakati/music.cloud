import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
    Platform,
    Dimensions,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { usePlayer, type PlayableSong } from "../context/PlayerContext";
import { SongCoverArt } from "./SongCoverArt";
import { formatTime } from "@music-cloud/utils";
import { appConfig } from "../config";

interface QueueBottomSheetProps {
    visible: boolean;
    onClose: () => void;
}

const { height } = Dimensions.get("window");

export const QueueBottomSheet: React.FC<QueueBottomSheetProps> = ({
    visible,
    onClose,
}) => {
    const {
        currentSong,
        queue,
        isPlaying,
        togglePlay,
        playSong,
        removeFromQueue,
        currentCollectionId,
    } = usePlayer();

    if (!visible) return null;

    const currentIdx = currentSong
        ? queue.findIndex((s) => s.id === currentSong.id)
        : -1;

    const upcomingSongs =
        currentIdx >= 0 ? queue.slice(currentIdx + 1) : queue;

    const handlePlaySong = (song: PlayableSong) => {
        playSong(song, queue, 0, currentCollectionId || undefined);
    };

    const handleRemove = (songId: string) => {
        removeFromQueue(songId);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.backdrop}>
                    <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                        <View style={styles.sheetContainer}>
                            {/* Drag Handle */}
                            <View style={styles.dragHandle} />

                            {/* Header */}
                            <View style={styles.header}>
                                <View style={styles.headerTitleBox}>
                                    <MaterialIcons
                                        name="queue-music"
                                        size={22}
                                        color={appConfig.colors.accentGreen}
                                    />
                                    <Text style={styles.headerTitle}>
                                        Playback Queue
                                    </Text>
                                    <View style={styles.countBadge}>
                                        <Text style={styles.countBadgeText}>
                                            {queue.length}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={onClose}
                                    style={styles.closeBtn}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                >
                                    <Ionicons name="close" size={24} color="#ffffff" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                style={styles.scrollArea}
                                contentContainerStyle={styles.scrollContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {/* Now Playing Card */}
                                {currentSong ? (
                                    <View style={styles.section}>
                                        <Text style={styles.sectionHeader}>
                                            NOW PLAYING
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.nowPlayingCard}
                                            onPress={togglePlay}
                                            activeOpacity={0.8}
                                        >
                                            <View style={styles.nowPlayingCover}>
                                                <SongCoverArt
                                                    src={currentSong.cover_art_url}
                                                    size={48}
                                                    borderRadius={6}
                                                    iconSize={22}
                                                />
                                                <View style={styles.playingOverlay}>
                                                    <Ionicons
                                                        name={isPlaying ? "pause" : "play"}
                                                        size={18}
                                                        color="#ffffff"
                                                    />
                                                </View>
                                            </View>

                                            <View style={styles.songInfo}>
                                                <Text
                                                    style={styles.nowPlayingTitle}
                                                    numberOfLines={1}
                                                >
                                                    {currentSong.title}
                                                </Text>
                                                <Text
                                                    style={styles.songArtist}
                                                    numberOfLines={1}
                                                >
                                                    {currentSong.artist}
                                                </Text>
                                            </View>

                                            <Text style={styles.durationText}>
                                                {formatTime(currentSong.duration_sec || 0)}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : null}

                                {/* Up Next List */}
                                <View style={styles.section}>
                                    <Text style={styles.sectionHeader}>
                                        UP NEXT ({upcomingSongs.length})
                                    </Text>

                                    {upcomingSongs.length === 0 ? (
                                        <View style={styles.emptyContainer}>
                                            <Ionicons
                                                name="musical-notes-outline"
                                                size={36}
                                                color={appConfig.colors.subText}
                                                style={{ opacity: 0.5, marginBottom: 8 }}
                                            />
                                            <Text style={styles.emptyTitle}>
                                                No upcoming tracks
                                            </Text>
                                            <Text style={styles.emptySubtitle}>
                                                Add songs to the queue using "Play next" or "Add to queue".
                                            </Text>
                                        </View>
                                    ) : (
                                        upcomingSongs.map((song, idx) => (
                                            <TouchableOpacity
                                                key={`${song.id}-${idx}`}
                                                style={styles.trackRow}
                                                onPress={() => handlePlaySong(song)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.trackIndex}>
                                                    {idx + 1}
                                                </Text>

                                                <SongCoverArt
                                                    src={song.cover_art_url}
                                                    size={40}
                                                    borderRadius={4}
                                                    iconSize={18}
                                                />

                                                <View style={styles.songInfo}>
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

                                                <Text style={styles.durationText}>
                                                    {formatTime(song.duration_sec || 0)}
                                                </Text>

                                                <TouchableOpacity
                                                    onPress={() => handleRemove(song.id)}
                                                    style={styles.removeBtn}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <Ionicons
                                                        name="trash-outline"
                                                        size={18}
                                                        color="#f87171"
                                                    />
                                                </TouchableOpacity>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </View>
                            </ScrollView>
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
        backgroundColor: "#1e1e1e",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: height * 0.78,
        paddingTop: 10,
        paddingBottom: Platform.OS === "ios" ? 34 : 20,
        borderTopWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 20,
    },
    dragHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255, 255, 255, 0.25)",
        alignSelf: "center",
        marginBottom: 12,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.08)",
    },
    headerTitleBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    headerTitle: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "700",
    },
    countBadge: {
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    countBadgeText: {
        color: appConfig.colors.subText,
        fontSize: 12,
        fontWeight: "600",
    },
    closeBtn: {
        padding: 4,
    },
    scrollArea: {
        paddingHorizontal: 20,
    },
    scrollContent: {
        paddingVertical: 16,
        gap: 20,
    },
    section: {
        width: "100%",
    },
    sectionHeader: {
        color: appConfig.colors.subText,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1,
        marginBottom: 10,
        textTransform: "uppercase",
    },
    nowPlayingCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 10,
        borderRadius: 10,
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        borderWidth: 1,
        borderColor: "rgba(29, 185, 84, 0.3)",
    },
    nowPlayingCover: {
        position: "relative",
    },
    playingOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: "rgba(0, 0, 0, 0.35)",
        borderRadius: 6,
        justifyContent: "center",
        alignItems: "center",
    },
    nowPlayingTitle: {
        color: appConfig.colors.accentGreen,
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 2,
    },
    songInfo: {
        flex: 1,
        minWidth: 0,
    },
    songTitle: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "500",
        marginBottom: 2,
    },
    songArtist: {
        color: appConfig.colors.subText,
        fontSize: 13,
    },
    durationText: {
        color: appConfig.colors.subText,
        fontSize: 12,
        fontVariant: ["tabular-nums"],
        marginRight: 6,
    },
    trackRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.04)",
    },
    trackIndex: {
        color: appConfig.colors.subText,
        fontSize: 12,
        width: 18,
        textAlign: "center",
        fontVariant: ["tabular-nums"],
    },
    removeBtn: {
        padding: 6,
    },
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 32,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
        borderStyle: "dashed",
    },
    emptyTitle: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 4,
    },
    emptySubtitle: {
        color: appConfig.colors.subText,
        fontSize: 12,
        textAlign: "center",
        lineHeight: 18,
    },
});
