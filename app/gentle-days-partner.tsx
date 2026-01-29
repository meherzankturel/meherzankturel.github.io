import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/contexts/AuthContext';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import {
  GentleDaysService,
  GentleDaysPartnerMessage,
  CareActionType,
} from '../src/services/gentleDays.service';
import { theme } from '../src/config/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

function formatTimeAgo(timestamp: any): string {
  if (!timestamp) return 'just now';

  const now = new Date();
  const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return time.toLocaleDateString();
}

export default function GentleDaysPartnerScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [partnerMessage, setPartnerMessage] = useState<GentleDaysPartnerMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCareActions, setShowCareActions] = useState(false);

  // Load user data
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserData(data);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Load and subscribe to partner message
  useEffect(() => {
    if (!user || !userData?.pairId) return;

    // Load initial message
    const loadInitialMessage = async () => {
      try {
        const message = await GentleDaysService.getPartnerMessage(user.uid, userData.pairId);
        setPartnerMessage(message);
      } catch (error) {
        console.error('Error loading partner message:', error);
      }
    };

    loadInitialMessage();

    // Subscribe to updates
    const unsubscribe = GentleDaysService.subscribeToPartnerMessage(
      user.uid,
      userData.pairId,
      (message) => {
        setPartnerMessage(message);
      }
    );

    return unsubscribe;
  }, [user, userData?.pairId]);

  const getPartnerId = (): string | null => {
    if (!userData?.partnerId) return null;
    return userData.partnerId;
  };

  const handleSendCareAction = async (type: CareActionType) => {
    if (!user || !userData?.pairId) return;

    const partnerId = getPartnerId();
    if (!partnerId) {
      Alert.alert('Error', 'Partner not found');
      return;
    }

    setShowCareActions(false);

    try {
      let content = '';
      let metadata: any = {};

      if (type === 'message') {
        // For now, just send a default message
        // In a full implementation, you'd show an input modal
        content = 'Thinking of you today 💜';
      } else if (type === 'virtual_hug') {
        content = '';
      } else if (type === 'facetime') {
        // Schedule FaceTime - in full implementation, show date picker
        Alert.alert('Coming soon', 'FaceTime scheduling will be available soon');
        return;
      } else if (type === 'voice_note') {
        // Voice note - in full implementation, show recording UI
        Alert.alert('Coming soon', 'Voice notes will be available soon');
        return;
      }

      await GentleDaysService.sendCareAction(user.uid, partnerId, userData.pairId, type, content, metadata);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Sent', 'Your care action was sent');
    } catch (error: any) {
      console.error('Error sending care action:', error);
      Alert.alert('Error', error.message || 'Failed to send care action');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Your Partner</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {partnerMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageText}>{partnerMessage.message}</Text>
            {partnerMessage.timestamp && (
              <Text style={styles.timestamp}>
                Updated {formatTimeAgo(partnerMessage.timestamp)}
              </Text>
            )}

            <TouchableOpacity
              style={styles.showCareButton}
              onPress={() => setShowCareActions(true)}
            >
              <Ionicons name="heart" size={20} color={theme.colors.surface} />
              <Text style={styles.showCareButtonText}>Show Care</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="heart-outline" size={64} color={theme.colors.textLight} />
            <Text style={styles.emptyText}>Your partner hasn't shared yet</Text>
            <Text style={styles.emptySubtext}>
              When they check in, you'll see a gentle message here
            </Text>
          </View>
        )}
      </ScrollView>

      {showCareActions && (
        <View style={styles.careActionsModal}>
          <View style={styles.careActionsContent}>
            <View style={styles.careActionsHeader}>
              <Text style={styles.careActionsTitle}>Show Care</Text>
              <TouchableOpacity
                onPress={() => setShowCareActions(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.careActionsList}>
              <TouchableOpacity
                style={styles.careActionItem}
                onPress={() => handleSendCareAction('message')}
              >
                <Ionicons name="chatbubble-outline" size={24} color={theme.colors.primary} />
                <Text style={styles.careActionLabel}>Send a Message</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.careActionItem}
                onPress={() => handleSendCareAction('virtual_hug')}
              >
                <Ionicons name="heart" size={24} color={theme.colors.primary} />
                <Text style={styles.careActionLabel}>Send Virtual Hug</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.careActionItem}
                onPress={() => handleSendCareAction('facetime')}
              >
                <Ionicons name="videocam-outline" size={24} color={theme.colors.primary} />
                <Text style={styles.careActionLabel}>Schedule FaceTime</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.careActionItem}
                onPress={() => handleSendCareAction('voice_note')}
              >
                <Ionicons name="mic-outline" size={24} color={theme.colors.primary} />
                <Text style={styles.careActionLabel}>Send a Voice Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  messageCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  messageText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    lineHeight: 24,
  },
  timestamp: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  showCareButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  showCareButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['2xl'],
    alignItems: 'center',
    ...theme.shadows.md,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  careActionsModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  careActionsContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    maxHeight: '60%',
  },
  careActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  careActionsTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  careActionsList: {
    gap: theme.spacing.sm,
  },
  careActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceElevated,
    gap: theme.spacing.md,
  },
  careActionLabel: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
  },
});

