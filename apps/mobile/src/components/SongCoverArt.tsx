import React, { useState } from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { appConfig } from "../config";

interface SongCoverArtProps {
    src?: string | null;
    size?: number;
    borderRadius?: number;
    iconSize?: number;
    style?: StyleProp<ViewStyle>;
    transition?: number;
}

export const SongCoverArt: React.FC<SongCoverArtProps> = ({
    src,
    size = 48,
    borderRadius = 4,
    iconSize = 22,
    style,
    transition = 0,
}) => {
    const [hasError, setHasError] = useState(false);
    const lastSrcRef = React.useRef(src);
    if (src !== lastSrcRef.current) {
        lastSrcRef.current = src;
        if (hasError) setHasError(false);
    }

    const containerStyle = [
        styles.container,
        {
            width: size,
            height: size,
            borderRadius,
        },
        style,
    ];

    if (!src || hasError) {
        return (
            <View style={containerStyle}>
                <Ionicons
                    name="musical-notes"
                    size={iconSize}
                    color={appConfig.colors.subText}
                    style={{ opacity: 0.6 }}
                />
            </View>
        );
    }

    return (
        <View style={containerStyle}>
            <Image
                source={{ uri: src }}
                style={{
                    width: "100%",
                    height: "100%",
                    borderRadius,
                }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={transition}
                onError={() => setHasError(true)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#282828",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
});
