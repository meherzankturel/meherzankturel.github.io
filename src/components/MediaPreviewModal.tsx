import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  Animated,
  StatusBar,
  Share,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../config/theme';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Set audio mode for video playback with sound
Audio.setAudioModeAsync({
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  shouldDuckAndroid: true,
});

// Beautiful VideoPlayer component with audio
function VideoPlayer({ uri, isActive }: { uri: string; isActive: boolean }) {
  const videoRef = useRef<Video>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for play button
  useEffect(() => {
    if (!isPlaying && hasLoaded) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPlaying, hasLoaded]);

  useEffect(() => {
    if (!videoRef.current || !hasLoaded) return;

    if (isActive) {
      videoRef.current.playAsync().catch(console.error);
    } else {
      videoRef.current.pauseAsync().catch(console.error);
    }
  }, [isActive, hasLoaded]);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setLoading(false);
      setHasLoaded(true);
      setIsPlaying(status.isPlaying);
      setError(null);
      setProgress(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsMuted(status.isMuted || false);
    } else if (status.error) {
      setLoading(false);
      setError(status.error);
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch (e) {
      console.error('Toggle play/pause error:', e);
    }
  }, [isPlaying]);

  const toggleMute = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await videoRef.current.setIsMutedAsync(!isMuted);
    } catch (e) {
      console.error('Toggle mute error:', e);
    }
  }, [isMuted]);

  const seekTo = useCallback(async (position: number) => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.setPositionAsync(position);
    } catch (e) {
      console.error('Seek error:', e);
    }
  }, []);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <View style={styles.videoContainer}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460']}
          style={styles.videoErrorGradient}
        >
          <View style={styles.errorIconContainer}>
            <Ionicons name="videocam-off" size={56} color="rgba(255,255,255,0.6)" />
          </View>
          <Text style={styles.videoErrorTitle}>Unable to play video</Text>
          <Text style={styles.videoErrorSubtext}>{error}</Text>
          <TouchableOpacity
            style={styles.openExternalButton}
            onPress={() => Linking.openURL(uri)}
          >
            <Ionicons name="open-outline" size={18} color="#fff" />
            <Text style={styles.openExternalText}>Open in Browser</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.videoContainer}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a', '#0a0a0a']}
        style={StyleSheet.absoluteFill}
      />

      {loading && (
        <View style={styles.videoLoading}>
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      )}

      <Video
        ref={videoRef}
        source={{ uri }}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={isActive}
        isLooping={false}
        isMuted={false}
        volume={1.0}
        useNativeControls={false}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onError={(e) => setError(e || 'Unknown error')}
        onLoad={() => {
          setLoading(false);
          setHasLoaded(true);
        }}
        onLoadStart={() => setLoading(true)}
      />

      {/* Tap overlay for play/pause */}
      <TouchableOpacity
        style={styles.videoTapArea}
        onPress={togglePlayPause}
        activeOpacity={1}
      >
        {/* Play button overlay */}
        {hasLoaded && !isPlaying && !loading && (
          <Animated.View style={[styles.playButtonContainer, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primaryDark]}
              style={styles.playButtonGradient}
            >
              <Ionicons name="play" size={44} color="#fff" style={{ marginLeft: 4 }} />
            </LinearGradient>
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* Bottom controls */}
      {hasLoaded && (
        <View style={styles.videoControls}>
          <BlurView intensity={80} tint="dark" style={styles.controlsBlur}>
            {/* Progress bar */}
            <View style={styles.progressSection}>
              <Text style={styles.timeText}>{formatTime(progress)}</Text>
              <TouchableOpacity
                style={styles.progressBarContainer}
                onPress={(e) => {
                  const { locationX } = e.nativeEvent;
                  const percentage = locationX / (SCREEN_WIDTH - 120);
                  const newPosition = percentage * duration;
                  seekTo(Math.max(0, Math.min(newPosition, duration)));
                }}
                activeOpacity={1}
              >
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${(progress / duration) * 100}%` }]} />
                  <View style={[styles.progressThumb, { left: `${(progress / duration) * 100}%` }]} />
                </View>
              </TouchableOpacity>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            {/* Control buttons */}
            <View style={styles.controlButtons}>
              <TouchableOpacity onPress={togglePlayPause} style={styles.controlButton}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleMute} style={styles.controlButton}>
                <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}
    </View>
  );
}

// Beautiful Image Viewer Component
function ImageViewer({
  uri,
  isActive,
  onTap,
}: {
  uri: string;
  isActive: boolean;
  onTap: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);

  // Reset scale when not active
  useEffect(() => {
    if (!isActive) {
      scale.setValue(1);
      lastScale.current = 1;
    }
  }, [isActive]);

  const handleDoubleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (lastScale.current > 1) {
      lastScale.current = 1;
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }).start();
    } else {
      lastScale.current = 2.5;
      Animated.spring(scale, {
        toValue: 2.5,
        useNativeDriver: true,
        friction: 5,
      }).start();
    }
  }, []);

  if (error) {
    return (
      <View style={styles.imageContainer}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.imageErrorContainer}
        >
          <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.4)" />
          <Text style={styles.imageErrorText}>Failed to load image</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.imageContainer}
      activeOpacity={1}
      onPress={onTap}
      onLongPress={handleDoubleTap}
      delayLongPress={200}
    >
      {loading && (
        <View style={styles.imageLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
      <Animated.Image
        source={{ uri }}
        style={[styles.image, { transform: [{ scale }] }]}
        resizeMode="contain"
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
    </TouchableOpacity>
  );
}

export interface MediaItem {
  uri: string;
  type: 'image' | 'video';
}

interface MediaPreviewModalProps {
  visible: boolean;
  mediaItems: MediaItem[];
  initialIndex?: number;
  onClose: () => void;
}

export default function MediaPreviewModal({
  visible,
  mediaItems,
  initialIndex = 0,
  onClose,
}: MediaPreviewModalProps) {
  console.log('📱 MediaPreviewModal render:', { visible, itemCount: mediaItems.length, initialIndex });

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [saving, setSaving] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  // Reset and animate in when modal opens
  useEffect(() => {
    console.log('📱 MediaPreviewModal useEffect - visible changed:', visible);
    if (visible) {
      console.log('📱 Modal opening with', mediaItems.length, 'items');
      setCurrentIndex(initialIndex);
      setShowControls(true);
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      controlsOpacity.setValue(1);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
        }),
      ]).start();

      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 50);
    }
  }, [visible, initialIndex]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && visible) {
      const timer = setTimeout(() => {
        if (mediaItems[currentIndex]?.type === 'video') return;
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showControls, currentIndex, visible]);

  const toggleControls = useCallback(() => {
    const newValue = !showControls;
    setShowControls(newValue);
    Animated.timing(controlsOpacity, {
      toValue: newValue ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showControls]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [onClose]);

  const handleSave = useCallback(async () => {
    const currentMedia = mediaItems[currentIndex];
    if (!currentMedia) return;

    setSaving(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need access to your photo library to save media. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        setSaving(false);
        return;
      }

      // Determine file extension
      const isVideo = currentMedia.type === 'video';
      let extension = isVideo ? 'mp4' : 'jpg';

      // Try to get extension from URL
      const urlParts = currentMedia.uri.split('.');
      if (urlParts.length > 1) {
        const urlExt = urlParts[urlParts.length - 1].split('?')[0].toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi'].includes(urlExt)) {
          extension = urlExt;
        }
      }

      const fileName = `sync_${Date.now()}.${extension}`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      console.log('📥 Downloading media to:', filePath);
      console.log('📥 From URL:', currentMedia.uri.substring(0, 100));

      // Download the file
      const downloadResult = await FileSystem.downloadAsync(currentMedia.uri, filePath);

      console.log('📥 Download result:', downloadResult.status);

      if (downloadResult.status === 200) {
        // Save to media library
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
        console.log('📥 Asset created:', asset.id);

        // Try to add to SYNC album
        try {
          const album = await MediaLibrary.getAlbumAsync('SYNC');
          if (album) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          } else {
            await MediaLibrary.createAlbumAsync('SYNC', asset, false);
          }
        } catch (albumError) {
          console.log('Album error (non-critical):', albumError);
        }

        // Clean up temp file
        try {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        } catch { }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Saved! ✨',
          `${isVideo ? 'Video' : 'Photo'} saved to your photo library.`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }
    } catch (error: any) {
      console.error('Save error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Save Failed',
        `Could not save media: ${error.message || 'Unknown error'}. Please try again.`,
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  }, [currentIndex, mediaItems]);

  const handleShare = useCallback(async () => {
    const currentMedia = mediaItems[currentIndex];
    if (!currentMedia) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Download file first for reliable sharing
      const isVideo = currentMedia.type === 'video';
      const extension = isVideo ? 'mp4' : 'jpg';
      const fileName = `sync_share_${Date.now()}.${extension}`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      console.log('📤 Downloading for share:', currentMedia.uri.substring(0, 100));

      const downloadResult = await FileSystem.downloadAsync(currentMedia.uri, filePath);

      if (downloadResult.status === 200) {
        // Share the local file
        const shareResult = await Share.share(
          Platform.OS === 'ios'
            ? { url: downloadResult.uri }
            : {
              message: 'A special memory from SYNC 💕',
              url: downloadResult.uri,
            }
        );

        console.log('📤 Share result:', shareResult);

        // Clean up temp file after sharing
        setTimeout(async () => {
          try {
            await FileSystem.deleteAsync(filePath, { idempotent: true });
          } catch { }
        }, 5000);
      } else {
        // Fallback: try to share URL directly
        await Share.share({
          message: `Check out this memory from SYNC! 💕\n${currentMedia.uri}`,
        });
      }
    } catch (error: any) {
      console.error('Share error:', error);
      // If share was cancelled, don't show error
      if (error.message !== 'User did not share') {
        Alert.alert('Share Failed', 'Could not share this media. Please try again.');
      }
    }
  }, [currentIndex, mediaItems]);

  const handleCopy = useCallback(async () => {
    const currentMedia = mediaItems[currentIndex];
    if (!currentMedia) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Clipboard.setStringAsync(currentMedia.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copied! 📋', 'Link copied to clipboard.');
    } catch (error) {
      console.error('Copy error:', error);
      Alert.alert('Copy Failed', 'Could not copy the link. Please try again.');
    }
  }, [currentIndex, mediaItems]);

  const renderItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => {
    const isActive = index === currentIndex && visible;

    if (item.type === 'video') {
      return (
        <View style={styles.mediaSlide}>
          <VideoPlayer uri={item.uri} isActive={isActive} />
        </View>
      );
    }

    return (
      <View style={styles.mediaSlide}>
        <ImageViewer
          uri={item.uri}
          isActive={isActive}
          onTap={toggleControls}
        />
      </View>
    );
  }, [currentIndex, visible, toggleControls]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
  }), []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  }), []);

  const currentMedia = mediaItems[currentIndex];
  const isVideo = currentMedia?.type === 'video';

  console.log('📱 MediaPreviewModal about to render Modal:', {
    visible,
    hasMedia: mediaItems.length > 0,
    currentMedia
  });

  // Don't render if no media items
  if (!visible || mediaItems.length === 0) {
    console.log('📱 MediaPreviewModal early return - not visible or no items');
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Beautiful gradient background */}
        <LinearGradient
          colors={['#000000', '#0a0a0a', '#000000']}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View style={[styles.content, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <Animated.View style={[styles.header, { opacity: controlsOpacity }]}>
            <BlurView intensity={60} tint="dark" style={styles.headerBlur}>
              <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                {mediaItems.length > 1 && (
                  <View style={styles.counterPill}>
                    <Text style={styles.counterText}>
                      {currentIndex + 1} of {mediaItems.length}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity onPress={handleCopy} style={styles.headerButton}>
                  <Ionicons name="copy-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
                  <Ionicons name="share-outline" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  style={styles.headerButton}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="download-outline" size={24} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </BlurView>
          </Animated.View>

          {/* Media Content */}
          <FlatList
            ref={flatListRef}
            data={mediaItems}
            renderItem={renderItem}
            keyExtractor={(_, index) => index.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={getItemLayout}
            initialScrollIndex={initialIndex}
            windowSize={3}
            maxToRenderPerBatch={2}
            removeClippedSubviews
          />

          {/* Footer */}
          <Animated.View style={[styles.footer, { opacity: controlsOpacity }]}>
            {/* Media type badge */}
            <View style={styles.mediaTypeBadge}>
              <LinearGradient
                colors={isVideo ? ['#e94560', '#0f3460'] : [theme.colors.primary, theme.colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.badgeGradient}
              >
                <Ionicons
                  name={isVideo ? 'videocam' : 'image'}
                  size={14}
                  color="#fff"
                />
                <Text style={styles.badgeText}>
                  {isVideo ? 'Video' : 'Photo'}
                </Text>
              </LinearGradient>
            </View>

            {/* Pagination dots */}
            {mediaItems.length > 1 && mediaItems.length <= 8 && (
              <View style={styles.pagination}>
                {mediaItems.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index === currentIndex && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}

            {/* Hint text */}
            <Text style={styles.hintText}>
              {isVideo ? 'Tap to play/pause' : 'Double-tap to zoom'}
            </Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  counterPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  mediaSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Image styles
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  imageLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageErrorContainer: {
    width: SCREEN_WIDTH * 0.8,
    height: 200,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageErrorText: {
    color: 'rgba(255,255,255,0.6)',
    marginTop: 16,
    fontSize: 16,
  },
  // Video styles
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  videoTapArea: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingSpinner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 16,
    fontSize: 14,
  },
  playButtonContainer: {
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  playButtonGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoControls: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  controlsBlur: {
    padding: 16,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    width: 40,
    textAlign: 'center',
  },
  progressBarContainer: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginLeft: -6,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoErrorGradient: {
    width: SCREEN_WIDTH * 0.85,
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
  },
  errorIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  videoErrorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  videoErrorSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  openExternalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
  },
  openExternalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Footer styles
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 16,
  },
  mediaTypeBadge: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  pagination: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 24,
  },
  hintText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
});
