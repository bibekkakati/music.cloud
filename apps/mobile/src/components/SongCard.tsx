import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SongCoverArt } from './SongCoverArt';
import { appConfig } from '../config';
import type { SongMetadata } from '@music-cloud/types';

interface SongCardProps {
  song: SongMetadata;
  isPlaying?: boolean;
  isCurrent?: boolean;
  onPress: () => void;
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  isPlaying = false,
  isCurrent = false,
  onPress,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={styles.card}
      onPress={onPress}
    >
      <View style={styles.coverWrapper}>
        <SongCoverArt
          src={song.cover_art_url}
          size={100}
          borderRadius={6}
          iconSize={32}
          style={styles.coverArt}
        />
        {isCurrent && (
          <View style={styles.playingBadge}>
            <Ionicons
              name={isPlaying ? 'volume-high' : 'play'}
              size={12}
              color={appConfig.colors.accentGreen}
              style={{ marginLeft: isPlaying ? 0 : 1 }}
            />
          </View>
        )}
      </View>

      <Text
        style={[styles.title, isCurrent && styles.titleActive]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {song.title}
      </Text>
      <Text style={styles.artist} numberOfLines={1} ellipsizeMode="tail">
        {song.artist}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 16,
    maxWidth: '33.33%',
  },
  coverWrapper: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: 6,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  coverArt: {
    width: '100%',
    height: '100%',
  },
  playingBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: 3,
  },
  title: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
    lineHeight: 16,
  },
  titleActive: {
    color: appConfig.colors.accentGreen,
  },
  artist: {
    color: appConfig.colors.subText,
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14,
  },
});
