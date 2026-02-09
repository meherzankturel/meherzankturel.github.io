import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import {
  GentleDaysService,
  FeelingChip,
  GentleDaysStatus,
  GentleDaysSettings,
  FEELING_CHIPS,
} from '../../src/services/gentleDays.service';
import FeelingChipSelector from '../../src/components/FeelingChipSelector';
import { theme } from '../../src/config/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

export default function GentleDaysScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [settings, setSettings] = useState<GentleDaysSettings | null>(null);
  const [todayStatus, setTodayStatus] = useState<GentleDaysStatus | null>(null);
  const [selectedChips, setSelectedChips] = useState<FeelingChip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);

  // Load user data
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserData(data);
      }
      setLoading(false);
    }, (error: any) => {
      console.warn('[GentleDays] User profile listener failed:', error.code || error.message);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Helper to get pairId
  const getPairId = useCallback((): string | null => {
    if (!userData) return null;
    return userData.pairId || null;
  }, [userData]);

  // Load settings and status
  useEffect(() => {
    if (!user || !userData?.pairId) return;

    const loadData = async () => {
      try {
        const pairId = getPairId();
        if (!pairId) return;

        const [settingsData, statusData] = await Promise.all([
          GentleDaysService.getSettings(user.uid, pairId),
          GentleDaysService.getTodayStatus(user.uid, pairId),
        ]);

        setSettings(settingsData);
        setTodayStatus(statusData);
        if (statusData) {
          setSelectedChips(statusData.selectedChips || []);
        }
      } catch (error: any) {
        console.error('Error loading Gentle Days data:', error);
      }
    };

    loadData();
  }, [user, userData?.pairId, getPairId]);

  const handleChipToggle = (chip: FeelingChip) => {
    setSelectedChips((prev) => {
      if (prev.includes(chip)) {
        return prev.filter((c) => c !== chip);
      } else {
        return [...prev, chip];
      }
    });
  };

  const handleSave = async () => {
    if (!user || !userData?.pairId) return;

    const pairId = getPairId();
    if (!pairId) return;

    setSaving(true);
    try {
      await GentleDaysService.saveStatus(user.uid, pairId, selectedChips, false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCheckIn(false);
      
      // Reload status
      const statusData = await GentleDaysService.getTodayStatus(user.uid, pairId);
      setTodayStatus(statusData);
    } catch (error: any) {
      console.error('Error saving status:', error);
      Alert.alert('Error', error.message || 'Failed to save status');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleSOS = async () => {
    if (!user || !userData?.pairId) return;

    Alert.alert(
      'Reach out to your partner?',
      "They'll receive a gentle notification that you need them.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, reach out',
          style: 'default',
          onPress: async () => {
            try {
              const pairId = getPairId();
              if (!pairId) return;

              await GentleDaysService.triggerSOS(user.uid, pairId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Sent', 'Reached out to your partner');
            } catch (error: any) {
              console.error('Error triggering SOS:', error);
              Alert.alert('Error', error.message || 'Failed to send SOS');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          },
        },
      ]
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (!user || !userData?.pairId) {
      setRefreshing(false);
      return;
    }

    try {
      const pairId = getPairId();
      if (!pairId) return;

      const [settingsData, statusData] = await Promise.all([
        GentleDaysService.getSettings(user.uid, pairId),
        GentleDaysService.getTodayStatus(user.uid, pairId),
      ]);

      setSettings(settingsData);
      setTodayStatus(statusData);
      if (statusData) {
        setSelectedChips(statusData.selectedChips || []);
      }
    } catch (error: any) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user, userData?.pairId, getPairId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!userData?.pairId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.centerContent}>
          <Ionicons name="heart-outline" size={64} color={theme.colors.textLight} />
          <Text style={styles.emptyText}>Connect with your partner to use Gentle Days</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Gentle Days</Text>
          <TouchableOpacity
            onPress={() => router.push('/gentle-days-settings')}
            style={styles.settingsButton}
          >
            <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {showCheckIn ? (
          <View style={styles.checkInContainer}>
            <Text style={styles.question}>How are you feeling today?</Text>
            
            <FeelingChipSelector
              selectedChips={selectedChips}
              onChipToggle={handleChipToggle}
              disabled={saving}
            />

            {selectedChips.length > 0 && (
              <Text style={styles.selectedText}>
                Selected: {selectedChips.map((c) => {
                  const chip = FEELING_CHIPS.find((ch) => ch.id === c);
                  return chip?.label || c;
                }).join(', ')}
              </Text>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.saveButton, selectedChips.length === 0 && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={selectedChips.length === 0 || saving}
              >
                {saving ? (
                  <ActivityIndicator color={theme.colors.surface} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => setShowCheckIn(false)}
                disabled={saving}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Today's Status Card */}
            {todayStatus && todayStatus.selectedChips.length > 0 ? (
              <TouchableOpacity
                style={styles.statusCard}
                onPress={() => {
                  setShowCheckIn(true);
                  setSelectedChips(todayStatus.selectedChips || []);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.statusLabel}>Today</Text>
                <View style={styles.chipDisplay}>
                  {todayStatus.selectedChips.map((chipId) => {
                    const chip = FEELING_CHIPS.find((c) => c.id === chipId);
                    if (!chip) return null;
                    return (
                      <View key={chipId} style={styles.chipBadge}>
                        <Text style={styles.chipEmoji}>{chip.emoji}</Text>
                        <Text style={styles.chipText}>{chip.label}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.tapToUpdateHint}>Tap to update</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="heart-outline" size={48} color={theme.colors.textLight} />
                <Text style={styles.emptyCardText}>How are you feeling today?</Text>
              </View>
            )}

            {/* Primary Action Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowCheckIn(true)}
            >
              <Ionicons name="heart" size={22} color={theme.colors.surface} />
              <Text style={styles.primaryButtonText}>
                {todayStatus && todayStatus.selectedChips.length > 0 ? 'Update' : 'Check In'}
              </Text>
            </TouchableOpacity>

            {/* Secondary Actions */}
            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleSOS}
              >
                <Ionicons name="call-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.secondaryButtonText}>I need you</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push('/gentle-days-partner')}
              >
                <Ionicons name="people-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.secondaryButtonText}>Partner</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
  },
  settingsButton: {
    padding: theme.spacing.xs,
  },
  question: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  checkInContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  selectedText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  buttonContainer: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  skipButton: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  skipButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.base,
  },
  content: {
    gap: theme.spacing.lg,
  },
  statusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
  },
  statusLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: theme.typography.fontWeight.medium,
  },
  chipDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    gap: theme.spacing.xs,
  },
  chipEmoji: {
    fontSize: theme.typography.fontSize.base,
  },
  chipText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.medium,
  },
  tapToUpdateHint: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
  },
  emptyCardText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  primaryButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
});

