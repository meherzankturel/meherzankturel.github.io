import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/contexts/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { GentleDaysService, GentleDaysSettings } from '../src/services/gentleDays.service';
import { theme } from '../src/config/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

export default function GentleDaysSettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [settings, setSettings] = useState<GentleDaysSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // Load settings
  useEffect(() => {
    if (!user || !userData?.pairId) return;

    const loadSettings = async () => {
      try {
        const settingsData = await GentleDaysService.getSettings(user.uid, userData.pairId);
        setSettings(settingsData);
      } catch (error: any) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, [user, userData?.pairId]);

  const handleToggle = async (key: keyof GentleDaysSettings, value: boolean) => {
    if (!user || !userData?.pairId || !settings || saving) return;

    setSaving(true);
    try {
      await GentleDaysService.updateSettings(user.uid, userData.pairId, { [key]: value });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Update local state
      setSettings({ ...settings, [key]: value });
    } catch (error: any) {
      console.error('Error updating settings:', error);
      Alert.alert('Error', error.message || 'Failed to update settings');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
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
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sharing</Text>
          <Text style={styles.sectionDescription}>
            Choose what you'd like to share with your partner
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Share how I'm feeling</Text>
              <Text style={styles.settingDescription}>
                Your partner will see a gentle message when you check in
              </Text>
            </View>
            <Switch
              value={settings.shareStatus}
              onValueChange={(value) => handleToggle('shareStatus', value)}
              disabled={saving}
              trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
              thumbColor={settings.shareStatus ? theme.colors.primary : theme.colors.textLight}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Share period calendar</Text>
              <Text style={styles.settingDescription}>
                Partner gets one notification when you start sharing
              </Text>
            </View>
            <Switch
              value={settings.shareCalendar}
              onValueChange={(value) => handleToggle('shareCalendar', value)}
              disabled={saving}
              trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
              thumbColor={settings.shareCalendar ? theme.colors.primary : theme.colors.textLight}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Text style={styles.sectionDescription}>
            Control your notification preferences
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive notifications about care actions and updates
              </Text>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(value) => handleToggle('notificationsEnabled', value)}
              disabled={saving}
              trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
              thumbColor={settings.notificationsEnabled ? theme.colors.primary : theme.colors.textLight}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Gentle reminders</Text>
              <Text style={styles.settingDescription}>
                Optional daily reminder to check in (only if you want)
              </Text>
            </View>
            <Switch
              value={settings.gentleRemindersEnabled}
              onValueChange={(value) => handleToggle('gentleRemindersEnabled', value)}
              disabled={saving}
              trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
              thumbColor={settings.gentleRemindersEnabled ? theme.colors.primary : theme.colors.textLight}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Text style={styles.sectionDescription}>
            Customize your experience
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Gentle Days Mode</Text>
              <Text style={styles.settingDescription}>
                Subtle color overlays and reduced animations when you need extra care
              </Text>
            </View>
            <Switch
              value={settings.gentleDaysModeEnabled}
              onValueChange={(value) => handleToggle('gentleDaysModeEnabled', value)}
              disabled={saving}
              trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
              thumbColor={settings.gentleDaysModeEnabled ? theme.colors.primary : theme.colors.textLight}
            />
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.textSecondary} />
          <Text style={styles.infoText}>
            You can change these settings anytime. All sharing is optional and can be disabled at any time.
          </Text>
        </View>
      </ScrollView>
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
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  sectionDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  settingLabel: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  settingDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
});

