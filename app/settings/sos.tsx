import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Switch,
    Alert,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/config/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import WidgetService from '../../src/services/widget.service';
import * as Haptics from 'expo-haptics';

export default function SOSSettingsScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [partnerData, setPartnerData] = useState<any>(null);
    const [userData, setUserData] = useState<any>(null);

    // SOS Settings
    const [oneTapEnabled, setOneTapEnabled] = useState(false);
    const [callPreference, setCallPreference] = useState<'facetime' | 'phone' | 'ask'>('facetime');
    const [testingCall, setTestingCall] = useState(false);

    // Load user and partner data
    useEffect(() => {
        if (!user) return;

        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setUserData(data);

                // Load saved SOS preferences
                setOneTapEnabled(data.sosOneTapEnabled || false);
                setCallPreference(data.sosCallPreference || 'facetime');

                // Load partner data
                if (data.partnerId) {
                    onSnapshot(doc(db, 'users', data.partnerId), (partnerSnap) => {
                        if (partnerSnap.exists()) {
                            setPartnerData(partnerSnap.data());
                        }
                        setLoading(false);
                    });
                } else {
                    setLoading(false);
                }
            }
        });

        return unsubscribe;
    }, [user]);

    const handleToggleOneTap = async (value: boolean) => {
        if (!partnerData) {
            Alert.alert('No Partner', 'You need to connect with a partner first.');
            return;
        }

        if (value) {
            // Show SCARY warning for enabling one-tap
            Alert.alert(
                '⚠️ ENABLE ONE-TAP SOS?',
                `Tapping the SOS widget will IMMEDIATELY call ${partnerData.name || 'your partner'} without any confirmation.\n\n` +
                'This action starts a FaceTime or phone call instantly and cannot be undone.\n\n' +
                'Only enable this if you:\n' +
                '• Understand the risks of accidental calls\n' +
                '• Trust yourself not to tap accidentally\n' +
                '• Need true emergency access',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => setOneTapEnabled(false),
                    },
                    {
                        text: 'I Understand - Enable',
                        style: 'destructive',
                        onPress: async () => {
                            setOneTapEnabled(true);
                            await saveSOSSettings(true, callPreference);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        },
                    },
                ]
            );
        } else {
            // Disabling is safe
            setOneTapEnabled(false);
            await saveSOSSettings(false, callPreference);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const saveSOSSettings = async (oneTap: boolean, preference: string) => {
        if (!user || !partnerData) return;

        try {
            // Save to Firestore
            await updateDoc(doc(db, 'users', user.uid), {
                sosOneTapEnabled: oneTap,
                sosCallPreference: preference,
            });

            // Update widgets
            WidgetService.configureSOS({
                oneTapEnabled: oneTap,
                partnerName: partnerData.name || partnerData.email,
                faceTimeEmail: partnerData.faceTimeEmail || partnerData.email,
                phoneNumber: partnerData.phoneNumber || '',
            });

            console.log('SOS settings saved');
        } catch (error) {
            console.error('Failed to save SOS settings:', error);
            Alert.alert('Error', 'Failed to save settings');
        }
    };

    const handleTestSOS = async () => {
        if (!partnerData) return;

        setTestingCall(true);

        Alert.alert(
            'Test SOS Action',
            'This will send your partner a notification without making an actual call.',
            [
                { text: 'Cancel', style: 'cancel', onPress: () => setTestingCall(false) },
                {
                    text: 'Send Test',
                    onPress: async () => {
                        // Send test notification to partner
                        // TODO: Implement push notification
                        setTimeout(() => {
                            setTestingCall(false);
                            Alert.alert('Test Sent', 'Your partner received a test SOS notification.');
                        }, 1000);
                    },
                },
            ]
        );
    };

    const handleMakeCall = (type: 'facetime' | 'phone') => {
        if (!partnerData) return;

        const contact = type === 'facetime'
            ? (partnerData.faceTimeEmail || partnerData.email)
            : partnerData.phoneNumber;

        if (!contact) {
            Alert.alert('No Contact Info', `${type === 'facetime' ? 'FaceTime email' : 'Phone number'} not available.`);
            return;
        }

        const url = type === 'facetime'
            ? `facetime://${contact}`
            : `tel://${contact}`;

        Linking.canOpenURL(url).then((supported) => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Alert.alert('Not Available', `${type === 'facetime' ? 'FaceTime' : 'Phone'} is not available on this device.`);
            }
        });
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
                <Text style={styles.title}>SOS Emergency</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Partner Info */}
                {partnerData ? (
                    <View style={styles.partnerCard}>
                        <View style={styles.partnerInfo}>
                            <View style={styles.partnerAvatar}>
                                <Text style={styles.partnerInitial}>
                                    {(partnerData.name || partnerData.email || '?')[0].toUpperCase()}
                                </Text>
                            </View>
                            <View>
                                <Text style={styles.partnerName}>{partnerData.name || 'Partner'}</Text>
                                <Text style={styles.partnerEmail}>{partnerData.email}</Text>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={styles.noPartnerCard}>
                        <Ionicons name="person-add" size={48} color={theme.colors.textMuted} />
                        <Text style={styles.noPartnerText}>Connect with a partner first</Text>
                    </View>
                )}

                {/* One-Tap SOS */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick SOS</Text>

                    <View style={[styles.settingRow, oneTapEnabled && styles.settingRowWarning]}>
                        <View style={styles.settingInfo}>
                            <View style={styles.settingLabelRow}>
                                <Text style={styles.settingLabel}>One-Tap Emergency Call</Text>
                                {oneTapEnabled && (
                                    <View style={styles.warningBadge}>
                                        <Text style={styles.warningBadgeText}>ACTIVE</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.settingDescription}>
                                {oneTapEnabled
                                    ? '⚠️ Tapping SOS widget will call immediately without confirmation'
                                    : 'Tap SOS widget to see confirmation dialog before calling'}
                            </Text>
                        </View>
                        <Switch
                            value={oneTapEnabled}
                            onValueChange={handleToggleOneTap}
                            disabled={!partnerData}
                            trackColor={{ false: theme.colors.border, true: theme.colors.error }}
                            thumbColor={oneTapEnabled ? '#FFFFFF' : theme.colors.textLight}
                        />
                    </View>

                    {oneTapEnabled && (
                        <View style={styles.warningBox}>
                            <Ionicons name="warning" size={20} color={theme.colors.error} />
                            <Text style={styles.warningText}>
                                One-tap is enabled. Be careful when handling SOS widgets.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Call Preference */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Call Method</Text>

                    <TouchableOpacity
                        style={[styles.radioRow, callPreference === 'facetime' && styles.radioRowActive]}
                        onPress={() => {
                            setCallPreference('facetime');
                            saveSOSSettings(oneTapEnabled, 'facetime');
                        }}
                    >
                        <View style={styles.radio}>
                            {callPreference === 'facetime' && <View style={styles.radioInner} />}
                        </View>
                        <View style={styles.radioContent}>
                            <Text style={styles.radioLabel}>FaceTime Preferred</Text>
                            <Text style={styles.radioDescription}>Try FaceTime first, fall back to phone</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.radioRow, callPreference === 'phone' && styles.radioRowActive]}
                        onPress={() => {
                            setCallPreference('phone');
                            saveSOSSettings(oneTapEnabled, 'phone');
                        }}
                    >
                        <View style={styles.radio}>
                            {callPreference === 'phone' && <View style={styles.radioInner} />}
                        </View>
                        <View style={styles.radioContent}>
                            <Text style={styles.radioLabel}>Phone Call</Text>
                            <Text style={styles.radioDescription}>Always use phone call</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.radioRow, callPreference === 'ask' && styles.radioRowActive]}
                        onPress={() => {
                            setCallPreference('ask');
                            saveSOSSettings(oneTapEnabled, 'ask');
                        }}
                    >
                        <View style={styles.radio}>
                            {callPreference === 'ask' && <View style={styles.radioInner} />}
                        </View>
                        <View style={styles.radioContent}>
                            <Text style={styles.radioLabel}>Ask Each Time</Text>
                            <Text style={styles.radioDescription}>Choose FaceTime or phone when calling</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Test SOS */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Test & Actions</Text>

                    <TouchableOpacity
                        style={styles.testButton}
                        onPress={handleTestSOS}
                        disabled={!partnerData || testingCall}
                    >
                        {testingCall ? (
                            <ActivityIndicator color={theme.colors.primary} />
                        ) : (
                            <>
                                <Ionicons name="notifications-outline" size={20} color={theme.colors.primary} />
                                <Text style={styles.testButtonText}>Send Test Notification</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.callButton}
                        onPress={() => handleMakeCall('facetime')}
                        disabled={!partnerData}
                    >
                        <Ionicons name="videocam" size={20} color="#FFFFFF" />
                        <Text style={styles.callButtonText}>Test FaceTime Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.callButton, styles.phoneButton]}
                        onPress={() => handleMakeCall('phone')}
                        disabled={!partnerData}
                    >
                        <Ionicons name="call" size={20} color="#FFFFFF" />
                        <Text style={styles.callButtonText}>Test Phone Call</Text>
                    </TouchableOpacity>
                </View>

                {/* Info */}
                <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={20} color={theme.colors.info} />
                    <Text style={styles.infoText}>
                        SOS widgets require iOS 17+ and must be added to your home screen from the widget gallery.
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
    partnerCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.lg,
        ...theme.shadows.sm,
    },
    partnerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    partnerAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    partnerInitial: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.colors.background,
    },
    partnerName: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: '600',
        color: theme.colors.text,
    },
    partnerEmail: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
    },
    noPartnerCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.xl,
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
    },
    noPartnerText: {
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.textMuted,
        marginTop: theme.spacing.sm,
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
        ...theme.shadows.sm,
    },
    settingRowWarning: {
        borderWidth: 2,
        borderColor: theme.colors.error,
    },
    settingInfo: {
        flex: 1,
        marginRight: theme.spacing.md,
    },
    settingLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginBottom: 4,
    },
    settingLabel: {
        fontSize: theme.typography.fontSize.base,
        fontWeight: '600',
        color: theme.colors.text,
    },
    settingDescription: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
        lineHeight: 18,
    },
    warningBadge: {
        backgroundColor: theme.colors.error,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    warningBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.surfaceElevated,
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.error,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        marginTop: theme.spacing.md,
    },
    warningText: {
        flex: 1,
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.error,
    },
    radioRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    radioRowActive: {
        borderColor: theme.colors.primary,
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: theme.colors.border,
        marginRight: theme.spacing.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: theme.colors.primary,
    },
    radioContent: {
        flex: 1,
    },
    radioLabel: {
        fontSize: theme.typography.fontSize.base,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 2,
    },
    radioDescription: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.primary,
    },
    testButtonText: {
        fontSize: theme.typography.fontSize.base,
        fontWeight: '600',
        color: theme.colors.primary,
    },
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.sm,
    },
    phoneButton: {
        backgroundColor: theme.colors.success,
    },
    callButtonText: {
        fontSize: theme.typography.fontSize.base,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.surfaceElevated,
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.info,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
    },
    infoText: {
        flex: 1,
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
        lineHeight: 18,
    },
});
