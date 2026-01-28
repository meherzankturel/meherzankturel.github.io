import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../config/theme';
import { WobblyCard } from './index';

interface DoodleDateCardProps {
    title: string;
    date: Date;
    categoryIcon: string;
    categoryColor: string;
    description?: string;
    isUpcoming: boolean;
    image?: string; // Optional image
    onEdit: () => void;
    onDelete: () => void;
    onComplete?: () => void;
    onAction?: () => void; // FaceTime or actions
}

export const DoodleDateCard: React.FC<DoodleDateCardProps> = ({
    title,
    date,
    categoryIcon,
    categoryColor,
    description,
    isUpcoming,
    image,
    onEdit,
    onDelete,
    onComplete,
    onAction
}) => {
    const handwritingFont = Platform.OS === 'ios' ? 'Noteworthy-Bold' : 'sans-serif-medium';

    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    return (
        <View style={{ marginBottom: 24, paddingHorizontal: 4 }}>
            <WobblyCard
                backgroundColor="#ffffff"
                borderColor="#000"
                style={{ padding: 0 }}
                rotate='0deg' // Less wobble on the card itself to match clean look
            >
                <View style={styles.content}>
                    {/* Header Row */}
                    <View style={styles.headerRow}>
                        <Text style={[styles.statusText, { fontFamily: handwritingFont }]}>
                            {isUpcoming ? 'Coming up!' : (
                                // If past, maybe show "Last week" or "Past"
                                'Past Date'
                            )}
                        </Text>
                        <Ionicons name={categoryIcon as any} size={28} color={theme.colors.primary} />
                    </View>

                    {/* Title */}
                    <Text style={styles.title} numberOfLines={2}>{title}</Text>

                    {/* Date */}
                    <Text style={styles.dateText}>
                        {formatDate(date)} • {formatTime(date)}
                    </Text>

                    {/* Image Block */}
                    <View style={styles.imageContainer}>
                        {image ? (
                            <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
                        ) : (
                            // Fallback placeholder matching the dark vibe in example? or Category color
                            <View style={[styles.imagePlaceholder, { backgroundColor: '#333' }]}>
                                {/* Show stars or pattern */}
                                <View style={{ position: 'absolute', top: 20, right: 40, width: 2, height: 2, backgroundColor: '#FFF' }} />
                                <View style={{ position: 'absolute', top: 50, left: 30, width: 2, height: 2, backgroundColor: '#FFF' }} />
                                <View style={{ position: 'absolute', top: 30, left: 80, width: 3, height: 3, backgroundColor: '#FFF' }} />

                                <Ionicons name={categoryIcon as any} size={64} color="rgba(255,255,255,0.2)" />
                            </View>
                        )}
                    </View>

                    {/* Footer Row */}
                    <View style={styles.footerRow}>
                        <View />
                        <TouchableOpacity onPress={onEdit}>
                            <Text style={[styles.detailsLink, { fontFamily: handwritingFont }]}>Details</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </WobblyCard>
        </View>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: 20,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusText: {
        color: '#A020F0', // Purple
        fontSize: 18,
        transform: [{ rotate: '-2deg' }]
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 4,
    },
    dateText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    imageContainer: {
        width: '100%',
        height: 180,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
        marginBottom: 12,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailsLink: {
        fontSize: 18,
        color: '#000',
        textDecorationLine: 'underline',
        textDecorationColor: '#A020F0', // Purple underline
        textDecorationStyle: 'solid',
    }
});
