import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../src/config/firebase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleReset = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            Alert.alert(
                'Link Sent',
                'We have sent a secure password reset link to your email. Please check your inbox (and spam folder).',
                [{ text: 'Back to Login', onPress: () => router.back() }]
            );
        } catch (error: any) {
            let msg = 'Failed to send reset email. Please check the email address.';
            if (error.code === 'auth/user-not-found') {
                msg = 'No account found with this email.';
            }
            Alert.alert('Error', msg);
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
            </View>

            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.content}>
                    {/* Icon with doodle style */}
                    <View style={styles.iconContainer}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="lock-open-outline" size={40} color={colors.primary} />
                        </View>
                    </View>

                    <Text style={styles.title}>Forgot Password?</Text>
                    <Text style={styles.subtitle}>
                        Don't worry! It happens. Enter your email below and we'll send you a secure link to reset it.
                    </Text>

                    {/* Email Input with doodle style */}
                    <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>Email address</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                placeholder="your@email.com"
                                placeholderTextColor={colors.textMuted}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={styles.input}
                            />
                        </View>
                    </View>

                    {/* Primary Button */}
                    <TouchableOpacity onPress={handleReset} style={styles.button} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Send Reset Link</Text>
                        )}
                    </TouchableOpacity>

                    {/* Troubleshooting Tips */}
                    <View style={styles.troubleSection}>
                        <Text style={styles.troubleTitle}>Didn't receive it?</Text>
                        <Text style={styles.troubleText}>• Check your "Promotions" or Spam folder</Text>
                        <Text style={styles.troubleText}>• Ensure you typed the email correctly</Text>
                        <Text style={styles.troubleText}>• Wait a few minutes and try again</Text>
                    </View>

                    <TouchableOpacity onPress={() => router.back()} style={styles.linkButton}>
                        <View style={styles.linkRow}>
                            <Ionicons name="arrow-back-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.linkText}> Back to Login</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 40 : 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        padding: 30,
        paddingTop: 20,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 25,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: colors.surfaceSoft,
        borderWidth: 2,
        borderColor: colors.doodlePurple,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '3deg' }],
    },
    title: {
        fontSize: 28,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 35,
        lineHeight: 22,
    },
    inputWrapper: {
        width: '100%',
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: 8,
        fontWeight: '500',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderBottomWidth: 1.5,
        borderBottomColor: colors.border,
        paddingHorizontal: 4,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 16,
        color: colors.text,
    },
    button: {
        backgroundColor: colors.primary,
        padding: 18,
        borderRadius: 28,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    troubleSection: {
        marginTop: 40,
        width: '100%',
        backgroundColor: colors.surfaceSoft,
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    troubleTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 10,
    },
    troubleText: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: 5,
    },
    linkButton: {
        marginTop: 'auto',
        marginBottom: 20,
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    linkText: {
        color: colors.textSecondary,
        fontSize: 15,
        fontWeight: '600',
    },
});
