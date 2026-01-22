import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
    Switch,
    Alert,
    TextInput,
    Linking,
} from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../src/config/firebase';
import { theme } from '../src/config/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { signOut } from 'firebase/auth';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

export default function SettingsScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [userData, setUserData] = useState<any>(null);
    const [partnerData, setPartnerData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [displayName, setDisplayName] = useState('');

    // Settings
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [locationEnabled, setLocationEnabled] = useState(true);
    const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
    const [timeFormat, setTimeFormat] = useState<12 | 24>(12);

    // Load user data
    useEffect(() => {
        if (!user) return;

        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setUserData(data);
                setDisplayName(data.name || data.displayName || '');
                setNotificationsEnabled(data.notificationsEnabled !== false);
                setLocationEnabled(data.locationEnabled !== false);
                setTempUnit(data.tempUnit || 'C');
                setTimeFormat(data.timeFormat || 12);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [user]);

    // Load partner data
    useEffect(() => {
        if (!userData?.partnerId) return;

        const unsubscribe = onSnapshot(doc(db, 'users', userData.partnerId), (snapshot) => {
            if (snapshot.exists()) {
                setPartnerData(snapshot.data());
            }
        });

        return unsubscribe;
    }, [userData?.partnerId]);

    const handleUpdateSetting = async (key: string, value: any) => {
        if (!user) return;

        try {
            await updateDoc(doc(db, 'users', user.uid), {
                [key]: value,
            });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error: any) {
            console.error('Error updating setting:', error);
            Alert.alert('Error', 'Failed to update setting');
        }
    };

    const handleSaveDisplayName = async () => {
        if (!user || !displayName.trim()) return;

        try {
            await updateDoc(doc(db, 'users', user.uid), {
                name: displayName.trim(),
            });
            setEditingName(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            console.error('Error updating name:', error);
            Alert.alert('Error', 'Failed to update name');
        }
    };

    const handleDisconnectPartner = () => {
        Alert.alert(
            'Disconnect Partner',
            'Are you sure you want to disconnect from your partner? You can reconnect anytime.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (!user) return;
                            await updateDoc(doc(db, 'users', user.uid), {
                                partnerId: null,
                                pairId: null,
                            });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            router.back();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to disconnect partner');
                        }
                    },
                },
            ]
        );
    };

    const handleLogout = async () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    await signOut(auth);
                    router.replace('/login');
                },
            },
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This action cannot be undone. All your data will be permanently deleted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            'Are you absolutely sure?',
                            'Type DELETE to confirm account deletion.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Proceed',
                                    style: 'destructive',
                                    onPress: async () => {
                                        // TODO: Implement account deletion
                                        Alert.alert('Coming Soon', 'Account deletion will be available in a future update.');
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Settings</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* ACCOUNT SETTINGS */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Display Name</Text>
                            {editingName ? (
                                <View style={styles.nameEditContainer}>
                                    <TextInput
                                        style={styles.nameInput}
                                        value={displayName}
                                        onChangeText={setDisplayName}
                                        placeholder="Your name"
                                        placeholderTextColor={theme.colors.textMuted}
                                        autoFocus
                                    />
                                    <TouchableOpacity onPress={handleSaveDisplayName} style={styles.saveButton}>
                                        <Ionicons name="checkmark" size={20} color={theme.colors.success} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setEditingName(false)} style={styles.saveButton}>
                                        <Ionicons name="close" size={20} color={theme.colors.error} />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <Text style={styles.settingDescription}>{displayName || 'Not set'}</Text>
                            )}
                        </View>
                        {!editingName && (
                            <TouchableOpacity onPress={() => setEditingName(true)}>
                                <Ionicons name="pencil" size={20} color={theme.colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Email</Text>
                            <Text style={styles.settingDescription}>{user?.email}</Text>
                        </View>
                    </View>

                    {partnerData && (
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Partner</Text>
                                <Text style={styles.settingDescription}>
                                    {partnerData.name || partnerData.email}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={handleDisconnectPartner}>
                                <Text style={styles.disconnectText}>Disconnect</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* NOTIFICATIONS */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notifications</Text>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Push Notifications</Text>
                            <Text style={styles.settingDescription}>
                                Receive notifications for moods, moments, and alerts
                            </Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={(value) => {
                                setNotificationsEnabled(value);
                                handleUpdateSetting('notificationsEnabled', value);
                            }}
                            trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
                            thumbColor={notificationsEnabled ? theme.colors.primary : theme.colors.textLight}
                        />
                    </View>
                </View>

                {/* LOCATION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Location</Text>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Location Sharing</Text>
                            <Text style={styles.settingDescription}>
                                Share your city and timezone with your partner
                            </Text>
                        </View>
                        <Switch
                            value={locationEnabled}
                            onValueChange={(value) => {
                                setLocationEnabled(value);
                                handleUpdateSetting('locationEnabled', value);
                            }}
                            trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
                            thumbColor={locationEnabled ? theme.colors.primary : theme.colors.textLight}
                        />
                    </View>

                    {userData?.city && (
                        <View style={styles.infoCard}>
                            <Ionicons name="location" size={16} color={theme.colors.primary} />
                            <Text style={styles.infoCardText}>
                                Currently: {userData.city}, {userData.region || userData.country}
                            </Text>
                        </View>
                    )}
                </View>

                {/* APPEARANCE */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appearance</Text>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Temperature Unit</Text>
                        </View>
                        <View style={styles.toggleGroup}>
                            <TouchableOpacity
                                style={[styles.toggleButton, tempUnit === 'C' && styles.toggleButtonActive]}
                                onPress={() => {
                                    setTempUnit('C');
                                    handleUpdateSetting('tempUnit', 'C');
                                }}
                            >
                                <Text style={[styles.toggleText, tempUnit === 'C' && styles.toggleTextActive]}>
                                    °C
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleButton, tempUnit === 'F' && styles.toggleButtonActive]}
                                onPress={() => {
                                    setTempUnit('F');
                                    handleUpdateSetting('tempUnit', 'F');
                                }}
                            >
                                <Text style={[styles.toggleText, tempUnit === 'F' && styles.toggleTextActive]}>
                                    °F
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Time Format</Text>
                        </View>
                        <View style={styles.toggleGroup}>
                            <TouchableOpacity
                                style={[styles.toggleButton, timeFormat === 12 && styles.toggleButtonActive]}
                                onPress={() => {
                                    setTimeFormat(12);
                                    handleUpdateSetting('timeFormat', 12);
                                }}
                            >
                                <Text style={[styles.toggleText, timeFormat === 12 && styles.toggleTextActive]}>
                                    12h
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleButton, timeFormat === 24 && styles.toggleButtonActive]}
                                onPress={() => {
                                    setTimeFormat(24);
                                    handleUpdateSetting('timeFormat', 24);
                                }}
                            >
                                <Text style={[styles.toggleText, timeFormat === 24 && styles.toggleTextActive]}>
                                    24h
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* PRIVACY & DATA */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Privacy & Data</Text>

                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => {
                            Alert.alert('Coming Soon', 'Data export feature will be available soon.');
                        }}
                    >
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Export My Data</Text>
                            <Text style={styles.settingDescription}>Download all your data</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingRow} onPress={handleDeleteAccount}>
                        <View style={styles.settingInfo}>
                            <Text style={[styles.settingLabel, styles.dangerText]}>Delete Account</Text>
                            <Text style={styles.settingDescription}>Permanently delete your account</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.error} />
                    </TouchableOpacity>
                </View>

                {/* ABOUT & HELP */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About & Help</Text>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>App Version</Text>
                            <Text style={styles.settingDescription}>
                                {Application.nativeApplicationVersion || '1.0.0'} ({Application.nativeBuildVersion || '1'})
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => {
                            Linking.openURL('mailto:support@couplesapp.com');
                        }}
                    >
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Contact Support</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => {
                            Alert.alert('Terms of Service', 'View our terms of service online');
                        }}
                    >
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Terms of Service</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => {
                            Alert.alert('Privacy Policy', 'View our privacy policy online');
                        }}
                    >
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Privacy Policy</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* LOGOUT BUTTON */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <Text style={styles.footerText}>
                    Made with ❤️ for couples everywhere
                </Text>
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
        fontWeight: '700',
        color: theme.colors.text,
    },
    placeholder: {
        width: 40,
    },
    scrollContent: {
        padding: theme.spacing.md,
        paddingBottom: theme.spacing['2xl'],
    },
    section: {
        marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: '700',
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
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
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
        lineHeight: 18,
    },
    nameEditContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        marginTop: 4,
    },
    nameInput: {
        flex: 1,
        backgroundColor: theme.colors.backgroundAlt,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.sm,
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.text,
    },
    saveButton: {
        padding: theme.spacing.xs,
    },
    disconnectText: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: '600',
        color: theme.colors.error,
    },
    dangerText: {
        color: theme.colors.error,
    },
    toggleGroup: {
        flexDirection: 'row',
        gap: theme.spacing.xs,
    },
    toggleButton: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.backgroundAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    toggleButtonActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    toggleText: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: '600',
        color: theme.colors.textSecondary,
    },
    toggleTextActive: {
        color: '#FFFFFF',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        backgroundColor: theme.colors.surfaceElevated,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.sm,
    },
    infoCardText: {
        flex: 1,
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginTop: theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.colors.error,
    },
    logoutText: {
        fontSize: theme.typography.fontSize.base,
        fontWeight: '600',
        color: theme.colors.error,
    },
    footerText: {
        textAlign: 'center',
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textMuted,
        marginTop: theme.spacing.xl,
    },
});
