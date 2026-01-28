import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../config/theme';
import { WobblyCircle } from '../index';

interface ControlCenterProps {
    onSendLove: () => void;
    onSOS: () => void;
    onCenterPress?: () => void;
    sendingSOS?: boolean;
}

export const ControlCenter: React.FC<ControlCenterProps> = ({
    onSendLove,
    onSOS,
    onCenterPress,
    sendingSOS
}) => {
    return (
        <View style={styles.container}>
            {/* Left: Send Love */}
            <View style={styles.sideControl}>
                <TouchableOpacity onPress={onSendLove} activeOpacity={0.7} style={[styles.circleButton, styles.pinkButton]}>
                    <Ionicons name="heart" size={28} color="#E85D75" />
                </TouchableOpacity>
                <Text style={styles.label}>SEND LOVE</Text>
            </View>

            {/* Center: Wobbly Container */}
            <View style={styles.centerControl}>
                <WobblyCircle
                    style={styles.wobblyCircle}
                    borderColor="#000"
                    backgroundColor="#fff"
                    onPress={onCenterPress}
                >
                    <View style={styles.heartsRow}>
                        <Ionicons name="heart-outline" size={42} color="#000" style={styles.leftHeart} />
                        <Ionicons name="heart-outline" size={42} color="#000" style={styles.rightHeart} />
                    </View>
                </WobblyCircle>
            </View>

            {/* Right: SOS */}
            <View style={styles.sideControl}>
                <TouchableOpacity onPress={onSOS} activeOpacity={0.7} style={[styles.circleButton, styles.purpleButton]}>
                    {sendingSOS ? (
                        <Ionicons name="radio-outline" size={28} color="#8A5AAB" />
                    ) : (
                        <Ionicons name="medkit" size={28} color="#8A5AAB" /> // Used medkit as potion proxy
                    )}
                </TouchableOpacity>
                <Text style={styles.label}>SOS</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.md,
        marginVertical: theme.spacing.xl,
    },
    sideControl: {
        alignItems: 'center',
        gap: 8,
    },
    circleButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        ...theme.shadows.sm,
    },
    pinkButton: {
        backgroundColor: '#FFE5E5',
    },
    purpleButton: {
        backgroundColor: '#EBD9F5',
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#8B6B75',
        letterSpacing: 1,
    },
    centerControl: {
        marginTop: -20, // Push up slightly to overlap
    },
    wobblyCircle: {
        width: 140,
        height: 100, // Elliptical as per image
        borderTopLeftRadius: 60,
        borderTopRightRadius: 60,
        borderBottomLeftRadius: 60,
        borderBottomRightRadius: 60,
        // Override border radius logic from component if possible, or accept the generic wobbly look
    },
    heartsRow: {
        flexDirection: 'row',
        gap: 4,
    },
    leftHeart: {
        transform: [{ rotate: '-10deg' }]
    },
    rightHeart: {
        transform: [{ rotate: '10deg' }]
    }
});
