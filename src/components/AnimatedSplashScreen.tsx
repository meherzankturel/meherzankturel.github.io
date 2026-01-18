import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SyncLogo } from './SyncLogo';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  onAnimationComplete?: () => void;
  duration?: number;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  onAnimationComplete,
  duration = 2500,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo fade in and scale up
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Heartbeat pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.delay(500),
      ])
    ).start();

    // Callback after duration
    if (onAnimationComplete) {
      const timer = setTimeout(onAnimationComplete, duration);
      return () => clearTimeout(timer);
    }
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.5],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0F', '#0D0D14', '#0A0A0F']}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow effect */}
      <Animated.View style={[styles.ambientGlow, { opacity: glowOpacity }]} />

      {/* Logo with animations */}
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <SyncLogo size="large" showText={true} />
      </Animated.View>

      {/* Subtle corner accents */}
      <View style={styles.cornerTopLeft} />
      <View style={styles.cornerBottomRight} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0F',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    borderRadius: SCREEN_WIDTH * 0.4,
    backgroundColor: '#00D4FF',
    opacity: 0.1,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 60,
    left: 30,
    width: 30,
    height: 30,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(100, 120, 150, 0.15)',
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 60,
    right: 30,
    width: 30,
    height: 30,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(100, 120, 150, 0.15)',
  },
});

export default AnimatedSplashScreen;
