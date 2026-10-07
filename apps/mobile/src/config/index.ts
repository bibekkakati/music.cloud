import { Platform } from 'react-native';

// For physical devices or simulators:
// iOS simulator can reach Mac via localhost or LAN IP.
// Android emulator uses 10.0.2.2 for localhost.
// When testing on real devices over Expo Go, set LAN IP or production endpoint.
const DEFAULT_DEV_HOST = Platform.select({
  android: 'http://10.0.2.2:8000',
  ios: 'http://localhost:8000',
  default: 'http://localhost:8000',
});

export const appConfig = {
  api: {
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_DEV_HOST,
  },
  streaming: {
    token_refresh_margin_ms: 600000, // 10 minutes
    token_fallback_lifetime_ms: 14400000, // 4 hours
  },
  player: {
    default_volume: 1.0,
    seek_step_seconds: 5,
  },
  colors: {
    background: '#121212',
    card: '#181818',
    cardElevated: '#242424',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    primaryText: '#ffffff',
    subText: '#b3b3b3',
    accentGreen: '#1db954',
    accentGreenHover: '#1ed760',
    sliderBg: '#4d4d4d',
    danger: '#e91429',
    bottomNavBg: 'rgba(0, 0, 0, 0.96)',
    topNavBg: 'rgba(18, 18, 18, 0.85)',
  },
  storageKeys: {
    authToken: 'music_cloud_token',
    streamToken: 'mc_stream_token',
    playerState: 'music_cloud_player_state',
    apiBaseUrl: 'music_cloud_api_base_url',
  },
};
