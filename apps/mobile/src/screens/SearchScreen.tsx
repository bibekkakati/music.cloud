import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { songService } from "@music-cloud/services";
import { BROWSE_CATEGORIES } from "@music-cloud/utils";
import { usePlayer } from "../context/PlayerContext";
import { AppHeader } from "../components/AppHeader";
import { SongRow } from "../components/SongRow";
import { appConfig } from "../config";
import type { SongMetadata } from "@music-cloud/types";

export const SearchScreen: React.FC = () => {
    const { currentSong, isPlaying, playSong, togglePlay, openPlaylistModal } =
        usePlayer();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SongMetadata[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const debounceTimer = useRef<any>(null);

    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (!query.trim() || query.trim().length < 2) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        debounceTimer.current = setTimeout(async () => {
            try {
                const data = await songService.searchSuggestions(query.trim());
                setResults(data);
            } catch (err) {
                console.warn("Search query error:", err);
            } finally {
                setIsSearching(false);
            }
        }, 200);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [query]);

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <View style={styles.container}>
                {/* Top Navbar Header */}
                <AppHeader />

                {/* Category Filter Active Header */}
                {query.trim().length >= 2 && (
                    <View style={styles.activeFilterHeader}>
                        <View style={styles.activeFilterLeft}>
                            <Text style={styles.filterLabel}>Browsing:</Text>
                            <Text style={styles.filterValue}>{query}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setQuery("")}
                            style={styles.clearFilterBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons
                                name="close-circle"
                                size={20}
                                color={appConfig.colors.subText}
                            />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Content */}
                {isSearching ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator
                            size="large"
                            color={appConfig.colors.accentGreen}
                        />
                    </View>
                ) : query.trim().length >= 2 ? (
                    <FlatList
                        key="search-results-list"
                        data={results}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.centerContainer}>
                                <Ionicons
                                    name="search-outline"
                                    size={48}
                                    color={appConfig.colors.subText}
                                />
                                <Text style={styles.emptyTitle}>
                                    No songs found for "{query}"
                                </Text>
                                <Text style={styles.emptySubtext}>
                                    Try selecting another category or keyword.
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
                                        playSong(item, results);
                                    }
                                }}
                                onMorePress={() => openPlaylistModal(item)}
                            />
                        )}
                    />
                ) : (
                    /* Browse All Categories Grid */
                    <FlatList
                        key="categories-grid"
                        data={BROWSE_CATEGORIES}
                        keyExtractor={(item) => item.id}
                        numColumns={2}
                        columnWrapperStyle={styles.categoryColumnWrapper}
                        contentContainerStyle={styles.categoryContent}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={
                            <View style={styles.categoryHeader} />
                        }
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[
                                    styles.categoryCard,
                                    { backgroundColor: item.color },
                                ]}
                                activeOpacity={0.8}
                                onPress={() => {
                                    setQuery(item.title);
                                }}
                            >
                                <Text style={styles.categoryTitle}>
                                    {item.title}
                                </Text>
                                {/* Watermark Rotated Music Note Art */}
                                <View style={styles.watermarkIcon}>
                                    <Ionicons
                                        name="musical-notes"
                                        size={38}
                                        color="rgba(255, 255, 255, 0.45)"
                                    />
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                )}
            </View>
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
    activeFilterHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: "#1e1e1e",
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.08)",
    },
    activeFilterLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    filterLabel: {
        color: appConfig.colors.subText,
        fontSize: 13,
        fontWeight: "500",
    },
    filterValue: {
        color: appConfig.colors.accentGreen,
        fontSize: 15,
        fontWeight: "700",
    },
    clearFilterBtn: {
        padding: 4,
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 140,
    },
    emptyTitle: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "700",
        marginTop: 16,
        marginBottom: 6,
        textAlign: "center",
    },
    emptySubtext: {
        color: appConfig.colors.subText,
        fontSize: 13,
        textAlign: "center",
        lineHeight: 18,
    },
    categoryContent: {
        paddingHorizontal: 16,
        paddingBottom: 140,
    },
    categoryHeader: {
        marginBottom: 16,
        marginTop: 4,
    },
    categoryHeaderTitle: {
        color: "#ffffff",
        fontSize: 22,
        fontWeight: "800",
        letterSpacing: -0.3,
    },
    categoryColumnWrapper: {
        justifyContent: "space-between",
    },
    categoryCard: {
        width: "48%",
        height: 104,
        borderRadius: 8,
        padding: 12,
        marginBottom: 14,
        overflow: "hidden",
        position: "relative",
    },
    categoryTitle: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "800",
        lineHeight: 18,
        width: "80%",
    },
    watermarkIcon: {
        position: "absolute",
        bottom: -6,
        right: -4,
        transform: [{ rotate: "25deg" }],
    },
});
