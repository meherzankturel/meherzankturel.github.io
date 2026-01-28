import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    ScrollView,
    Dimensions
} from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../../src/config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Doodle Theme Colors
const colors = {
    background: '#fefefe',
    surface: '#ffffff',
    surfaceSoft: '#f8f5ff',
    primary: '#7f13ec',
    primaryDark: '#6910c2',
    text: '#141118',
    textSecondary: '#756189',
    textMuted: '#9a8ba8',
    border: '#e8e0f0',
    doodlePink: '#ff85a2',
    doodlePurple: '#a855f7',
    error: '#FF6B6B',
    success: '#4ADE80',
};

// Decorative Doodle Components (using Views instead of SVG)
const HeartDoodle = ({ style }: { style?: any }) => (
    <View style={[{ width: 24, height: 22 }, style]}>
        <View style={{
            width: 24,
            height: 22,
            backgroundColor: colors.doodlePink,
            borderRadius: 12,
            opacity: 0.7,
            transform: [{ rotate: '-45deg' }],
        }} />
    </View>
);

const SparklesDoodle = ({ style }: { style?: any }) => (
    <View style={[{ width: 16, height: 16 }, style]}>
        <Ionicons name="sparkles" size={16} color={colors.doodlePurple} style={{ opacity: 0.5 }} />
    </View>
);

const DotDoodle = ({ style, color = colors.doodlePurple }: { style?: any; color?: string }) => (
    <View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: 0.3 }, style]} />
);

export default function LoginScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [faceTimeEmail, setFaceTimeEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Helper function to validate phone number
    const validatePhoneNumber = (phone: string): boolean => {
        const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
        return /^\d{10,15}$/.test(cleaned);
    };

    // Helper function to validate email
    const validateEmail = (email: string): boolean => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        if (isSignUp) {
            // Validate all required fields for signup
            if (!name || !phoneNumber || !faceTimeEmail) {
                Alert.alert('Error', 'Please fill in all fields');
                return;
            }

            if (password !== confirmPassword) {
                Alert.alert('Error', 'Passwords do not match');
                return;
            }

            // Validate email format
            if (!validateEmail(email)) {
                Alert.alert('Error', 'Please enter a valid email address');
                return;
            }

            // Validate phone number
            if (!validatePhoneNumber(phoneNumber)) {
                Alert.alert('Error', 'Please enter a valid phone number (10-15 digits)');
                return;
            }

            // Validate FaceTime email
            if (!validateEmail(faceTimeEmail)) {
                Alert.alert('Error', 'Please enter a valid FaceTime email address');
                return;
            }
        }

        setLoading(true);
        try {
            if (isSignUp) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const newUser = userCredential.user;

                // Initialize User Profile in Firestore with all fields
                await setDoc(doc(db, 'users', newUser.uid), {
                    uid: newUser.uid,
                    email: newUser.email || email,
                    name: name.trim(),
                    displayName: name.trim(), // For backward compatibility
                    phoneNumber: phoneNumber.trim(),
                    faceTimeEmail: faceTimeEmail.trim(),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    partnerId: null
                });

                await signOut(auth); // Prevent auto-login
                Alert.alert('Success', 'Account created successfully!', [
                    {
                        text: 'Sign In',
                        onPress: () => {
                            setIsSignUp(false);
                            setPassword('');
                            setConfirmPassword('');
                            setName('');
                            setPhoneNumber('');
                            setFaceTimeEmail('');
                        }
                    }
                ]);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (error: any) {
            let title = 'Oops!';
            let msg = error.message;

            if (error.code === 'auth/email-already-in-use') {
                title = 'Account Exists';
                msg = 'That email is already registered. Try signing in instead.';
            } else if (error.code === 'auth/invalid-email') {
                title = 'Invalid Email';
                msg = 'Please enter a valid email address.';
            } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                title = 'Sign In Failed';
                msg = 'Incorrect email or password.';
            } else if (error.code === 'auth/weak-password') {
                title = 'Weak Password';
                msg = 'Password should be at least 6 characters.';
            }

            Alert.alert(title, msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            {/* Decorative doodles */}
            <HeartDoodle style={styles.heartDoodle} />
            <SparklesDoodle style={styles.sparklesDoodle} />
            <DotDoodle style={styles.dotDoodle1} />
            <DotDoodle style={styles.dotDoodle2} color={colors.doodlePink} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Logo Section */}
                        <View style={styles.logoSection}>
                            {/* SYNC Logo with hand-drawn style */}
                            <View style={styles.logoContainer}>
                                <Text style={styles.logoText}>SYNC</Text>
                                <View style={styles.logoUnderline} />
                            </View>

                            <Text style={styles.welcomeText}>
                                {isSignUp ? 'Create Account' : 'Welcome Back'}
                            </Text>
                            <Text style={styles.tagline}>
                                {isSignUp ? 'Start your journey together' : 'Stay connected, always'}
                            </Text>
                        </View>

                        {/* Form Section */}
                        <View style={styles.formSection}>
                            {isSignUp && (
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.inputLabel}>Full Name</Text>
                                    <View style={styles.inputContainer}>
                                        <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                                        <TextInput
                                            placeholder="Enter your name"
                                            placeholderTextColor={colors.textMuted}
                                            value={name}
                                            onChangeText={setName}
                                            autoCapitalize="words"
                                            textContentType="name"
                                            autoComplete="name"
                                            style={styles.input}
                                        />
                                    </View>
                                </View>
                            )}

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
                                        textContentType="emailAddress"
                                        autoComplete="email"
                                        style={styles.input}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>Password</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                                    <TextInput
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.textMuted}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                        textContentType={isSignUp ? "newPassword" : "password"}
                                        autoComplete={isSignUp ? "password-new" : "password"}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        style={[styles.input, { flex: 1 }]}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {isSignUp && (
                                <>
                                    <View style={styles.inputWrapper}>
                                        <Text style={styles.inputLabel}>Confirm Password</Text>
                                        <View style={styles.inputContainer}>
                                            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                                            <TextInput
                                                placeholder="••••••••"
                                                placeholderTextColor={colors.textMuted}
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                                secureTextEntry={!showPassword}
                                                textContentType="newPassword"
                                                autoComplete="password-new"
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                style={[styles.input, { flex: 1 }]}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputWrapper}>
                                        <Text style={styles.inputLabel}>Phone Number (for SOS)</Text>
                                        <View style={styles.inputContainer}>
                                            <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                                            <TextInput
                                                placeholder="+1 234 567 8900"
                                                placeholderTextColor={colors.textMuted}
                                                value={phoneNumber}
                                                onChangeText={setPhoneNumber}
                                                keyboardType="phone-pad"
                                                textContentType="telephoneNumber"
                                                autoComplete="tel"
                                                style={styles.input}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputWrapper}>
                                        <Text style={styles.inputLabel}>FaceTime Email (for SOS)</Text>
                                        <View style={styles.inputContainer}>
                                            <Ionicons name="videocam-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                                            <TextInput
                                                placeholder="facetime@email.com"
                                                placeholderTextColor={colors.textMuted}
                                                value={faceTimeEmail}
                                                onChangeText={setFaceTimeEmail}
                                                autoCapitalize="none"
                                                keyboardType="email-address"
                                                textContentType="emailAddress"
                                                autoComplete="email"
                                                style={styles.input}
                                            />
                                        </View>
                                    </View>
                                </>
                            )}

                            {!isSignUp && (
                                <TouchableOpacity
                                    onPress={() => router.push('/(auth)/forgot-password')}
                                    style={styles.forgotButton}
                                >
                                    <Text style={styles.forgotText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            )}

                            {/* Primary Button with doodle style */}
                            <TouchableOpacity
                                onPress={handleAuth}
                                style={styles.primaryButton}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                <View style={styles.buttonInner}>
                                    {loading ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <Text style={styles.buttonText}>
                                            {isSignUp ? 'Create Account' : 'Sign In'}
                                        </Text>
                                    )}
                                </View>
                                {/* Decorative diagonal lines on button */}
                                <View style={styles.buttonLines} />
                            </TouchableOpacity>
                        </View>

                        {/* Toggle Sign Up / Sign In */}
                        <View style={styles.toggleSection}>
                            <Text style={styles.toggleText}>
                                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                            </Text>
                            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                                <Text style={styles.toggleLink}>
                                    {isSignUp ? 'Sign In' : 'Create Account'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Footer with theme toggle */}
                        <View style={styles.footer}>
                            <View style={styles.themeToggle}>
                                <Ionicons name="contrast-outline" size={20} color={colors.textMuted} />
                            </View>
                        </View>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    // Decorative doodles positioning
    heartDoodle: {
        position: 'absolute',
        top: 100,
        left: 30,
        zIndex: 1,
    },
    sparklesDoodle: {
        position: 'absolute',
        top: 80,
        right: 40,
        zIndex: 1,
    },
    dotDoodle1: {
        position: 'absolute',
        top: 200,
        right: 60,
        zIndex: 1,
    },
    dotDoodle2: {
        position: 'absolute',
        bottom: 200,
        left: 50,
        zIndex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingTop: 80,
        paddingBottom: 40,
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logoText: {
        fontSize: 42,
        fontWeight: '300',
        color: colors.primary,
        fontStyle: 'italic',
        letterSpacing: 2,
    },
    logoUnderline: {
        width: 60,
        height: 2,
        backgroundColor: colors.doodlePurple,
        marginTop: 4,
        borderRadius: 1,
        transform: [{ rotate: '-2deg' }],
    },
    welcomeText: {
        fontSize: 28,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
    },
    tagline: {
        fontSize: 15,
        color: colors.textSecondary,
        letterSpacing: 0.3,
    },
    formSection: {
        marginBottom: 24,
    },
    inputWrapper: {
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
    eyeButton: {
        padding: 8,
        marginLeft: 8,
    },
    forgotButton: {
        alignSelf: 'flex-end',
        marginBottom: 24,
        marginTop: -8,
    },
    forgotText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '500',
    },
    primaryButton: {
        backgroundColor: colors.primary,
        borderRadius: 28,
        overflow: 'hidden',
        marginTop: 8,
        position: 'relative',
    },
    buttonInner: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonLines: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.1,
        // This creates a subtle diagonal line pattern effect
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    toggleSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        gap: 6,
    },
    toggleText: {
        color: colors.textSecondary,
        fontSize: 15,
    },
    toggleLink: {
        color: colors.primary,
        fontSize: 15,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
    },
    themeToggle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
