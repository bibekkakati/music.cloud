import React, { useEffect, useState, useCallback } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { playlistService } from "@music-cloud/services";
import type { CategoryMasterResponse } from "@music-cloud/types";
import { getCardColorByIndex } from "@music-cloud/utils";
import { AppHeader } from "../components/AppHeader";
import { appConfig } from "../config";

export interface MobileDisplayCategory {
    uniqueKey: string;
    id: string | number;
    title: string;
    color: string;
    section?: string;
}

// In-memory module-level session cache
let cachedMasterCategories: MobileDisplayCategory[] | null = null;

export const SearchScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const [categories, setCategories] = useState<MobileDisplayCategory[]>(
        () => cachedMasterCategories || [],
    );
    const [loading, setLoading] = useState<boolean>(!cachedMasterCategories);
    const [error, setError] = useState<string | null>(null);

    const fetchCategories = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data: CategoryMasterResponse =
                await playlistService.getCategoryMaster();

            const items: MobileDisplayCategory[] = [];
            let colorIdx = 0;

            // 1. Static categories displayed in front/top
            if (data.static && data.static.length > 0) {
                data.static.forEach((s) => {
                    items.push({
                        uniqueKey: `static-${s.id}`,
                        id: s.id,
                        title: s.label,
                        color: getCardColorByIndex(colorIdx++),
                        section: "Featured",
                    });
                });
            }

            // 2. Genres
            if (data.genres && data.genres.length > 0) {
                data.genres.forEach((g) => {
                    items.push({
                        uniqueKey: `genre-${g.id}`,
                        id: g.id,
                        title: g.label,
                        color: getCardColorByIndex(colorIdx++),
                        section: "Genres",
                    });
                });
            }

            // 3. Moods
            if (data.moods && data.moods.length > 0) {
                data.moods.forEach((m) => {
                    items.push({
                        uniqueKey: `mood-${m.id}`,
                        id: m.id,
                        title: m.label,
                        color: getCardColorByIndex(colorIdx++),
                        section: "Moods",
                    });
                });
            }

            // 4. Languages
            if (data.languages && data.languages.length > 0) {
                data.languages.forEach((l) => {
                    items.push({
                        uniqueKey: `lang-${l.id}`,
                        id: l.id,
                        title: l.label,
                        color: getCardColorByIndex(colorIdx++),
                        section: "Languages",
                    });
                });
            }

            cachedMasterCategories = items;
            setCategories(items);
        } catch (err: unknown) {
            console.error("Failed to load categories on mobile:", err);
            setError(
                "Could not load categories. Please check your network connection.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!cachedMasterCategories) {
            fetchCategories();
        }
    }, [fetchCategories]);

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <View style={styles.container}>
                {/* Top Navbar Header */}
                <AppHeader />

                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#1DB954" />
                        <Text style={styles.statusText}>
                            Loading categories...
                        </Text>
                    </View>
                ) : error ? (
                    <View style={styles.centerContainer}>
                        <Ionicons
                            name="cloud-offline-outline"
                            size={48}
                            color="#b3b3b3"
                        />
                        <Text style={styles.errorTitle}>
                            Connection Required
                        </Text>
                        <Text style={styles.errorSubtitle}>{error}</Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={fetchCategories}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="refresh"
                                size={18}
                                color="#ffffff"
                                style={{ marginRight: 6 }}
                            />
                            <Text style={styles.retryButtonText}>
                                Try Again
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    /* Browse All Categories Grid */
                    <FlatList
                        key="categories-grid"
                        data={categories}
                        keyExtractor={(item) => item.uniqueKey}
                        numColumns={2}
                        columnWrapperStyle={styles.categoryColumnWrapper}
                        contentContainerStyle={styles.categoryContent}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={
                            <View style={styles.categoryHeader}>
                                <Text style={styles.categoryHeaderTitle}>
                                    Browse all
                                </Text>
                            </View>
                        }
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[
                                    styles.categoryCard,
                                    { backgroundColor: item.color },
                                ]}
                                activeOpacity={0.8}
                                onPress={() => {
                                    navigation.navigate("CategoryDetail", {
                                        categoryLabel: item.title,
                                        categoryId: item.id,
                                        title: item.title,
                                    });
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
    categoryContent: {
        paddingHorizontal: 16,
        paddingBottom: 140,
    },
    categoryHeader: {
        marginBottom: 16,
        marginTop: 16,
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
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32,
        paddingBottom: 80,
    },
    statusText: {
        color: "#b3b3b3",
        fontSize: 14,
        marginTop: 12,
        fontWeight: "500",
    },
    errorTitle: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "700",
        marginTop: 16,
        marginBottom: 8,
    },
    errorSubtitle: {
        color: "#b3b3b3",
        fontSize: 14,
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 20,
    },
    retryButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1DB954",
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 24,
    },
    retryButtonText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "700",
    },
});
