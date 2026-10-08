import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Dimensions,
    Animated,
    Alert,
    Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { playlistService } from "@music-cloud/services";
import { isLikedPlaylist } from "@music-cloud/utils";
import type { PlaylistSummary } from "@music-cloud/types";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { AppLogo } from "./AppLogo";
import { appConfig } from "../config";

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(width * 0.82, 320);

export const AppDrawer: React.FC = () => {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { user, isAuthenticated, openAuthModal, logout } = useAuth();
    const {
        isDrawerOpen,
        closeDrawer,
        openCreatePlaylist,
        playlistRefreshTrigger,
    } = useUI();

    const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            playlistService
                .getAllPlaylists()
                .then(setPlaylists)
                .catch(() => {});
        } else {
            setPlaylists([]);
        }
    }, [isAuthenticated, playlistRefreshTrigger]);

    if (!isDrawerOpen) return null;

    const likedPlaylist = playlists.find((p) =>
        isLikedPlaylist(p.label, p.is_deletable),
    );
    const otherPlaylists = playlists.filter((p) => p.id !== likedPlaylist?.id);

    const filteredPlaylists = otherPlaylists.filter((p) =>
        p.label.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const handleNav = (tabName: string) => {
        closeDrawer();
        navigation.navigate(tabName);
    };

    const handleOpenPlaylist = (playlist: PlaylistSummary) => {
        closeDrawer();
        navigation.navigate("PlaylistDetail", {
            playlistId: playlist.id,
            title: playlist.label,
        });
    };

    const handleLogout = () => {
        Alert.alert("Log out", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log out",
                style: "destructive",
                onPress: async () => {
                    await logout();
                    closeDrawer();
                },
            },
        ]);
    };

    const username = user?.email?.split("@")[0] || "user";
    const initial = (user?.email?.[0] || "U").toUpperCase();

    return (
        <Modal
            visible={isDrawerOpen}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={closeDrawer}
        >
            <View style={styles.overlay}>
                {/* Backdrop overlay tap closes drawer */}
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={closeDrawer}
                />

                {/* Drawer Panel with safe area padding */}
                <View
                    style={[
                        styles.drawerPanel,
                        {
                            paddingTop: Math.max(
                                insets.top,
                                Platform.OS === "android" ? 24 : 12,
                            ),
                            paddingBottom: Math.max(insets.bottom, 16),
                        },
                    ]}
                >
                    {/* Top Island: Brand & Core Navigation */}
                    <View style={styles.topIsland}>
                        {/* Brand Header */}
                        <View style={styles.brandRow}>
                            <AppLogo size={28} showText={true} textSize={18} />
                            <TouchableOpacity
                                onPress={closeDrawer}
                                style={styles.closeBtn}
                                hitSlop={{
                                    top: 8,
                                    bottom: 8,
                                    left: 8,
                                    right: 8,
                                }}
                            >
                                <Ionicons
                                    name="close"
                                    size={22}
                                    color={appConfig.colors.subText}
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Nav Links */}
                        <View style={styles.navLinks}>
                            <TouchableOpacity
                                style={styles.navItem}
                                onPress={() => handleNav("HomeTab")}
                            >
                                <Ionicons
                                    name="home"
                                    size={22}
                                    color="#ffffff"
                                />
                                <Text style={styles.navText}>Home</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.navItem}
                                onPress={() => handleNav("SearchTab")}
                            >
                                <Ionicons
                                    name="compass-outline"
                                    size={22}
                                    color={appConfig.colors.subText}
                                />
                                <Text style={styles.navTextInactive}>
                                    Search
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bottom Island: Your Library */}
                    <View style={styles.libraryIsland}>
                        {/* Library Header */}
                        <View style={styles.libraryHeader}>
                            <View style={styles.libraryTitleRow}>
                                <Ionicons
                                    name="library"
                                    size={20}
                                    color={appConfig.colors.subText}
                                />
                                <Text style={styles.libraryTitle}>
                                    Your Library
                                </Text>
                            </View>

                            {isAuthenticated && (
                                <TouchableOpacity
                                    onPress={() => {
                                        closeDrawer();
                                        openCreatePlaylist();
                                    }}
                                    style={styles.plusBtn}
                                    hitSlop={{
                                        top: 8,
                                        bottom: 8,
                                        left: 8,
                                        right: 8,
                                    }}
                                >
                                    <Ionicons
                                        name="add"
                                        size={22}
                                        color={appConfig.colors.subText}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>

                        {!isAuthenticated ? (
                            /* Unauthenticated Guest Callout */
                            <View style={styles.guestCard}>
                                <Text style={styles.guestCardTitle}>
                                    Create your first playlist
                                </Text>
                                <Text style={styles.guestCardDesc}>
                                    It's easy, we'll help you organize your
                                    music and stream high-fidelity audio.
                                </Text>
                                <TouchableOpacity
                                    style={styles.guestLoginBtn}
                                    onPress={() => {
                                        closeDrawer();
                                        openAuthModal();
                                    }}
                                >
                                    <Text style={styles.guestLoginBtnText}>
                                        Log In
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            /* Authenticated Playlists */
                            <View style={{ flex: 1 }}>
                                {/* Search and Recents row */}
                                <View style={styles.filterRow}>
                                    <TouchableOpacity
                                        onPress={() =>
                                            setShowSearch(!showSearch)
                                        }
                                        style={styles.searchToggleBtn}
                                    >
                                        <Ionicons
                                            name="search"
                                            size={16}
                                            color={appConfig.colors.subText}
                                        />
                                    </TouchableOpacity>

                                    <View style={styles.recentsRow}>
                                        <Text style={styles.recentsText}>
                                            Recents
                                        </Text>
                                        <Ionicons
                                            name="list"
                                            size={16}
                                            color={appConfig.colors.subText}
                                        />
                                    </View>
                                </View>

                                {showSearch && (
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search playlists..."
                                        placeholderTextColor={
                                            appConfig.colors.subText
                                        }
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        autoFocus
                                    />
                                )}

                                <ScrollView
                                    showsVerticalScrollIndicator={false}
                                    style={{ flex: 1 }}
                                >
                                    {/* Liked Songs Tile */}
                                    {likedPlaylist && (
                                        <TouchableOpacity
                                            style={styles.playlistItem}
                                            onPress={() =>
                                                handleOpenPlaylist(
                                                    likedPlaylist,
                                                )
                                            }
                                        >
                                            <LinearGradient
                                                colors={["#450af5", "#8e8ee5"]}
                                                style={styles.likedThumb}
                                            >
                                                <Ionicons
                                                    name="heart"
                                                    size={18}
                                                    color="#ffffff"
                                                />
                                            </LinearGradient>
                                            <View style={styles.playlistMeta}>
                                                <View
                                                    style={styles.likedLabelRow}
                                                >
                                                    <Text
                                                        style={
                                                            styles.playlistTitle
                                                        }
                                                    >
                                                        Liked
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={styles.playlistSub}
                                                >
                                                    Playlist •{" "}
                                                    {likedPlaylist.songs_count ||
                                                        0}{" "}
                                                    songs
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}

                                    {/* Custom Playlists */}
                                    {filteredPlaylists.map((playlist) => (
                                        <TouchableOpacity
                                            key={playlist.id}
                                            style={styles.playlistItem}
                                            onPress={() =>
                                                handleOpenPlaylist(playlist)
                                            }
                                        >
                                            <View style={styles.playlistThumb}>
                                                <Ionicons
                                                    name="musical-notes"
                                                    size={18}
                                                    color={
                                                        appConfig.colors.subText
                                                    }
                                                />
                                            </View>
                                            <View style={styles.playlistMeta}>
                                                <Text
                                                    style={styles.playlistTitle}
                                                    numberOfLines={1}
                                                >
                                                    {playlist.label}
                                                </Text>
                                                <Text
                                                    style={styles.playlistSub}
                                                >
                                                    Playlist •{" "}
                                                    {playlist.songs_count || 0}{" "}
                                                    songs
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    {/* Bottom Profile Row (Authenticated) */}
                    {isAuthenticated && (
                        <View style={styles.userFooter}>
                            <View style={styles.userProfile}>
                                <View style={styles.userAvatar}>
                                    <Text style={styles.userAvatarText}>
                                        {initial}
                                    </Text>
                                </View>
                                <Text style={styles.userName} numberOfLines={1}>
                                    {username}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={handleLogout}
                                style={styles.logoutBtn}
                                hitSlop={{
                                    top: 8,
                                    bottom: 8,
                                    left: 8,
                                    right: 8,
                                }}
                            >
                                <Ionicons
                                    name="log-out-outline"
                                    size={20}
                                    color={appConfig.colors.subText}
                                />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        flexDirection: "row",
    },
    backdrop: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
    },
    drawerPanel: {
        width: DRAWER_WIDTH,
        height: "100%",
        backgroundColor: "#000000",
        paddingHorizontal: 8,
        paddingVertical: 4,
        shadowColor: "#000",
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 20,
    },
    safeArea: {
        flex: 1,
    },
    topIsland: {
        backgroundColor: "#121212",
        borderRadius: 8,
        padding: 14,
        marginBottom: 8,
    },
    brandRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    closeBtn: {
        padding: 4,
    },
    navLinks: {
        gap: 12,
    },
    navItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingVertical: 4,
    },
    navText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "700",
    },
    navTextInactive: {
        color: appConfig.colors.subText,
        fontSize: 14,
        fontWeight: "700",
    },
    libraryIsland: {
        flex: 1,
        backgroundColor: "#121212",
        borderRadius: 8,
        padding: 14,
    },
    libraryHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
    },
    libraryTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    libraryTitle: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "700",
    },
    plusBtn: {
        padding: 2,
    },
    guestCard: {
        backgroundColor: "#1f1f1f",
        borderRadius: 8,
        padding: 16,
        marginTop: 8,
    },
    guestCardTitle: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 6,
    },
    guestCardDesc: {
        color: appConfig.colors.subText,
        fontSize: 12,
        lineHeight: 16,
        marginBottom: 14,
    },
    guestLoginBtn: {
        backgroundColor: "#ffffff",
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignSelf: "flex-start",
    },
    guestLoginBtnText: {
        color: "#000000",
        fontSize: 13,
        fontWeight: "700",
    },
    filterRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    searchToggleBtn: {
        padding: 4,
    },
    recentsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    recentsText: {
        color: appConfig.colors.subText,
        fontSize: 12,
        fontWeight: "500",
    },
    searchInput: {
        backgroundColor: "#242424",
        color: "#ffffff",
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 12,
        marginBottom: 10,
    },
    playlistItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 6,
    },
    likedThumb: {
        width: 44,
        height: 44,
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
    },
    playlistThumb: {
        width: 44,
        height: 44,
        borderRadius: 4,
        backgroundColor: "#282828",
        alignItems: "center",
        justifyContent: "center",
    },
    playlistMeta: {
        flex: 1,
    },
    likedLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    playlistTitle: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 2,
    },
    pinIcon: {
        fontSize: 11,
    },
    playlistSub: {
        color: appConfig.colors.subText,
        fontSize: 12,
    },
    userFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: "#121212",
        borderRadius: 8,
        marginTop: 8,
    },
    userProfile: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flex: 1,
    },
    userAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: appConfig.colors.accentGreen,
        alignItems: "center",
        justifyContent: "center",
    },
    userAvatarText: {
        color: "#000000",
        fontSize: 13,
        fontWeight: "800",
    },
    userName: {
        color: "#ffffff",
        fontSize: 13,
        fontWeight: "600",
        flex: 1,
    },
    logoutBtn: {
        padding: 4,
    },
});
