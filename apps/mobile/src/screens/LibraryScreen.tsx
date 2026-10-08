import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { playlistService } from '@music-cloud/services';
import { isLikedPlaylist } from '@music-cloud/utils';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { AppHeader } from '../components/AppHeader';
import { appConfig } from '../config';
import { PlaylistActionSheet } from '../components/PlaylistActionSheet';
import { EditPlaylistModal } from '../components/EditPlaylistModal';
import type { PlaylistSummary } from '@music-cloud/types';

export const LibraryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isAuthenticated, openAuthModal } = useAuth();
  const { openCreatePlaylist, playlistRefreshTrigger, triggerPlaylistRefresh } = useUI();

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [actionPlaylist, setActionPlaylist] = useState<PlaylistSummary | null>(null);
  const [editPlaylist, setEditPlaylist] = useState<PlaylistSummary | null>(null);

  const fetchPlaylists = useCallback(async () => {
    if (!isAuthenticated) {
      setPlaylists([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const data = await playlistService.getAllPlaylists();
      setPlaylists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load library:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists, playlistRefreshTrigger]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchPlaylists();
  };

  const handleDeletePlaylist = async (pl: { id: string; label: string }) => {
    // OPTIMISTIC UPDATE: remove immediately from list
    const prevList = playlists;
    setPlaylists((prev) => prev.filter((p) => p.id !== pl.id));
    triggerPlaylistRefresh();

    try {
      await playlistService.removePlaylist(pl.id);
    } catch (err: any) {
      console.warn("Failed to delete playlist on server, reverting:", err);
      setPlaylists(prevList);
      triggerPlaylistRefresh();
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to delete playlist');
    }
  };

  const handleEditSuccess = (updated: { id: string; label: string }) => {
    setPlaylists((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...p, label: updated.label } : p))
    );
  };

  const likedSongsPlaylist = playlists.find((p) =>
    isLikedPlaylist(p.label, p.is_deletable)
  );
  const customPlaylists = playlists.filter((p) => p.id !== likedSongsPlaylist?.id);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Top Navbar Header */}
        <AppHeader />

        {/* Library Subheader */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Library</Text>
          {isAuthenticated && (
            <TouchableOpacity
              onPress={openCreatePlaylist}
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
                    style={styles.likedArtwork}
                  >
                    <Ionicons name="heart" size={24} color="#ffffff" />
                  </LinearGradient>
                  <View style={styles.playlistDetails}>
                    <View style={styles.labelRow}>
                      <Text style={styles.playlistTitle}>Liked Songs</Text>
                    </View>
                    <Text style={styles.playlistSubtitle}>
                      Playlist • {likedSongsPlaylist?.songs_count || 0} songs
                    </Text>
                  </View>
                </TouchableOpacity>

                {customPlaylists.length > 0 && (
                  <View style={styles.shelfHeader}>
                    <Text style={styles.shelfTitle}>Playlists</Text>
                  </View>
                )}
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
                <View style={styles.defaultArtwork}>
                  <Ionicons name="musical-notes" size={24} color={appConfig.colors.subText} />
                </View>
                <View style={styles.playlistDetails}>
                  <Text style={styles.playlistTitle} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.playlistSubtitle}>
                    Playlist • {item.songs_count || 0} songs
                  </Text>
                </View>
                {item.is_deletable && (
                  <TouchableOpacity
                    style={styles.moreBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    onPress={() => setActionPlaylist(item)}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={20}
                      color={appConfig.colors.subText}
                    />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              likedSongsPlaylist ? null : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No playlists yet</Text>
                  <Text style={styles.emptySubtext}>Tap + above to create one</Text>
                </View>
              )
            }
          />
        )}

        {/* Playlist Context Menu (Rename / Delete) */}
        <PlaylistActionSheet
          visible={Boolean(actionPlaylist)}
          playlist={actionPlaylist}
          onClose={() => setActionPlaylist(null)}
          onEdit={(pl) => {
            const match = playlists.find((p) => p.id === pl.id);
            setActionPlaylist(null);
            setEditPlaylist(match || (pl as PlaylistSummary));
          }}
          onDelete={(pl) => handleDeletePlaylist(pl)}
        />

        {/* Edit Playlist Modal */}
        <EditPlaylistModal
          visible={Boolean(editPlaylist)}
          playlist={editPlaylist}
          onClose={() => setEditPlaylist(null)}
          onSuccess={handleEditSuccess}
        />
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  addBtn: {
    padding: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  guestTitle: {
    color: '#ffffff',
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
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  loginBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 140,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 14,
  },
  likedArtwork: {
    width: 52,
    height: 52,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultArtwork: {
    width: 52,
    height: 52,
    borderRadius: 4,
    backgroundColor: '#242424',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistDetails: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playlistTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  pinBadge: {
    fontSize: 12,
  },
  playlistSubtitle: {
    color: appConfig.colors.subText,
    fontSize: 13,
  },
  shelfHeader: {
    marginTop: 16,
    marginBottom: 8,
  },
  shelfTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtext: {
    color: appConfig.colors.subText,
    fontSize: 13,
  },
  moreBtn: {
    padding: 8,
  },
});
