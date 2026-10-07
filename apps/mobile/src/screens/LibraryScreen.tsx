import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { playlistService } from '../services/playlistService';
import { useAuth } from '../context/AuthContext';
import { appConfig } from '../config';
import type { PlaylistSummary } from '@music-cloud/types';

export const LibraryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isAuthenticated, openAuthModal } = useAuth();

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');

  const fetchPlaylists = useCallback(async () => {
    if (!isAuthenticated) {
      setPlaylists([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const data = await playlistService.getAllPlaylists();
      setPlaylists(data);
    } catch (err) {
      console.warn('Failed to load library:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchPlaylists();
  };

  const handleCreatePlaylist = async () => {
    if (!newTitle.trim()) return;
    try {
      const created = await playlistService.createPlaylist({ label: newTitle.trim() });
      setPlaylists((prev) => [created, ...prev]);
      setNewTitle('');
      setIsCreateModalOpen(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create playlist');
    }
  };

  const likedSongsPlaylist = playlists.find(
    (p) => p.label.toLowerCase() === 'liked songs' || !p.is_deletable
  );
  const customPlaylists = playlists.filter((p) => p.id !== likedSongsPlaylist?.id);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Library</Text>
          {isAuthenticated && (
            <TouchableOpacity
              onPress={() => setIsCreateModalOpen(true)}
              style={styles.addBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="add" size={28} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>

        {!isAuthenticated ? (
          <View style={styles.guestContainer}>
            <Ionicons name="library-outline" size={64} color={appConfig.colors.subText} />
            <Text style={styles.guestTitle}>Enjoy your library</Text>
            <Text style={styles.guestDesc}>
              Log in to see your Liked Songs and create personalized playlists.
            </Text>
            <TouchableOpacity style={styles.loginBtn} onPress={openAuthModal}>
              <Text style={styles.loginBtnText}>Log In</Text>
            </TouchableOpacity>
          </View>
        ) : isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={appConfig.colors.accentGreen} />
          </View>
        ) : (
          <FlatList
            data={customPlaylists}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={appConfig.colors.accentGreen}
              />
            }
            ListHeaderComponent={
              <View>
                {/* Liked Songs Tile */}
                <TouchableOpacity
                  style={styles.playlistRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (likedSongsPlaylist) {
                      navigation.navigate('PlaylistDetail', {
                        playlistId: likedSongsPlaylist.id,
                        title: likedSongsPlaylist.label,
                      });
                    }
                  }}
                >
                  <LinearGradient
                    colors={['#450af5', '#8e8ee5']}
                    style={styles.likedCover}
                  >
                    <Ionicons name="heart" size={24} color="#ffffff" />
                  </LinearGradient>
                  <View style={styles.playlistMeta}>
                    <Text style={styles.playlistTitle}>Liked Songs</Text>
                    <Text style={styles.playlistSub}>
                      {likedSongsPlaylist?.songs_count ?? 0} tracks • Playlist
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.playlistRow}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('PlaylistDetail', {
                    playlistId: item.id,
                    title: item.label,
                  })
                }
              >
                <View style={styles.customCover}>
                  <Ionicons name="musical-notes" size={24} color={appConfig.colors.subText} />
                </View>
                <View style={styles.playlistMeta}>
                  <Text style={styles.playlistTitle} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.playlistSub}>
                    {item.songs_count ?? 0} tracks • Playlist
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {/* Create Playlist Modal */}
        <Modal
          visible={isCreateModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsCreateModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalHeading}>Give your playlist a name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="My Playlist #1"
                placeholderTextColor={appConfig.colors.subText}
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setIsCreateModalOpen(false)}
                  style={styles.modalCancel}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreatePlaylist}
                  style={styles.modalConfirm}
                >
                  <Text style={styles.modalConfirmText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: appConfig.colors.background,
  },
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerTitle: {
    color: appConfig.colors.primaryText,
    fontSize: 26,
    fontWeight: '800',
  },
  addBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  likedCover: {
    width: 56,
    height: 56,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  customCover: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#282828',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  playlistMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  playlistTitle: {
    color: appConfig.colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  playlistSub: {
    color: appConfig.colors.subText,
    fontSize: 13,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  guestTitle: {
    color: appConfig.colors.primaryText,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  guestDesc: {
    color: appConfig.colors.subText,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  loginBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  loginBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 20,
  },
  modalHeading: {
    color: appConfig.colors.primaryText,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#2b2b2b',
    color: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: appConfig.colors.subText,
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirm: {
    backgroundColor: appConfig.colors.accentGreen,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  modalConfirmText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
});
