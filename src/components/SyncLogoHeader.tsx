import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SyncLogoHeaderProps {
    onSettingsPress?: () => void;
    onLogoutPress?: () => void;
    onMapPress?: () => void;
    showButtons?: boolean;
}

export const SyncLogoHeader: React.FC<SyncLogoHeaderProps> = ({
    onSettingsPress,
    onLogoutPress,
    onMapPress,
    showButtons = true,
}) => {
    return (
        <View style={styles.header}>
            {/* SYNC Logo and Text */}
            <View style={styles.logoContainer}>
                {/* User's exact logo image - mini version */}
                <Image
                    source={require('../../assets/sync-logo.png')}
                    style={styles.logoMini}
                    resizeMode="contain"
                />
                {/* User's exact SYNC text image */}
                <Image
                    source={require('../../assets/sync-text.png')}
                    style={styles.logoText}
                    resizeMode="contain"
                />
            </View>

            {/* Header Buttons */}
            {showButtons && (
                <View style={styles.headerButtons}>
                    {onMapPress && (
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={onMapPress}
                        >
                            <Ionicons name="map-outline" size={22} color="#756189" />
                        </TouchableOpacity>
                    )}
                    {onSettingsPress && (
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={onSettingsPress}
                        >
                            <Ionicons name="settings-outline" size={22} color="#756189" />
                        </TouchableOpacity>
                    )}
                    {onLogoutPress && (
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={onLogoutPress}
                        >
                            <Ionicons name="log-out-outline" size={22} color="#756189" />
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    logoMini: {
        width: 40,
        height: 40,
    },
    logoText: {
        width: 70,
        height: 20,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#f8f5ff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e8e0f0',
    },
});

export default SyncLogoHeader;

