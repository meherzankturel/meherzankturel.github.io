import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { theme } from '../src/config/theme';
import { AuthService } from '../src/services/auth.service';

export default function SignUpScreen() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [faceTimeEmail, setFaceTimeEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper function to validate phone number
  const validatePhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    return /^\d{10,15}$/.test(cleaned);
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateStep1 = () => {
    setError('');
    if (!name.trim()) return setError('Name is required');
    if (!email.trim()) return setError('Email is required');
    if (!validateEmail(email)) return setError('Invalid email format');
    setStep(2);
  };

  const validateStep2 = () => {
    setError('');
    if (!password) return setError('Password is required');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');
    setStep(3);
  };

  const handleSignUp = async () => {
    setError('');
    if (!phoneNumber) return setError('Phone number is required');
    if (!validatePhoneNumber(phoneNumber)) return setError('Invalid phone number (10-15 digits)');
    if (!faceTimeEmail) return setError('FaceTime email is required');
    if (!validateEmail(faceTimeEmail)) return setError('Invalid FaceTime email format');

    setLoading(true);
    try {
      await AuthService.signUp(
        email,
        password,
        name.trim(),
        phoneNumber.trim(),
        faceTimeEmail.trim()
      );
      Alert.alert(
        'Success',
        'Account created! Please check your email to verify your account.',
        [{ text: 'OK', onPress: () => router.push('/login') }]
      );
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      Alert.alert('Error', err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.appName}>SYNC</Text>
          <Text style={styles.title}>
            {step === 1 && 'Who are you?'}
            {step === 2 && 'Secure Account'}
            {step === 3 && 'Stay Connected'}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: step >= 1 ? theme.colors.primary : '#ccc' }} />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: step >= 2 ? theme.colors.primary : '#ccc' }} />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: step >= 3 ? theme.colors.primary : '#ccc' }} />
          </View>

          <Text style={styles.subtitle}>
            {step === 1 && 'Let\'s get to know you'}
            {step === 2 && 'Set a password'}
            {step === 3 && 'Enable SOS features'}
          </Text>

          {step === 1 && (
            <>
              <Input
                label="Name *"
                placeholder="Your full name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
              />

              <Input
                label="Email *"
                placeholder="your@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Button title="Next" onPress={validateStep1} style={styles.button} />
            </>
          )}

          {step === 2 && (
            <>
              <Input
                label="Password *"
                placeholder="At least 6 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
              />

              <Input
                label="Confirm Password *"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Back" onPress={() => setStep(1)} variant="outline" style={[styles.button, { flex: 1 }]} />
                <Button title="Next" onPress={validateStep2} style={[styles.button, { flex: 1 }]} />
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Input
                label="Phone Number *"
                placeholder="+1 234 567 8900"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoComplete="tel"
                helperText="For SOS cellular calls"
              />

              <Input
                label="FaceTime Email *"
                placeholder="facetime@email.com"
                value={faceTimeEmail}
                onChangeText={setFaceTimeEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                helperText="For SOS FaceTime calls"
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Back" onPress={() => setStep(2)} variant="outline" style={[styles.button, { flex: 1 }]} />
                <Button title="Sign Up" onPress={handleSignUp} loading={loading} style={[styles.button, { flex: 1 }]} />
              </View>
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Text
              style={styles.linkText}
              onPress={() => router.push('/login')}
            >
              Sign In
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  appName: {
    fontSize: theme.typography.fontSize['5xl'] || 42,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
    letterSpacing: 1,
  },
  title: {
    fontSize: theme.typography.fontSize['4xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  button: {
    marginTop: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.base,
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});

