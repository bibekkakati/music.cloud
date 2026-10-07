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
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { songService } from '../services/songService';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { SongCard } from '../components/SongCard';
import { appConfig } from '../config';
import type { SongMetadata } from '@music-cloud/types';

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export const HomeScreen: React.FC = () => {
  const { currentSong, isPlaying, playSong } = usePlayer();
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();

  const [songs, setSongs] = useState<SongMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchSongs = useCallback(async () => {
    try {
      const data = await songService.getAllSongs();
      setSongs(data);
    } catch (err) {
      console.warn('Failed to load songs:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchSongs();
  };

  const handleProfilePress = () => {
    if (!isAuthenticated) {
      openAuthModal();
    } else {
      Alert.alert(
        'Account',
        `Logged in as ${user?.email || 'User'}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: () => logout(),
          },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.subGreeting}>Welcome to Music Cloud</Text>
          </View>

          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={handleProfilePress}
            activeOpacity={0.8}
          >
            {isAuthenticated ? (
              <View style={styles.avatarLogged}>
                <Text style={styles.avatarInitial}>
                  {(user?.email?.[0] || 'U').toUpperCase()}
                </Text>
              </View>
            ) : (
              <View style={styles.avatarGuest}>
                <Ionicons name="person-circle-outline" size={32} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Song Grid */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={appConfig.colors.accentGreen} />
          </View>
        ) : (
          <FlatList
            data={songs}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
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
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Featured Tracks</Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="musical-notes-outline" size={48} color={appConfig.colors.subText} />
                <Text style={styles.emptyText}>No tracks found</Text>
                <Text style={styles.emptySubtext}>Pull down to refresh or check backend connection</Text>
              </View>
            }
            renderItem={({ item }) => (
              <SongCard
                song={item}
                isCurrent={currentSong?.id === item.id}
                isPlaying={isPlaying && currentSong?.id === item.id}
                onPress={() => playSong(item, songs)}
              />
            )}
          />
        )}
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
    paddingBottom: 16,
  },
  greeting: {
    color: appConfig.colors.primaryText,
    fontSize: 24,
    fontWeight: '800',
  },
  subGreeting: {
    color: appConfig.colors.subText,
    fontSize: 13,
    marginTop: 2,
  },
  avatarBtn: {
    padding: 4,
  },
  avatarLogged: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appConfig.colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  avatarGuest: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: appConfig.colors.primaryText,
    fontSize: 18,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120, // space for mini player + bottom nav
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: appConfig.colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    color: appConfig.colors.subText,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 240,
  },
});
