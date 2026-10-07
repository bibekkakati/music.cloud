import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { PlayerProvider } from './src/context/PlayerContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { MiniPlayer } from './src/components/MiniPlayer';
import { NowPlayingModal } from './src/components/NowPlayingModal';
import { PlaylistModal } from './src/components/PlaylistModal';
import { AuthModal } from './src/components/AuthModal';
import { appConfig } from './src/config';

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
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>

      {/* Overlays */}
      <MiniPlayer bottomOffset={bottomOffset} />
      <NowPlayingModal />
      <PlaylistModal />
      <AuthModal />

      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PlayerProvider>
          <MainApp />
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
