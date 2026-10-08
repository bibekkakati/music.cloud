import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
import { AppLogo } from './AppLogo';

export const AuthModal: React.FC = () => {
  const { isAuthModalVisible, closeAuthModal, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(appConfig.api.baseUrl);

  if (!isAuthModalVisible) return null;

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter email and passcode');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await login({ email: email.trim(), password });
      closeAuthModal();
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.detail || err.message || 'Authentication failed'
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
      <TouchableWithoutFeedback onPress={closeAuthModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
          {/* Close button top right */}
          <TouchableOpacity
            onPress={closeAuthModal}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color={appConfig.colors.subText} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Centered App Logo */}
            <View style={styles.iconBadgeWrapper}>
              <AppLogo size={56} />
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.title}>Log in to Music Cloud</Text>
            <Text style={styles.subtitle}>
              Enter your email and passcode. New accounts are registered automatically.
            </Text>

            {/* Error Message if any */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={appConfig.colors.subText}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="name@domain.com"
                  placeholderTextColor={appConfig.colors.subText}
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    setErrorMessage(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Passcode Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Passcode</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={appConfig.colors.subText}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={appConfig.colors.subText}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    setErrorMessage(null);
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Big Green Log In Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.submitBtnText}>Log In</Text>
              )}
            </TouchableOpacity>

            {/* Collapsed Server Settings Toggle for Dev */}
            <TouchableOpacity
              style={styles.configToggle}
              onPress={() => setShowServerConfig(!showServerConfig)}
            >
              <Ionicons name="settings-outline" size={13} color={appConfig.colors.subText} />
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
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#282828',
    borderRadius: 8,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.7,
    shadowRadius: 32,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  iconBadgeWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: appConfig.colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: appConfig.colors.subText,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    paddingVertical: 12,
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: appConfig.colors.accentGreen,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  submitBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
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
    marginTop: 10,
    padding: 12,
    backgroundColor: '#1c1c1c',
    borderRadius: 6,
  },
  serverLabel: {
    color: appConfig.colors.subText,
    fontSize: 11,
    marginBottom: 4,
  },
  serverInput: {
    backgroundColor: '#121212',
    color: '#ffffff',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
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
