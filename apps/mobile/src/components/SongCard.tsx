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
      style={[styles.card, isCurrent && styles.cardActive]}
      onPress={onPress}
    >
      <View style={styles.coverWrapper}>
        <SongCoverArt
          src={song.cover_art_url}
          size={140}
          borderRadius={6}
          iconSize={42}
          style={styles.coverArt}
        />
        {isCurrent && (
          <View style={styles.playingBadge}>
            <Ionicons
              name={isPlaying ? 'volume-high' : 'pause'}
              size={16}
              color={appConfig.colors.accentGreen}
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
    backgroundColor: appConfig.colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    width: '48%',
  },
  cardActive: {
    backgroundColor: appConfig.colors.cardElevated,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.3)',
  },
  coverWrapper: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: 10,
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
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
    padding: 4,
  },
  title: {
    color: appConfig.colors.primaryText,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  titleActive: {
    color: appConfig.colors.accentGreen,
  },
  artist: {
    color: appConfig.colors.subText,
    fontSize: 12,
    fontWeight: '500',
  },
});
