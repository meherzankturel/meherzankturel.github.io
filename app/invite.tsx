import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResponsiveUtils } from '../src/utils/responsive';
import { db } from '../src/config/firebase';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { useAuth } from '../src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { PairService } from '../src/services/pair.service';
import { StatusBar } from 'expo-status-bar';

// Doodle Theme Colors
const colors = {
    background: '#fefefe',
    surface: '#ffffff',
    surfaceSoft: '#f8f5ff',
    primary: '#7f13ec',
    text: '#141118',
    textSecondary: '#756189',
    textMuted: '#9a8ba8',
    border: '#e8e0f0',
    doodlePink: '#ff85a2',
    doodlePurple: '#a855f7',
};

export default function InviteScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [inviteCode, setInviteCode] = useState('');
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleCopyCode = async () => {
        if (generatedCode) {
            await Clipboard.setStringAsync(generatedCode);
            Alert.alert('Copied!', 'Invite code copied to clipboard.');
        }
    };

    const handleGenerateCode = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Check if user already has a partner
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();

            if (userData?.pairId || userData?.partnerId) {
                Alert.alert(
                    'Already Paired',
                    'You are already connected with a partner. Please disconnect your current partner before creating a new invite.',
                    [{ text: 'OK' }]
                );
                setLoading(false);
                return;
            }

            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = 'LOVE-';
            for (let i = 0; i < 4; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            await setDoc(doc(db, 'invites', code), {
                creatorId: user.uid,
                createdAt: serverTimestamp(),
                status: 'pending'
            });
            setGeneratedCode(code);
        } catch (err: any) {
            console.error('Generate code error:', err);
            Alert.alert('Error', err.message || 'Could not generate code');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!user || !inviteCode) return;
        setLoading(true);
        try {
            const code = inviteCode.toUpperCase().trim();
            const inviteRef = doc(db, 'invites', code);
            const inviteSnap = await getDoc(inviteRef);

            if (!inviteSnap.exists()) {
                Alert.alert('Invalid Code', 'This invite code does not exist.');
                setLoading(false);
                return;
            }

            const inviteData = inviteSnap.data();
            if (inviteData.status !== 'pending') {
                Alert.alert('Code Expired', 'This code has already been used.');
                setLoading(false);
                return;
            }

            if (inviteData.creatorId === user.uid) {
                Alert.alert('Wait!', 'You cannot use your own invite code.');
                setLoading(false);
                return;
            }

            // Check if current user already has a partner
            const currentUserDoc = await getDoc(doc(db, 'users', user.uid));
            const currentUserData = currentUserDoc.data();

            if (currentUserData?.pairId || currentUserData?.partnerId) {
                // Check if they're already paired with the creator
                if (currentUserData.partnerId === inviteData.creatorId) {
                    Alert.alert(
                        'Already Connected',
                        'You are already paired with this partner!',
                        [{ text: 'OK' }]
                    );
                } else {
                    Alert.alert(
                        'Already Paired',
                        'You are already connected with another partner. Please disconnect your current partner before joining a new one.',
                        [{ text: 'OK' }]
                    );
                }
                setLoading(false);
                return;
            }

            // Get creator's user data
            const creatorDoc = await getDoc(doc(db, 'users', inviteData.creatorId));
            const creatorData = creatorDoc.data();

            // Check if creator already has a partner
            if (creatorData?.pairId || creatorData?.partnerId) {
                // Check if creator is already paired with current user
                if (creatorData.partnerId === user.uid) {
                    Alert.alert(
                        'Already Connected',
                        'You are already paired with this partner!',
                        [{ text: 'OK' }]
                    );
                } else {
                    Alert.alert(
                        'Partner Already Connected',
                        'The person who created this invite code is already connected with another partner.',
                        [{ text: 'OK' }]
                    );
                }
                setLoading(false);
                return;
            }

            // Generate a pairId for this connection
            const pairId = `pair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const batch = writeBatch(db);

            // Create or update the pair document
            const pairRef = doc(db, 'pairs', pairId);
            batch.set(pairRef, {
                pairId: pairId,
                user1Id: inviteData.creatorId,
                user2Id: user.uid,
                user1Email: creatorData?.email || '',
                user2Email: user.email || '',
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // Update both users with partnerId and pairId
            batch.set(doc(db, 'users', user.uid), {
                partnerId: inviteData.creatorId,
                email: user.email,
                pairId: pairId,
                updatedAt: serverTimestamp()
            }, { merge: true });

            batch.set(doc(db, 'users', inviteData.creatorId), {
                partnerId: user.uid,
                pairId: pairId,
                updatedAt: serverTimestamp()
            }, { merge: true });

            batch.update(inviteRef, {
                status: 'accepted',
                acceptedBy: user.uid,
                acceptedAt: serverTimestamp()
            });

            await batch.commit();
            Alert.alert('Success!', 'Accounts linked! Welcome home.', [
                { text: 'OK', onPress: () => router.replace('/(tabs)') }
            ]);
        } catch (err: any) {
            console.error('Join error:', err);
            Alert.alert('Error', err.message || 'Something went wrong while joining.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar style="dark" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Connect Partner</Text>
                <View style={{ width: 44 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <View style={styles.inner}>
                            {/* Heart icon with doodle style */}
                            <View style={styles.iconContainer}>
                                <Ionicons name="heart" size={48} color={colors.doodlePink} />
                            </View>

                            <Text style={styles.title}>Partner Up</Text>
                            <Text style={styles.subtitle}>Send a code to your partner or enter the one you received.</Text>

                            {/* Generate Section */}
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Send an invite</Text>
                                {generatedCode ? (
                                    <View style={styles.codeDisplayContainer}>
                                        <Text style={styles.generatedCode}>{generatedCode}</Text>
                                        <TouchableOpacity onPress={handleCopyCode} style={styles.copyIcon}>
                                            <Ionicons name="copy-outline" size={24} color={colors.primary} />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.generateButton}
                                        onPress={handleGenerateCode}
                                        disabled={loading}
                                    >
                                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate Code</Text>}
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.divider}>
                                <View style={styles.line} />
                                <Text style={styles.or}>OR</Text>
                                <View style={styles.line} />
                            </View>

                            {/* Join Section */}
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Enter a code</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="LOVE-XXXX"
                                    placeholderTextColor={colors.textMuted}
                                    value={inviteCode}
                                    onChangeText={setInviteCode}
                                    autoCapitalize="characters"
                                />
                                <TouchableOpacity
                                    style={[styles.joinButton, !inviteCode && styles.disabledButton]}
                                    onPress={handleJoin}
                                    disabled={loading || !inviteCode}
                                >
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Join Partner</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    scrollContent: {
        flexGrow: 1,
    },
    inner: {
        padding: 30,
        alignItems: 'center',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 32,
        backgroundColor: colors.surfaceSoft,
        borderWidth: 2,
        borderColor: colors.doodlePink,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        transform: [{ rotate: '-3deg' }],
    },
    title: {
        fontSize: ResponsiveUtils.fontScale(28),
        fontWeight: '600',
        color: colors.text,
        marginBottom: ResponsiveUtils.verticalScale(10),
    },
    subtitle: {
        fontSize: ResponsiveUtils.fontScale(16),
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: ResponsiveUtils.verticalScale(40),
        lineHeight: ResponsiveUtils.verticalScale(22),
    },
    section: {
        width: '100%',
        marginBottom: 20,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMuted,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    generateButton: {
        backgroundColor: colors.doodlePink,
        padding: 16,
        borderRadius: 24,
        alignItems: 'center',
    },
    codeDisplayContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceSoft,
        padding: 16,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: colors.primary,
        justifyContent: 'center',
    },
    generatedCode: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.primary,
        letterSpacing: 2,
    },
    copyIcon: {
        marginLeft: 15,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginVertical: 30,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
    },
    or: {
        marginHorizontal: 15,
        color: colors.textMuted,
        fontWeight: '600',
    },
    input: {
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 20,
        fontSize: 18,
        borderWidth: 1.5,
        borderColor: colors.border,
        marginBottom: 16,
        textAlign: 'center',
        fontWeight: '600',
        color: colors.text,
    },
    joinButton: {
        backgroundColor: colors.primary,
        padding: 16,
        borderRadius: 24,
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
});
