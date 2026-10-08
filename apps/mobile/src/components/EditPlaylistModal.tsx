import React, { useState, useEffect } from "react";
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

interface EditPlaylistModalProps {
    visible: boolean;
    playlist: { id: string; label: string } | null;
    onClose: () => void;
    onSuccess?: (updated: { id: string; label: string }) => void;
}

export const EditPlaylistModal: React.FC<EditPlaylistModalProps> = ({
    visible,
    playlist,
    onClose,
    onSuccess,
}) => {
    const { triggerPlaylistRefresh } = useUI();
    const [title, setTitle] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (playlist) {
            setTitle(playlist.label);
        }
    }, [playlist, visible]);

    if (!visible || !playlist) return null;

    const handleSave = async () => {
        const trimmed = title.trim();
        if (!trimmed) return;

        const previousLabel = playlist.label;
        // OPTIMISTIC: apply update to parent immediately & close modal
        onSuccess?.({ id: playlist.id, label: trimmed });
        onClose();

        try {
            const res = await playlistService.updatePlaylist({
                id: playlist.id,
                label: trimmed,
            });
            triggerPlaylistRefresh();
            if (res?.label && res.label !== trimmed) {
                onSuccess?.({ id: playlist.id, label: res.label });
            }
        } catch (err: any) {
            console.warn("Failed to update playlist name, reverting:", err);
            onSuccess?.({ id: playlist.id, label: previousLabel });
            triggerPlaylistRefresh();
            Alert.alert(
                "Error",
                err?.response?.data?.detail || "Failed to update playlist name",
            );
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
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={styles.overlay}
                >
                    <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                        <View style={styles.card}>
                            <Text style={styles.title}>Edit playlist name</Text>

                            <TextInput
                                style={styles.input}
                                placeholder="Playlist name"
                                placeholderTextColor={appConfig.colors.subText}
                                value={title}
                                onChangeText={setTitle}
                                autoFocus
                                selectTextOnFocus
                            />

                            <View style={styles.actionsRow}>
                                <TouchableOpacity
                                    onPress={onClose}
                                    style={styles.cancelBtn}
                                    disabled={isSubmitting}
                                >
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleSave}
                                    style={[
                                        styles.saveBtn,
                                        !title.trim() && styles.saveBtnDisabled,
                                    ]}
                                    disabled={!title.trim() || isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator
                                            size="small"
                                            color="#000000"
                                        />
                                    ) : (
                                        <Text style={styles.saveText}>Save</Text>
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
        paddingHorizontal: 24,
    },
    card: {
        width: "100%",
        maxWidth: 380,
        backgroundColor: "#242424",
        borderRadius: 16,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 12,
    },
    title: {
        color: "#ffffff",
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 20,
        textAlign: "center",
    },
    input: {
        backgroundColor: "#181818",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.12)",
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: "#ffffff",
        fontSize: 16,
        marginBottom: 24,
    },
    actionsRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12,
    },
    cancelBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 24,
    },
    cancelText: {
        color: appConfig.colors.subText,
        fontSize: 15,
        fontWeight: "600",
    },
    saveBtn: {
        backgroundColor: appConfig.colors.accentGreen,
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    saveBtnDisabled: {
        opacity: 0.4,
    },
    saveText: {
        color: "#000000",
        fontSize: 15,
        fontWeight: "700",
    },
});
