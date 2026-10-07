import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { SongCoverArt } from './SongCoverArt';
import { appConfig } from '../config';

interface MiniPlayerProps {
  bottomOffset?: number;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ bottomOffset = 58 }) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    isLiked,
    toggleLike,
    openNowPlaying,
  } = usePlayer();

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={[styles.container, { bottom: bottomOffset }]}>
      {/* 2px top edge progress line */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(0, progressPercent))}%` }]} />
      </View>

      <View style={styles.contentRow}>
        {/* Left: Tap to open full Now Playing screen */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.songInfoBtn}
          onPress={openNowPlaying}
        >
          <SongCoverArt
            src={currentSong.cover_art_url}
            size={42}
            borderRadius={4}
            iconSize={20}
            style={styles.coverArt}
          />
          <View style={styles.metadata}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {currentSong.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1} ellipsizeMode="tail">
              {currentSong.artist}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right: Quick actions (Like + Play/Pause) */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => {
              if (!isAuthenticated) {
                openAuthModal();
                return;
              }
              toggleLike();
            }}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={22}
              color={isLiked ? appConfig.colors.accentGreen : appConfig.colors.subText}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playBtn}
            activeOpacity={0.7}
            onPress={() => {
              if (!isAuthenticated) {
                openAuthModal();
                return;
              }
              togglePlay();
            }}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color="#000000"
              style={{ marginLeft: isPlaying ? 0 : 2 }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 58,
    backgroundColor: 'rgba(30, 30, 30, 0.98)',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 90,
  },
  progressBarTrack: {
    height: 2,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: appConfig.colors.accentGreen,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  songInfoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  coverArt: {
    marginRight: 10,
  },
  metadata: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: appConfig.colors.primaryText,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  artist: {
    color: appConfig.colors.subText,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    padding: 6,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
