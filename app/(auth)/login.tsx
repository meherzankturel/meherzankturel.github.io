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
import { LinearGradient } from 'expo-linear-gradient';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../../src/config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { SyncLogo } from '../../src/components/SyncLogo';
import { StatusBar } from 'expo-status-bar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// SYNC Brand Colors
const colors = {
    background: '#0A0A0F',
    surface: '#12141C',
    surfaceLight: '#1A1D28',
    primary: '#00D4FF',
    primaryDark: '#00A8CC',
    text: '#FFFFFF',
    textSecondary: '#7A8599',
    textMuted: '#4A5568',
    border: '#2A2D3A',
    error: '#FF6B6B',
    success: '#4ADE80',
};

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
            <StatusBar style="light" />
            <LinearGradient
                colors={['#0A0A0F', '#0D0D14', '#0A0A0F']}
                style={StyleSheet.absoluteFill}
            />
            
            {/* Ambient glow */}
            <View style={styles.ambientGlow} />
            
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
                            <SyncLogo size="medium" showText={true} />
                            <Text style={styles.tagline}>
                                {isSignUp ? 'Start your journey together' : 'Stay connected, always'}
                            </Text>
                        </View>

                        {/* Form Card */}
                        <View style={styles.formCard}>
                            <Text style={styles.formTitle}>
                                {isSignUp ? 'Create Account' : 'Welcome Back'}
                            </Text>
                            
                            {isSignUp && (
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                    <TextInput
                                        placeholder="Full Name"
                                        placeholderTextColor={colors.textMuted}
                                        value={name}
                                        onChangeText={setName}
                                        autoCapitalize="words"
                                        textContentType="name"
                                        autoComplete="name"
                                        style={styles.input}
                                    />
                                </View>
                            )}

                            <View style={styles.inputWrapper}>
                                <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    placeholder="Email"
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

                            <View style={styles.inputWrapper}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    placeholder="Password"
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
                                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {isSignUp && (
                                <>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                        <TextInput
                                            placeholder="Confirm Password"
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

                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="call-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                        <TextInput
                                            placeholder="Phone Number (for SOS)"
                                            placeholderTextColor={colors.textMuted}
                                            value={phoneNumber}
                                            onChangeText={setPhoneNumber}
                                            keyboardType="phone-pad"
                                            textContentType="telephoneNumber"
                                            autoComplete="tel"
                                            style={styles.input}
                                        />
                                    </View>

                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="videocam-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                        <TextInput
                                            placeholder="FaceTime Email (for SOS)"
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

                            {/* Primary Button */}
                            <TouchableOpacity 
                                onPress={handleAuth} 
                                style={styles.primaryButton} 
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#00D4FF', '#00A8CC']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.buttonGradient}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#0A0A0F" />
                                    ) : (
                                        <Text style={styles.buttonText}>
                                            {isSignUp ? 'Create Account' : 'Sign In'}
                                        </Text>
                                    )}
                                </LinearGradient>
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

                        {/* Footer */}
                        <View style={styles.footer}>
                            <View style={styles.footerLine} />
                            <Text style={styles.footerText}>Couples App</Text>
                            <View style={styles.footerLine} />
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
    ambientGlow: {
        position: 'absolute',
        top: -100,
        left: SCREEN_WIDTH / 2 - 150,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: colors.primary,
        opacity: 0.08,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 40,
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    tagline: {
        fontSize: 15,
        color: colors.textSecondary,
        marginTop: 16,
        letterSpacing: 0.5,
    },
    formCard: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    formTitle: {
        fontSize: 22,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 24,
        textAlign: 'center',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceLight,
        borderRadius: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: colors.text,
    },
    eyeButton: {
        padding: 8,
        marginLeft: 8,
    },
    forgotButton: {
        alignSelf: 'flex-end',
        marginBottom: 20,
        marginTop: -8,
    },
    forgotText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '500',
    },
    primaryButton: {
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 8,
    },
    buttonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: colors.background,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    toggleSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 28,
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
        gap: 12,
    },
    footerLine: {
        width: 40,
        height: 1,
        backgroundColor: colors.border,
    },
    footerText: {
        color: colors.textMuted,
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});
