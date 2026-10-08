import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { songService } from '@music-cloud/services';
import type { SongMetadata } from '@music-cloud/types';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { useUI } from '../context/UIContext';
import { AppLogo } from './AppLogo';
import { SongCoverArt } from './SongCoverArt';
import { appConfig } from '../config';

interface AppHeaderProps {
  onSearchPress?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onSearchPress }) => {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const { playSong } = usePlayer();
  const { openDrawer } = useUI();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SongMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Debounced search (200ms) matching web Navbar
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await songService.searchSuggestions(trimmed, 8);
        setSuggestions(results);
        setIsOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectSong = (song: SongMetadata) => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    playSong(song, suggestions);
    setIsOpen(false);
    setQuery('');
    Keyboard.dismiss();
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  const userInitial = (user?.email?.[0] || 'U').toUpperCase();

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        {/* 1. Left: Brand Logo (opens Side Drawer) */}
        <TouchableOpacity
          onPress={openDrawer}
          style={styles.logoBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppLogo size={32} />
        </TouchableOpacity>

        {/* 2. Center: Interactive Search Input */}
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={16}
            color={appConfig.colors.subText}
            style={styles.searchIcon}
          />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="What do you want to play?"
            placeholderTextColor={appConfig.colors.subText}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={appConfig.colors.accentGreen} style={styles.clearBtn} />
          ) : query.length > 0 ? (
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={appConfig.colors.subText} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 3. Right: Log in button (Guest) OR User Avatar (Authenticated) */}
        <View style={styles.rightAction}>
          {!isAuthenticated ? (
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={openAuthModal}
              activeOpacity={0.8}
            >
              <Text style={styles.loginBtnText}>Log in</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={openDrawer}
              activeOpacity={0.7}
            >
              <Text style={styles.avatarText}>{userInitial}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Floating Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={() => {
              setIsOpen(false);
              Keyboard.dismiss();
            }}
          />
          <View style={styles.dropdownContainer}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.dropdownScroll}
            >
              {suggestions.map((song) => (
                <TouchableOpacity
                  key={song.id}
                  style={styles.suggestionItem}
                  activeOpacity={0.7}
                  onPress={() => handleSelectSong(song)}
                >
                  <SongCoverArt
                    src={song.cover_art_url}
                    size={38}
                    borderRadius={4}
                    iconSize={18}
                  />
                  <View style={styles.suggestionMeta}>
                    <Text style={styles.suggestionTitle} numberOfLines={1}>
                      {song.title}
                    </Text>
                    <Text style={styles.suggestionArtist} numberOfLines={1}>
                      {song.artist}
                    </Text>
                  </View>
                  <View style={styles.playIconBadge}>
                    <Ionicons name="play" size={14} color="#000000" style={{ marginLeft: 1 }} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 1000,
    backgroundColor: appConfig.colors.background,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 10,
  },
  logoBtn: {
    padding: 2,
  },
  searchBar: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#242424',
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
    padding: 0,
  },
  clearBtn: {
    padding: 2,
    marginLeft: 4,
  },
  rightAction: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  loginBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#242424',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    height: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    maxHeight: 320,
    backgroundColor: '#282828',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 16,
    overflow: 'hidden',
  },
  dropdownScroll: {
    paddingVertical: 6,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  suggestionMeta: {
    flex: 1,
  },
  suggestionTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  suggestionArtist: {
    color: appConfig.colors.subText,
    fontSize: 12,
  },
  playIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: appConfig.colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
