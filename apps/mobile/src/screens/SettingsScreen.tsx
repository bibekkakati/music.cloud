import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { getActiveApiBaseUrl, updateApiBaseUrl } from "../api/client";
import { appConfig } from "../config";

export const SettingsScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { user, isAuthenticated, logout, openAuthModal } = useAuth();

    const [backendUrl, setBackendUrl] = useState<string>("");
    const [initialUrl, setInitialUrl] = useState<string>("");
    const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

    useEffect(() => {
        getActiveApiBaseUrl().then((url) => {
            setBackendUrl(url);
            setInitialUrl(url);
            setIsLoadingUrl(false);
        });
    }, []);

    const handleSaveUrl = async () => {
        const trimmed = backendUrl.trim();
        if (!trimmed) {
            Alert.alert("Invalid URL", "Backend URL cannot be empty.");
            return;
        }

        if (!/^https?:\/\//i.test(trimmed)) {
            Alert.alert(
                "Invalid URL",
                "Backend URL must start with http:// or https://",
            );
            return;
        }

        try {
            setIsSaving(true);
            const savedUrl = await updateApiBaseUrl(trimmed);
            setBackendUrl(savedUrl);
            setInitialUrl(savedUrl);
            Alert.alert(
                "Backend Updated",
                `API base URL has been set to:\n${savedUrl}`,
            );
        } catch {
            Alert.alert("Error", "Failed to update backend URL.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetUrl = async () => {
        const defaultUrl = appConfig.api.baseUrl || "";
        try {
            setIsSaving(true);
            const saved = await updateApiBaseUrl(defaultUrl);
            setBackendUrl(saved);
            setInitialUrl(saved);
            Alert.alert(
                "Reset Complete",
                `Backend URL reset to default:\n${saved || "Default Environment URL"}`,
            );
        } catch {
            Alert.alert("Error", "Failed to reset backend URL.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        Alert.alert("Log out", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log out",
                style: "destructive",
                onPress: async () => {
                    setIsLoggingOut(true);
                    try {
                        await logout();
                    } finally {
                        setIsLoggingOut(false);
                    }
                },
            },
        ]);
    };

    const isUrlModified = backendUrl.trim() !== initialUrl.trim();

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={26}
                            color="#ffffff"
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Settings</Text>
                    <View style={{ width: 36 }} />
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Section 1: Server Configuration */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Ionicons
                                name="server-outline"
                                size={18}
                                color={appConfig.colors.accentGreen}
                            />
                            <Text style={styles.sectionTitle}>
                                Server Configuration
                            </Text>
                        </View>

                        <Text style={styles.sectionDesc}>
                            Connect to your private, self-hosted MusicCloud API
                            instance. All API queries, streams, and sync
                            requests will use this address.
                        </Text>

                        <View style={styles.inputWrapper}>
                            <Ionicons
                                name="link-outline"
                                size={18}
                                color={appConfig.colors.subText}
                                style={styles.inputIcon}
                            />
                            {isLoadingUrl ? (
                                <ActivityIndicator
                                    size="small"
                                    color={appConfig.colors.accentGreen}
                                    style={{ flex: 1 }}
                                />
                            ) : (
                                <TextInput
                                    style={styles.input}
                                    value={backendUrl}
                                    onChangeText={setBackendUrl}
                                    placeholder="https://api.yourcloud.com"
                                    placeholderTextColor={
                                        appConfig.colors.subText
                                    }
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="url"
                                />
                            )}
                            {backendUrl.length > 0 && !isLoadingUrl && (
                                <TouchableOpacity
                                    onPress={() => setBackendUrl("")}
                                    hitSlop={{
                                        top: 8,
                                        bottom: 8,
                                        left: 8,
                                        right: 8,
                                    }}
                                >
                                    <Ionicons
                                        name="close-circle"
                                        size={18}
                                        color={appConfig.colors.subText}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.btnRow}>
                            <TouchableOpacity
                                style={[
                                    styles.saveBtn,
                                    !isUrlModified && styles.btnDisabled,
                                ]}
                                onPress={handleSaveUrl}
                                disabled={!isUrlModified || isSaving}
                                activeOpacity={0.8}
                            >
                                {isSaving ? (
                                    <ActivityIndicator
                                        size="small"
                                        color="#000000"
                                    />
                                ) : (
                                    <>
                                        <Ionicons
                                            name="checkmark"
                                            size={16}
                                            color="#000000"
                                        />
                                        <Text style={styles.saveBtnText}>
                                            Save Backend URL
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.resetBtn}
                                onPress={handleResetUrl}
                                disabled={isSaving}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name="refresh-outline"
                                    size={15}
                                    color={appConfig.colors.subText}
                                />
                                <Text style={styles.resetBtnText}>
                                    Reset to Default
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Section 2: Account */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Ionicons
                                name="person-outline"
                                size={18}
                                color={appConfig.colors.accentGreen}
                            />
                            <Text style={styles.sectionTitle}>Account</Text>
                        </View>

                        {isAuthenticated ? (
                            <View style={styles.accountCard}>
                                <View style={styles.accountInfoRow}>
                                    <View style={styles.avatarBadge}>
                                        <Text style={styles.avatarText}>
                                            {(
                                                user?.email?.[0] || "U"
                                            ).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            style={styles.accountEmail}
                                            numberOfLines={1}
                                        >
                                            {user?.email}
                                        </Text>
                                        <Text style={styles.accountRole}>
                                            {user?.is_admin
                                                ? "Administrator"
                                                : "Member"}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.logoutBtn}
                                    onPress={handleLogout}
                                    disabled={isLoggingOut}
                                    activeOpacity={0.8}
                                >
                                    {isLoggingOut ? (
                                        <ActivityIndicator
                                            size="small"
                                            color="#ffffff"
                                        />
                                    ) : (
                                        <>
                                            <Ionicons
                                                name="log-out-outline"
                                                size={18}
                                                color="#ffffff"
                                            />
                                            <Text style={styles.logoutBtnText}>
                                                Log Out
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.accountCard}>
                                <Text style={styles.guestText}>
                                    You are currently using MusicCloud as a
                                    guest. Sign in to access your cloud library
                                    and sync playlists.
                                </Text>
                                <TouchableOpacity
                                    style={styles.loginBtn}
                                    onPress={openAuthModal}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name="log-in-outline"
                                        size={18}
                                        color="#000000"
                                    />
                                    <Text style={styles.loginBtnText}>
                                        Log In
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Section 3: App Information */}
                    <View style={styles.footerSection}>
                        <Text style={styles.appVersionText}>
                            MusicCloud Mobile • v1.1.0
                        </Text>
                        <Text style={styles.appSubText}>
                            Private High-Fidelity Audio Streaming Cloud
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: appConfig.colors.background,
    },
    header: {
        height: 54,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.08)",
    },
    backBtn: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "800",
        letterSpacing: -0.3,
    },
    scroll: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 40,
        gap: 24,
    },
    section: {
        backgroundColor: appConfig.colors.card,
        borderRadius: 12,
        padding: 18,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    sectionTitle: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "700",
    },
    sectionDesc: {
        color: appConfig.colors.subText,
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 16,
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#242424",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        paddingHorizontal: 12,
        height: 46,
        marginBottom: 16,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "500",
        height: "100%",
        padding: 0,
    },
    btnRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
    },
    saveBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: appConfig.colors.accentGreen,
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 18,
    },
    btnDisabled: {
        opacity: 0.4,
    },
    saveBtnText: {
        color: "#000000",
        fontSize: 13,
        fontWeight: "700",
    },
    resetBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    resetBtnText: {
        color: appConfig.colors.subText,
        fontSize: 13,
        fontWeight: "600",
    },
    accountCard: {
        gap: 16,
    },
    accountInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    avatarBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#282828",
        borderWidth: 1.5,
        borderColor: "rgba(255, 255, 255, 0.2)",
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "800",
    },
    accountEmail: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "700",
        marginBottom: 2,
    },
    accountRole: {
        color: appConfig.colors.subText,
        fontSize: 12,
        fontWeight: "500",
    },
    logoutBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#dc2626",
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    logoutBtnText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "700",
    },
    guestText: {
        color: appConfig.colors.subText,
        fontSize: 13,
        lineHeight: 18,
    },
    loginBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#ffffff",
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    loginBtnText: {
        color: "#000000",
        fontSize: 14,
        fontWeight: "700",
    },
    footerSection: {
        alignItems: "center",
        paddingVertical: 16,
        gap: 4,
    },
    appVersionText: {
        color: appConfig.colors.subText,
        fontSize: 12,
        fontWeight: "600",
    },
    appSubText: {
        color: "rgba(255, 255, 255, 0.3)",
        fontSize: 11,
    },
});
