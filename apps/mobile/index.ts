import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './src/services/playbackService';

import './src/api';
import App from './App';

registerRootComponent(App);
TrackPlayer.registerPlaybackService(() => PlaybackService);
