import React from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { BROWSE_CATEGORIES } from "@music-cloud/utils";
import { AppHeader } from "../components/AppHeader";
import { appConfig } from "../config";

export const SearchScreen: React.FC = () => {
    const navigation = useNavigation<any>();

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <View style={styles.container}>
                {/* Top Navbar Header */}
                <AppHeader />

                {/* Browse All Categories Grid */}
                <FlatList
                    key="categories-grid"
                    data={BROWSE_CATEGORIES}
                    keyExtractor={(item) => item.id}
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
});
