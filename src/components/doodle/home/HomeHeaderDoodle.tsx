import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../config/theme';

interface HomeHeaderDoodleProps {
    userImage?: string | null;
    partnerImage?: string | null;
    onSettingsPress: () => void;
    onProfilePress: () => void;
}

export const HomeHeaderDoodle: React.FC<HomeHeaderDoodleProps> = ({
    userImage,
    partnerImage,
    onSettingsPress,
    onProfilePress,
}) => {
    return (
        <View style={styles.header}>
            <TouchableOpacity onPress={onProfilePress} activeOpacity={0.8}>
                <View style={styles.avatarsContainer}>
                    {/* User Avatar (Back) */}
                    <View style={[styles.avatarFrame, styles.userAvatar]}>
                        {userImage ? (
                            <Image source={{ uri: userImage }} style={styles.avatarImage} />
                        ) : (
                            <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                                <Ionicons name="person" size={20} color="#bfafa6" />
                            </View>
                        )}
                    </View>

                    {/* Partner Avatar (Front) */}
                    <View style={[styles.avatarFrame, styles.partnerAvatar]}>
                        {partnerImage ? (
                            <Image source={{ uri: partnerImage }} style={styles.avatarImage} />
                        ) : (
                            <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                                <Ionicons name="person-outline" size={20} color="#6B4F5A" />
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={onSettingsPress} style={styles.settingsButton}>
                <Ionicons name="settings-sharp" size={24} color="#000" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.sm, // Reduced padding to match layout
        paddingVertical: theme.spacing.md,
        height: 60,
    },
    avatarsContainer: {
        flexDirection: 'row',
        height: 50,
        width: 80,
    },
    avatarFrame: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#000',
        overflow: 'hidden',
        position: 'absolute',
        backgroundColor: '#F5E6D3',
    },
    userAvatar: {
        left: 0,
        zIndex: 1,
        backgroundColor: '#ffd8d8', // Light pink
    },
    partnerAvatar: {
        left: 32,
        zIndex: 2,
        backgroundColor: '#fff',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0E6DD',
    },
    settingsButton: {
        padding: 8,
    },
});
