import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { appConfig } from '../config';
import { updateApiBaseUrl } from '../api/client';

export const AuthModal: React.FC = () => {
  const { isAuthModalVisible, closeAuthModal, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(appConfig.api.baseUrl);

  if (!isAuthModalVisible) return null;

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (err: any) {
      Alert.alert(
        'Sign In Failed',
        err?.response?.data?.detail || err.message || 'Invalid credentials'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveServerUrl = () => {
    if (!serverUrl.trim()) return;
    updateApiBaseUrl(serverUrl.trim());
    Alert.alert('Server Updated', `API endpoint set to: ${serverUrl.trim()}`);
    setShowServerConfig(false);
  };

  return (
    <Modal
      visible={isAuthModalVisible}
      transparent
      animationType="fade"
      onRequestClose={closeAuthModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brand}>
              <View style={styles.logoBadge}>
                <Ionicons name="cloud" size={20} color={appConfig.colors.accentGreen} />
              </View>
              <Text style={styles.brandTitle}>Music Cloud</Text>
            </View>
            <TouchableOpacity onPress={closeAuthModal} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={appConfig.colors.subText} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.welcomeText}>Sign in to start listening</Text>
            <Text style={styles.descText}>
              Access your library, high-bitrate audio, and customized playlists.
            </Text>

            {/* Email Field */}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="name@domain.com"
              placeholderTextColor={appConfig.colors.subText}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Password Field */}
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={appConfig.colors.subText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {/* Sign In Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.submitBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Server Settings Toggle (Helpful for local network dev / testing on phone) */}
            <TouchableOpacity
              style={styles.configToggle}
              onPress={() => setShowServerConfig(!showServerConfig)}
            >
              <Ionicons name="settings-outline" size={14} color={appConfig.colors.subText} />
              <Text style={styles.configToggleText}>
                {showServerConfig ? 'Hide Server Settings' : 'Configure Backend URL'}
              </Text>
            </TouchableOpacity>

            {showServerConfig && (
              <View style={styles.serverBox}>
                <Text style={styles.serverLabel}>Backend Host URL</Text>
                <TextInput
                  style={styles.serverInput}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="http://192.168.1.x:8000"
                  placeholderTextColor={appConfig.colors.subText}
                />
                <TouchableOpacity style={styles.serverSaveBtn} onPress={handleSaveServerUrl}>
                  <Text style={styles.serverSaveText}>Save URL</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#181818',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  welcomeText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  descText: {
    color: appConfig.colors.subText,
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  label: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#242424',
    color: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  submitBtn: {
    backgroundColor: appConfig.colors.accentGreen,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  configToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  configToggleText: {
    color: appConfig.colors.subText,
    fontSize: 12,
  },
  serverBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#202020',
    borderRadius: 8,
  },
  serverLabel: {
    color: appConfig.colors.subText,
    fontSize: 11,
    marginBottom: 4,
  },
  serverInput: {
    backgroundColor: '#121212',
    color: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 8,
  },
  serverSaveBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    paddingVertical: 6,
    alignItems: 'center',
  },
  serverSaveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
