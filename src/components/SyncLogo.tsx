import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface SyncLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export const SyncLogo: React.FC<SyncLogoProps> = ({ 
  size = 'large',
  showText = true 
}) => {
  const dimensions = {
    small: { logo: 80, text: 60 },
    medium: { logo: 160, text: 120 },
    large: { logo: 240, text: 180 },
  };

  const d = dimensions[size];

  return (
    <View style={styles.container}>
      {/* User's exact logo image */}
      <Image
        source={require('../../assets/sync-logo.png')}
        style={[styles.logo, { 
          width: d.logo, 
          height: d.logo,
        }]}
        resizeMode="contain"
      />

      {/* User's exact SYNC text image */}
      {showText && (
        <Image
          source={require('../../assets/sync-text.png')}
          style={[styles.syncText, { 
            width: d.text,
            height: d.text * 0.3,
            marginTop: 16,
          }]}
          resizeMode="contain"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    // No additional styling needed - using exact user image
  },
  syncText: {
    // No additional styling needed - using exact user image
  },
});

export default SyncLogo;
