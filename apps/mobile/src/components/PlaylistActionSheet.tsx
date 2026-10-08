import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { appConfig } from "../config";

interface PlaylistActionSheetProps {
    visible: boolean;
    playlist: { id: string; label: string; is_deletable?: boolean } | null;
    onClose: () => void;
    onEdit: (playlist: { id: string; label: string }) => void;
    onDelete: (playlist: { id: string; label: string }) => void;
}

export const PlaylistActionSheet: React.FC<PlaylistActionSheetProps> = ({
    visible,
    playlist,
    onClose,
    onEdit,
    onDelete,
}) => {
    if (!visible || !playlist) return null;

    const handleDeletePress = () => {
        Alert.alert(
            "Delete Playlist",
            `Are you sure you want to delete "${playlist.label}"? This cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        onClose();
                        onDelete(playlist);
                    },
                },
            ],
        );
    };

    const handleEditPress = () => {
        onClose();
        onEdit(playlist);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                        <View style={styles.sheet}>
                            {/* Handle Bar */}
                            <View style={styles.handleBar} />

                            {/* Header Info */}
                            <View style={styles.header}>
                                <View style={styles.iconThumb}>
                                    <Ionicons
                                        name="musical-notes"
                                        size={22}
                                        color={appConfig.colors.accentGreen}
                                    />
                                </View>
                                <View style={styles.headerText}>
                                    <Text
                                        style={styles.title}
                                        numberOfLines={1}
                                    >
                                        {playlist.label}
                                    </Text>
                                    <Text style={styles.subtitle}>Playlist</Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            {/* Actions List */}
                            <View style={styles.actions}>
                                {playlist.is_deletable && (
                                    <>
                                        <TouchableOpacity
                                            style={styles.actionRow}
                                            activeOpacity={0.7}
                                            onPress={handleEditPress}
                                        >
                                            <Ionicons
                                                name="pencil-outline"
                                                size={22}
                                                color="#ffffff"
                                            />
                                            <Text style={styles.actionText}>
                                                Edit playlist name
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.actionRow}
                                            activeOpacity={0.7}
                                            onPress={handleDeletePress}
                                        >
                                            <Ionicons
                                                name="trash-outline"
                                                size={22}
                                                color="#ef4444"
                                            />
                                            <Text
                                                style={[
                                                    styles.actionText,
                                                    styles.deleteText,
                                                ]}
                                            >
                                                Delete playlist
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
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
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: "#181818",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 12,
        paddingBottom: 40,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
    },
    handleBar: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        alignSelf: "center",
        marginBottom: 16,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    iconThumb: {
        width: 48,
        height: 48,
        borderRadius: 6,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    headerText: {
        flex: 1,
    },
    title: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 2,
    },
    subtitle: {
        color: appConfig.colors.subText,
        fontSize: 13,
    },
    divider: {
        height: 1,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        marginBottom: 8,
    },
    actions: {
        marginTop: 4,
    },
    actionRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        gap: 16,
    },
    actionText: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "500",
    },
    deleteText: {
        color: "#ef4444",
    },
});
