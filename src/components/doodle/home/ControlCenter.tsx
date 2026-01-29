import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../config/theme';
import { ResponsiveUtils } from '../../../utils/responsive';
import { WobblyCircle } from '../index';

const { scale, verticalScale } = ResponsiveUtils;

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
                    <Ionicons name="heart" size={scale(28)} color="#E85D75" />
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
                        <Ionicons name="heart-outline" size={scale(42)} color="#000" style={styles.leftHeart} />
                        <Ionicons name="heart-outline" size={scale(42)} color="#000" style={styles.rightHeart} />
                    </View>
                </WobblyCircle>
            </View>

            {/* Right: SOS */}
            <View style={styles.sideControl}>
                <TouchableOpacity onPress={onSOS} activeOpacity={0.7} style={[styles.circleButton, styles.purpleButton]}>
                    {sendingSOS ? (
                        <Ionicons name="radio-outline" size={scale(28)} color="#8A5AAB" />
                    ) : (
                        <Ionicons name="medkit" size={scale(28)} color="#8A5AAB" /> // Used medkit as potion proxy
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
        gap: theme.spacing.xs,
    },
    circleButton: {
        width: scale(60),
        height: scale(60),
        borderRadius: scale(30),
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
        fontSize: theme.typography.fontSize.xs,
        fontWeight: 'bold',
        color: '#8B6B75',
        letterSpacing: 1,
    },
    centerControl: {
        marginTop: verticalScale(-20), // Push up slightly to overlap
    },
    wobblyCircle: {
        width: scale(140),
        height: verticalScale(100), // Elliptical as per image
        borderTopLeftRadius: scale(60),
        borderTopRightRadius: scale(60),
        borderBottomLeftRadius: scale(60),
        borderBottomRightRadius: scale(60),
        // Override border radius logic from component if possible, or accept the generic wobbly look
    },
    heartsRow: {
        flexDirection: 'row',
        gap: scale(4),
    },
    leftHeart: {
        transform: [{ rotate: '-10deg' }]
    },
    rightHeart: {
        transform: [{ rotate: '10deg' }]
    }
});
