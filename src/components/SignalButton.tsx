import React, { useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
} from 'react-native';
import { theme } from '../config/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface SignalButtonProps {
    onSendSignal: (type: 'pulse' | 'sos') => void;
}

export default function SignalButton({ onSendSignal }: SignalButtonProps) {
    const pulseScale = useRef(new Animated.Value(1)).current;
    const sosScale = useRef(new Animated.Value(1)).current;

    const animatePress = (scale: Animated.Value) => {
        Animated.sequence([
            Animated.timing(scale, {
                toValue: 0.95,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const handlePulse = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        animatePress(pulseScale);
        onSendSignal('pulse');
    };

    const handleSOS = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        animatePress(sosScale);
        onSendSignal('sos');
    };

    return (
        <View style={styles.container}>
            {/* Send Love Button */}
            <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: pulseScale }] }]}>
                <TouchableOpacity
                    style={styles.loveButton}
                    onPress={handlePulse}
                    activeOpacity={0.85}
                >
                    <View style={styles.loveIconContainer}>
                        <Ionicons name="heart" size={22} color="#FFFFFF" />
                    </View>
                    <Text style={styles.loveText}>Send Love</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* SOS Button */}
            <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: sosScale }] }]}>
                <TouchableOpacity
                    style={styles.sosButton}
                    onPress={handleSOS}
                    activeOpacity={0.85}
                    onLongPress={handleSOS}
                >
                    <View style={styles.sosIconContainer}>
                        <Ionicons name="alert-circle" size={22} color="#FFFFFF" />
                    </View>
                    <Text style={styles.sosText}>SOS</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.md,
        marginVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.md,
    },
    buttonWrapper: {
        flex: 1,
    },

    // Send Love Button - Soft dusty rose
    loveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.accentPink, // Dusty rose
        paddingVertical: 14,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.xl,
        gap: theme.spacing.sm,
        ...theme.shadows.sm,
    },
    loveIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loveText: {
        fontSize: theme.typography.fontSize.md,
        fontWeight: '600',
        color: '#FFFFFF',
    },

    // SOS Button - Muted doodle purple tone
    sosButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#a855f7', // Doodle purple
        paddingVertical: 14,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.xl,
        gap: theme.spacing.sm,
        ...theme.shadows.sm,
    },
    sosIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sosText: {
        fontSize: theme.typography.fontSize.md,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
