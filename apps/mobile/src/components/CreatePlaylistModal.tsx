import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { playlistService } from "@music-cloud/services";
import { useUI } from "../context/UIContext";
import { appConfig } from "../config";

export const CreatePlaylistModal: React.FC = () => {
    const {
        isCreatePlaylistOpen,
        closeCreatePlaylist,
        triggerPlaylistRefresh,
    } = useUI();
    const [title, setTitle] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isCreatePlaylistOpen) return null;

    const handleCreate = async () => {
        const trimmed = title.trim();
        if (!trimmed) return;

        setTitle("");
        closeCreatePlaylist();

        try {
            await playlistService.createPlaylist({ label: trimmed });
            triggerPlaylistRefresh();
        } catch (err: any) {
            triggerPlaylistRefresh();
            Alert.alert(
                "Error",
                err?.response?.data?.detail || "Failed to create playlist",
            );
        }
    };

    const handleCancel = () => {
        setTitle("");
        closeCreatePlaylist();
    };

    return (
        <Modal
            visible={isCreatePlaylistOpen}
            transparent
            animationType="fade"
            onRequestClose={handleCancel}
        >
            <TouchableWithoutFeedback onPress={handleCancel}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={styles.overlay}
                >
                    <TouchableWithoutFeedback
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={styles.card}>
                            <Text style={styles.title}>Create playlist</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="My Playlist"
                            placeholderTextColor={appConfig.colors.subText}
                            value={title}
                            onChangeText={setTitle}
                            autoFocus
                            selectTextOnFocus
                        />

                        <View style={styles.actionsRow}>
                            <TouchableOpacity
                                onPress={handleCancel}
                                style={styles.cancelBtn}
                                disabled={isSubmitting}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleCreate}
                                style={[
                                    styles.createBtn,
                                    !title.trim() && styles.createBtnDisabled,
                                ]}
                                disabled={!title.trim() || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator
                                        size="small"
                                        color="#000000"
                                    />
                                ) : (
                                    <Text style={styles.createText}>
                                        Create
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
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
    card: {
        width: "100%",
        maxWidth: 380,
        backgroundColor: "#282828",
        borderRadius: 8,
        padding: 24,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
        elevation: 12,
    },
    title: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 16,
    },
    input: {
        backgroundColor: "#3e3e3e",
        color: "#ffffff",
        borderRadius: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },
    actionsRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 12,
    },
    cancelBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    cancelText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "600",
    },
    createBtn: {
        backgroundColor: appConfig.colors.accentGreen,
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 22,
        alignItems: "center",
        justifyContent: "center",
    },
    createBtnDisabled: {
        opacity: 0.5,
    },
    createText: {
        color: "#000000",
        fontSize: 14,
        fontWeight: "700",
    },
});
