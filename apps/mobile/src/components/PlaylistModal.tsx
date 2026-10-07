import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { playlistService } from '../services/playlistService';
import { appConfig } from '../config';
import type { PlaylistSummary } from '@music-cloud/types';

export const PlaylistModal: React.FC = () => {
  const { playlistModalSong, closePlaylistModal } = usePlayer();

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!playlistModalSong) return;

    let active = true;
    setIsLoading(true);

    playlistService
      .getAllPlaylists(playlistModalSong.id)
      .then((data) => {
        if (active) setPlaylists(data);
      })
      .catch((err) => {
        console.warn('Failed to load playlists:', err);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [playlistModalSong]);

  if (!playlistModalSong) return null;

  const handleToggleSongInPlaylist = async (playlist: PlaylistSummary) => {
    setActionLoadingId(playlist.id);
    try {
      if (playlist.contains_song) {
        await playlistService.removeSongFromPlaylistBySongId(playlist.id, playlistModalSong.id);
        setPlaylists((prev) =>
          prev.map((p) => (p.id === playlist.id ? { ...p, contains_song: false } : p))
        );
      } else {
        await playlistService.addSongToPlaylist({
          playlist_id: playlist.id,
          song_id: playlistModalSong.id,
        });
        setPlaylists((prev) =>
          prev.map((p) => (p.id === playlist.id ? { ...p, contains_song: true } : p))
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to update playlist');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newTitle.trim()) return;
    try {
      const created = await playlistService.createPlaylist({ label: newTitle.trim() });
      await playlistService.addSongToPlaylist({
        playlist_id: created.id,
        song_id: playlistModalSong.id,
      });
      setPlaylists((prev) => [{ ...created, contains_song: true }, ...prev]);
      setNewTitle('');
      setIsCreating(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create playlist');
    }
  };

  return (
    <Modal
      visible={!!playlistModalSong}
      transparent
      animationType="fade"
      onRequestClose={closePlaylistModal}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Add to playlist</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {playlistModalSong.title}
              </Text>
            </View>
            <TouchableOpacity onPress={closePlaylistModal} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={appConfig.colors.subText} />
            </TouchableOpacity>
          </View>

          {/* New Playlist Row */}
          {!isCreating ? (
            <TouchableOpacity
              style={styles.newPlaylistBtn}
              onPress={() => setIsCreating(true)}
            >
              <View style={styles.plusIconBox}>
                <Ionicons name="add" size={24} color="#ffffff" />
              </View>
              <Text style={styles.newPlaylistText}>New playlist</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.createBox}>
              <TextInput
                style={styles.input}
                placeholder="Playlist name"
                placeholderTextColor={appConfig.colors.subText}
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
              />
              <View style={styles.createActions}>
                <TouchableOpacity
                  onPress={() => setIsCreating(false)}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreatePlaylist}
                  style={styles.confirmBtn}
                >
                  <Text style={styles.confirmText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Playlists List */}
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={appConfig.colors.accentGreen} />
            </View>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = item.contains_song;
                const isBusy = actionLoadingId === item.id;

                return (
                  <TouchableOpacity
                    style={styles.playlistItem}
                    onPress={() => handleToggleSongInPlaylist(item)}
                    disabled={isBusy}
                  >
                    <View style={styles.playlistIcon}>
                      <Ionicons name="musical-notes" size={20} color={appConfig.colors.subText} />
                    </View>
                    <Text style={styles.playlistName} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {isBusy ? (
                      <ActivityIndicator size="small" color={appConfig.colors.accentGreen} />
                    ) : (
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={isSelected ? appConfig.colors.accentGreen : appConfig.colors.subText}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: appConfig.colors.primaryText,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: appConfig.colors.subText,
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  newPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  plusIconBox: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: '#282828',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  newPlaylistText: {
    color: appConfig.colors.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  createBox: {
    marginVertical: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  input: {
    backgroundColor: '#282828',
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    fontSize: 14,
    marginBottom: 10,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelText: {
    color: appConfig.colors.subText,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: appConfig.colors.accentGreen,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  confirmText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    marginTop: 8,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  playlistIcon: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: '#282828',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playlistName: {
    flex: 1,
    color: appConfig.colors.primaryText,
    fontSize: 15,
    fontWeight: '500',
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
});
