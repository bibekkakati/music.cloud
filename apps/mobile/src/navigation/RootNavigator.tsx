import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeScreen } from "../screens/HomeScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { SongCollectionView } from "../screens/SongCollectionView";
import { SettingsScreen } from "../screens/SettingsScreen";
import { appConfig } from "../config";
import { useNetwork } from "../context/NetworkContext";
import { useAuth } from "../context/AuthContext";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Screen wrapper for Offline / Guest Downloads Tab
function OfflineDownloadsTabScreen() {
    return (
        <SongCollectionView />
    );
}

function MainTabNavigator() {
    const insets = useSafeAreaInsets();
    const { isOffline } = useNetwork();
    const { isAuthenticated } = useAuth();

    // Guest users (online but unauthenticated) get the same tabs as offline users (Home + Downloads)
    const showOfflineOrGuestTabs = isOffline || !isAuthenticated;

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

            {showOfflineOrGuestTabs ? (
                /* Offline / Guest Bottom Bar: Downloads Tab */
                <Tab.Screen
                    name="DownloadsTab"
                    component={OfflineDownloadsTabScreen}
                    initialParams={{
                        isDownloadsMode: true,
                        title: "Downloaded Songs",
                    }}
                    options={{
                        tabBarLabel: "Downloads",
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
                                name={focused ? "arrow-down-circle" : "arrow-down-circle-outline"}
                                size={size - 2}
                                color={color}
                            />
                        ),
                    }}
                />
            ) : (
                /* Online Authenticated Bottom Bar: Search & Library Tabs */
                <>
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
                                    name={focused ? "list" : "list-outline"}
                                    size={size - 2}
                                    color={color}
                                />
                            ),
                        }}
                    />
                </>
            )}

            {/* PlaylistDetail & CategoryDetail are registered inside MainTabs so the bottom navigation bar remains visible */}
            <Tab.Screen
                name="PlaylistDetail"
                component={SongCollectionView}
                options={{
                    tabBarItemStyle: { display: "none" },
                    tabBarButton: () => null,
                }}
            />
            <Tab.Screen
                name="CategoryDetail"
                component={SongCollectionView}
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
            <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
    );
}
