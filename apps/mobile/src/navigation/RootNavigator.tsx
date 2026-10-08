import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeScreen } from "../screens/HomeScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { PlaylistDetailScreen } from "../screens/PlaylistDetailScreen";
import { appConfig } from "../config";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabNavigator() {
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            backBehavior="history"
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: appConfig.colors.bottomNavBg,
                    borderTopColor: "rgba(255, 255, 255, 0.08)",
                    borderTopWidth: 1,
                    height: 58 + insets.bottom,
                    paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: appConfig.colors.primaryText,
                tabBarInactiveTintColor: appConfig.colors.subText,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: "600",
                },
            }}
        >
            <Tab.Screen
                name="HomeTab"
                component={HomeScreen}
                options={{
                    tabBarLabel: "Home",
                    tabBarIcon: ({
                        color,
                        size,
                        focused,
                    }: {
                        color: string;
                        size: number;
                        focused: boolean;
                    }) => (
                        <Ionicons
                            name={focused ? "home" : "home-outline"}
                            size={size - 2}
                            color={color}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="SearchTab"
                component={SearchScreen}
                options={{
                    tabBarLabel: "Search",
                    tabBarIcon: ({
                        color,
                        size,
                        focused,
                    }: {
                        color: string;
                        size: number;
                        focused: boolean;
                    }) => (
                        <Ionicons
                            name={focused ? "search" : "search-outline"}
                            size={size - 2}
                            color={color}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="LibraryTab"
                component={LibraryScreen}
                options={{
                    tabBarLabel: "Your Library",
                    tabBarIcon: ({
                        color,
                        size,
                        focused,
                    }: {
                        color: string;
                        size: number;
                        focused: boolean;
                    }) => (
                        <Ionicons
                            name={focused ? "library" : "library-outline"}
                            size={size - 2}
                            color={color}
                        />
                    ),
                }}
            />
            {/* PlaylistDetail is registered inside MainTabs so the bottom navigation bar remains visible */}
            <Tab.Screen
                name="PlaylistDetail"
                component={PlaylistDetailScreen}
                options={{
                    tabBarItemStyle: { display: "none" },
                    tabBarButton: () => null,
                }}
            />
        </Tab.Navigator>
    );
}

export function RootNavigator() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: appConfig.colors.background },
            }}
        >
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        </Stack.Navigator>
    );
}
