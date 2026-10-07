import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { SongCoverArt } from './SongCoverArt';
import { appConfig } from '../config';

const { width } = Dimensions.get('window');
const COVER_SIZE = Math.min(width - 64, 340);

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const NowPlayingModal: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLoop,
    isShuffle,
    isLiked,
    isNowPlayingOpen,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleLoop,
    toggleShuffle,
    toggleLike,
    closeNowPlaying,
    openPlaylistModal,
  } = usePlayer();

  if (!currentSong) return null;

  return (
    <Modal
      visible={isNowPlayingOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closeNowPlaying}
    >
      <LinearGradient
        colors={['#2c2c2c', '#181818', '#121212']}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Top Bar Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={closeNowPlaying}
              style={styles.headerBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-down" size={28} color="#ffffff" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>PLAYING FROM LIBRARY</Text>

            <View style={styles.headerSpacer} />
          </View>

          {/* Center Album Art */}
          <View style={styles.coverWrapper}>
            <SongCoverArt
              src={currentSong.cover_art_url}
              size={COVER_SIZE}
              borderRadius={10}
              iconSize={72}
              style={styles.coverArt}
            />
          </View>

          {/* Title & Artist & Like / Add */}
          <View style={styles.metaRow}>
            <View style={styles.metaText}>
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {currentSong.title}
              </Text>
              <Text style={styles.artist} numberOfLines={1} ellipsizeMode="tail">
                {currentSong.artist}
              </Text>
            </View>

            <View style={styles.metaActions}>
              <TouchableOpacity
                onPress={() => {
                  if (!isAuthenticated) {
                    openAuthModal();
                    return;
                  }
                  toggleLike();
                }}
                style={styles.metaActionBtn}
              >
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={26}
                  color={isLiked ? appConfig.colors.accentGreen : appConfig.colors.subText}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (!isAuthenticated) {
                    openAuthModal();
                    return;
                  }
                  openPlaylistModal(currentSong);
                }}
                style={styles.metaActionBtn}
              >
                <Ionicons name="add-circle-outline" size={26} color={appConfig.colors.subText} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrubber / Progress Slider */}
          <View style={styles.sliderContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={duration > 0 ? duration : 100}
              value={currentTime}
              onSlidingComplete={seek}
              minimumTrackTintColor="#ffffff"
              maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
              thumbTintColor="#ffffff"
            />
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          {/* Playback Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={toggleShuffle} style={styles.controlBtn}>
              <Ionicons
                name="shuffle"
                size={22}
                color={isShuffle ? appConfig.colors.accentGreen : appConfig.colors.subText}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={prevTrack} style={styles.controlBtn}>
              <Ionicons name="play-skip-back" size={28} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={togglePlay}
              activeOpacity={0.8}
              style={styles.playPauseBtn}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={30}
                color="#000000"
                style={{ marginLeft: isPlaying ? 0 : 2 }}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={nextTrack} style={styles.controlBtn}>
              <Ionicons name="play-skip-forward" size={28} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleLoop} style={styles.controlBtn}>
              <Ionicons
                name="repeat"
                size={22}
                color={isLoop ? appConfig.colors.accentGreen : appConfig.colors.subText}
              />
            </TouchableOpacity>
          </View>

          {/* Volume Slider */}
          <View style={styles.volumeRow}>
            <TouchableOpacity onPress={toggleMute} style={styles.volumeIconBtn}>
              <Ionicons
                name={isMuted || volume === 0 ? 'volume-mute' : 'volume-high'}
                size={20}
                color={appConfig.colors.subText}
              />
            </TouchableOpacity>
            <Slider
              style={styles.volumeSlider}
              minimumValue={0}
              maximumValue={1}
              value={isMuted ? 0 : volume}
              onSlidingComplete={setVolume}
              minimumTrackTintColor="#ffffff"
              maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
              thumbTintColor="#ffffff"
            />
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'android' ? 24 : 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    color: appConfig.colors.subText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerSpacer: {
    width: 32,
  },
  coverWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  coverArt: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  metaText: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    color: appConfig.colors.primaryText,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  artist: {
    color: appConfig.colors.subText,
    fontSize: 16,
    fontWeight: '500',
  },
  metaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaActionBtn: {
    padding: 6,
  },
  sliderContainer: {
    width: '100%',
    marginVertical: 8,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  timeText: {
    color: appConfig.colors.subText,
    fontSize: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
    paddingHorizontal: 8,
  },
  controlBtn: {
    padding: 10,
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  volumeIconBtn: {
    padding: 6,
    marginRight: 8,
  },
  volumeSlider: {
    flex: 1,
    height: 36,
  },
});
