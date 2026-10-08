import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface AppLogoProps {
  size?: number;
  showText?: boolean;
  textSize?: number;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 32,
  showText = false,
  textSize = 17,
}) => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/icon.png')}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="contain"
      />
      {showText && (
        <Text style={[styles.text, { fontSize: textSize }]}>Music Cloud</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
