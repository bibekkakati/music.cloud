import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDuration } from '@music-cloud/utils';
import { SongCoverArt } from './SongCoverArt';
import { appConfig } from '../config';
import type { SongMetadata } from '@music-cloud/types';

interface SongRowProps {
  song: SongMetadata;
  isCurrent?: boolean;
  isPlaying?: boolean;
  onPress: () => void;
  onMorePress?: () => void;
}

export const SongRow: React.FC<SongRowProps> = ({
  song,
  isCurrent = false,
  isPlaying = false,
  onPress,
  onMorePress,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.row, isCurrent && styles.rowCurrent]}
      onPress={onPress}
    >
      <View style={styles.leftContainer}>
        <SongCoverArt
          src={song.cover_art_url}
          size={48}
          borderRadius={4}
          iconSize={22}
          style={styles.cover}
        />
        <View style={styles.textContainer}>
          <Text
            style={[styles.title, isCurrent && styles.titleCurrent]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {song.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1} ellipsizeMode="tail">
            {song.artist}
          </Text>
        </View>
      </View>

      <View style={styles.rightContainer}>
        {song.duration_sec ? (
          <Text style={styles.duration}>{formatDuration(song.duration_sec)}</Text>
        ) : null}

        {isCurrent && (
          <Ionicons
            name={isPlaying ? 'volume-high' : 'play'}
            size={18}
            color={appConfig.colors.accentGreen}
            style={styles.indicator}
          />
        )}

        {onMorePress && (
          <TouchableOpacity
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={onMorePress}
            style={styles.moreBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={appConfig.colors.subText} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  rowCurrent: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  cover: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: appConfig.colors.primaryText,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  titleCurrent: {
    color: appConfig.colors.accentGreen,
  },
  artist: {
    color: appConfig.colors.subText,
    fontSize: 13,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duration: {
    color: appConfig.colors.subText,
    fontSize: 12,
    marginRight: 10,
  },
  indicator: {
    marginRight: 8,
  },
  moreBtn: {
    padding: 6,
  },
});
