import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../config/theme';
import { Video, ResizeMode } from 'expo-av';

interface PolaroidMemoryCardProps {
    title: string;
    date: string;
    location?: string;
    rating: number;
    comment?: string;
    mediaUri?: string;
    mediaType?: 'image' | 'video';
    rotation?: 'left' | 'right' | 'none';
    hasTape?: boolean;
    hasClip?: boolean;
    onPress?: () => void;
    onEdit?: () => void;
}

export const PolaroidMemoryCard: React.FC<PolaroidMemoryCardProps> = ({
    title,
    date,
    location,
    rating,
    comment,
    mediaUri,
    mediaType = 'image',
    rotation = 'none',
    hasTape = false,
    hasClip = false,
    onPress,
    onEdit,
}) => {
    // Determine rotation style
    const rotationStyle = {
        left: { transform: [{ rotate: '-3deg' }] },
        right: { transform: [{ rotate: '3deg' }] },
        none: {},
    }[rotation];

    // Render star rating
    const renderStars = () => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Ionicons
                    key={i}
                    name={i <= rating ? 'star' : 'star-outline'}
                    size={14}
                    color={i <= rating ? '#C25068' : '#D4A5B0'}
                    style={{ marginRight: 2 }}
                />
            );
        }
        return stars;
    };

    return (
        <TouchableOpacity
            style={[styles.container, rotationStyle]}
            onPress={onPress}
            activeOpacity={0.9}
        >
            {/* Tape decoration */}
            {hasTape && (
                <View style={styles.tapeContainer}>
                    <View style={[styles.tape, styles.tapeLeft]} />
                </View>
            )}

            {/* Clip decoration */}
            {hasClip && (
                <View style={styles.clipContainer}>
                    <Ionicons name="bookmark" size={24} color="#C25068" />
                </View>
            )}

            {/* Edit icon button */}
            {onEdit && (
                <TouchableOpacity
                    style={styles.editButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        onEdit();
                    }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="pencil" size={16} color="#FFFFFF" />
                </TouchableOpacity>
            )}

            {/* Polaroid frame */}
            <View style={styles.polaroidFrame}>
                {/* Media area */}
                <View style={styles.mediaContainer}>
                    {mediaUri ? (
                        mediaType === 'video' ? (
                            <View style={styles.videoContainer}>
                                <Video
                                    source={{ uri: mediaUri }}
                                    style={styles.media}
                                    resizeMode={ResizeMode.COVER}
                                    shouldPlay={false}
                                    isLooping={false}
                                    isMuted={true}
                                />
                                {/* Video play indicator */}
                                <View style={styles.videoOverlay}>
                                    <View style={styles.playButton}>
                                        <Ionicons name="play" size={28} color="#fff" />
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <Image source={{ uri: mediaUri }} style={styles.media} />
                        )
                    ) : (
                        <View style={styles.placeholderMedia}>
                            <Ionicons name="image-outline" size={48} color="#D4A5B0" />
                        </View>
                    )}
                </View>

                {/* Card content - below the photo */}
                <View style={styles.contentContainer}>
                    {/* Date and Location row */}
                    <View style={styles.metaRow}>
                        <Text style={styles.dateText}>{date}</Text>
                        {location && (
                            <View style={styles.locationBadge}>
                                <Ionicons name="location" size={10} color="#C25068" />
                                <Text style={styles.locationText}>{location}</Text>
                            </View>
                        )}
                    </View>

                    {/* Title */}
                    <Text style={styles.title} numberOfLines={2}>{title}</Text>

                    {/* Star Rating */}
                    <View style={styles.ratingRow}>
                        {renderStars()}
                    </View>

                    {/* Comment/Quote */}
                    {comment && (
                        <Text style={styles.comment} numberOfLines={2}>
                            "{comment}"
                        </Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.xl,
        alignSelf: 'center',
        width: '85%',
        maxWidth: 320,
    },
    tapeContainer: {
        position: 'absolute',
        top: -8,
        left: 20,
        right: 20,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    tape: {
        width: 60,
        height: 20,
        backgroundColor: 'rgba(255, 220, 180, 0.7)',
        transform: [{ rotate: '-5deg' }],
        borderRadius: 2,
    },
    tapeLeft: {},
    clipContainer: {
        position: 'absolute',
        top: -12,
        right: 20,
        zIndex: 10,
    },
    editButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 20,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...theme.shadows.md,
    },
    polaroidFrame: {
        backgroundColor: '#FFFFFF',
        borderRadius: 4,
        padding: 10,
        paddingBottom: 20,
        // Subtle shadow for polaroid effect
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    mediaContainer: {
        width: '100%',
        aspectRatio: 1, // Square photo
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: '#F0E6E9',
    },
    media: {
        width: '100%',
        height: '100%',
    },
    placeholderMedia: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5EAEE',
    },
    videoContainer: {
        width: '100%',
        height: '100%',
    },
    videoOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    playButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(194, 80, 104, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 4,
    },
    contentContainer: {
        marginTop: 12,
        paddingHorizontal: 4,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    dateText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#8B6B75',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5EAEE',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    locationText: {
        fontSize: 10,
        color: '#C25068',
        marginLeft: 3,
        fontWeight: '500',
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#3D2530',
        marginBottom: 6,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    comment: {
        fontSize: 13,
        fontStyle: 'italic',
        color: '#6B4F5A',
        lineHeight: 18,
    },
});

export default PolaroidMemoryCard;
