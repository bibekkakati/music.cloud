import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { songService } from '../services/songService';
import { usePlayer } from '../context/PlayerContext';
import { SongRow } from '../components/SongRow';
import { appConfig } from '../config';
import type { SongMetadata } from '@music-cloud/types';

const CATEGORIES = [
  { id: '1', title: 'Pop', color: '#8d67ab' },
  { id: '2', title: 'Hip-Hop', color: '#ba5d07' },
  { id: '3', title: 'Rock', color: '#e91429' },
  { id: '4', title: 'Electronic', color: '#148a08' },
  { id: '5', title: 'Chill', color: '#27856a' },
  { id: '6', title: 'Workout', color: '#503750' },
  { id: '7', title: 'Focus', color: '#477d95' },
  { id: '8', title: 'Indie', color: '#af2896' },
];

export const SearchScreen: React.FC = () => {
  const { currentSong, isPlaying, playSong, openPlaylistModal } = usePlayer();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!query.trim() || query.trim().length < 3) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const data = await songService.searchSuggestions(query.trim());
        setResults(data);
      } catch (err) {
        console.warn('Search query error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Search</Text>

        {/* Search Bar Input */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={appConfig.colors.subText} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="What do you want to listen to?"
            placeholderTextColor={appConfig.colors.subText}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS === 'android' && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={appConfig.colors.subText} />
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        {isSearching ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={appConfig.colors.accentGreen} />
          </View>
        ) : query.trim().length >= 3 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.centerContainer}>
                <Ionicons name="search-outline" size={48} color={appConfig.colors.subText} />
                <Text style={styles.emptyTitle}>No results found</Text>
                <Text style={styles.emptySubtext}>
                  Please make sure your words are spelled correctly or use different keywords.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <SongRow
                song={item}
                isCurrent={currentSong?.id === item.id}
                isPlaying={isPlaying && currentSong?.id === item.id}
                onPress={() => playSong(item, results)}
                onMorePress={() => openPlaylistModal(item)}
              />
            )}
          />
        ) : (
          <FlatList
            data={CATEGORIES}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.categoryColumnWrapper}
            contentContainerStyle={styles.categoryContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <Text style={styles.sectionTitle}>Browse All</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.categoryCard, { backgroundColor: item.color }]}
                activeOpacity={0.8}
                onPress={() => setQuery(item.title)}
              >
                <Text style={styles.categoryTitle}>{item.title}</Text>
              </TouchableOpacity>
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
  headerTitle: {
    color: appConfig.colors.primaryText,
    fontSize: 26,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#242424',
    borderRadius: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
  },
  clearBtn: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 120,
  },
  centerContainer: {
    paddingTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: appConfig.colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtext: {
    color: appConfig.colors.subText,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  sectionTitle: {
    color: appConfig.colors.primaryText,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  categoryContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  categoryColumnWrapper: {
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    height: 96,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    justifyContent: 'flex-start',
  },
  categoryTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
