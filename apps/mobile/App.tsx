import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { PlayerProvider } from './src/context/PlayerContext';
import { UIProvider } from './src/context/UIContext';
import { navigationRef } from './src/navigation/navigationRef';
import { RootNavigator } from './src/navigation/RootNavigator';
import { MiniPlayer } from './src/components/MiniPlayer';
import { NowPlayingModal } from './src/components/NowPlayingModal';
import { PlaylistModal } from './src/components/PlaylistModal';
import { CreatePlaylistModal } from './src/components/CreatePlaylistModal';
import { AuthModal } from './src/components/AuthModal';
import { AppDrawer } from './src/components/AppDrawer';
import { appConfig } from './src/config';

// Prevent splash screen from disappearing before DarkTheme renders
SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: appConfig.colors.background,
    card: appConfig.colors.card,
    text: appConfig.colors.primaryText,
    border: 'rgba(255, 255, 255, 0.08)',
    primary: appConfig.colors.accentGreen,
  },
};

function MainApp() {
  const insets = useSafeAreaInsets();
  const bottomOffset = 58 + (insets.bottom > 0 ? insets.bottom : 8) + 6;

  return (
    <View style={styles.container}>
      <NavigationContainer
        ref={navigationRef}
        theme={navTheme}
      >
        <RootNavigator />
        <AppDrawer />
      </NavigationContainer>

      {/* Overlays */}
      <MiniPlayer bottomOffset={bottomOffset} />
      <NowPlayingModal />
      <PlaylistModal />
      <CreatePlaylistModal />
      <AuthModal />

      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  useEffect(() => {
    // Hide native splash screen smoothly once root app mounted
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PlayerProvider>
          <UIProvider>
            <MainApp />
          </UIProvider>
        </PlayerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appConfig.colors.background,
  },
});
