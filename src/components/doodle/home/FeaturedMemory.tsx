import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text, Animated, PanResponder, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../config/theme';
import { ResponsiveUtils } from '../../../utils/responsive';
import { WobblyCard } from '../index';

const { scale, verticalScale } = ResponsiveUtils;

interface FeaturedMemoryProps {
    partnerImageUri?: string | null;
    userImageUri?: string | null;
    partnerName?: string;
    userName?: string;
    onPress: () => void;
    onSeeAllPress?: () => void;
    label?: string;
}

export const FeaturedMemory: React.FC<FeaturedMemoryProps> = ({
    partnerImageUri,
    userImageUri,
    partnerName = "Partner",
    userName = "You",
    onPress,
    onSeeAllPress,
    label = "TODAY'S MOMENT"
}) => {
    const [currentIndex, setCurrentIndex] = useState(0); // 0 = partner, 1 = user
    const [cardWidth, setCardWidth] = useState(0);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const handleLayout = (event: LayoutChangeEvent) => {
        const { width } = event.nativeEvent.layout;
        setCardWidth(width);
    };

    const switchView = (newIndex: number) => {
        if (newIndex === currentIndex) return;

        // Fade out, switch, fade in
        Animated.sequence([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start();

        setTimeout(() => setCurrentIndex(newIndex), 150);
    };

    const goLeft = () => {
        if (currentIndex === 1) switchView(0);
    };

    const goRight = () => {
        if (currentIndex === 0) switchView(1);
    };

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 20;
            },
            onPanResponderRelease: (_, gestureState) => {
                const swipeThreshold = 50;

                if (gestureState.dx > swipeThreshold && currentIndex === 1) {
                    // Swipe right - go to partner (index 0)
                    switchView(0);
                } else if (gestureState.dx < -swipeThreshold && currentIndex === 0) {
                    // Swipe left - go to user (index 1)
                    switchView(1);
                }
            },
        })
    ).current;

    const currentImageUri = currentIndex === 0 ? partnerImageUri : userImageUri;
    const currentName = currentIndex === 0 ? partnerName : userName;
    const isPartnerView = currentIndex === 0;

    const renderContent = () => {
        if (currentImageUri) {
            return (
                <Animated.View style={[styles.imageContainer, { opacity: fadeAnim }]}>
                    <Image source={{ uri: currentImageUri }} style={styles.image} resizeMode="cover" />
                    <View style={styles.nameOverlay}>
                        <Text style={styles.nameText}>{currentName}'s moment</Text>
                    </View>
                </Animated.View>
            );
        }
        return (
            <Animated.View style={[styles.placeholder, { opacity: fadeAnim }]}>
                <TouchableOpacity style={styles.placeholderContent} onPress={onPress} activeOpacity={0.8}>
                    <Ionicons name="camera-outline" size={48} color="#8B6B75" />
                    <Text style={styles.placeholderText}>
                        {isPartnerView ? `Waiting for ${currentName}...` : 'Tap to add your moment'}
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Tape Element */}
            <View style={styles.tape} />

            <WobblyCard
                style={styles.card}
                backgroundColor="#EBC5B8"
                borderColor="#000"
                onPress={onPress}
            >
                <View
                    style={styles.contentContainer}
                    onLayout={handleLayout}
                    {...panResponder.panHandlers}
                >
                    {renderContent()}

                    {/* Navigation Buttons */}
                    <TouchableOpacity
                        style={[styles.navButton, styles.navButtonLeft, currentIndex === 0 && styles.navButtonDisabled]}
                        onPress={goLeft}
                        activeOpacity={0.7}
                        disabled={currentIndex === 0}
                    >
                        <Ionicons name="chevron-back" size={24} color={currentIndex === 0 ? 'rgba(255,255,255,0.3)' : '#fff'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.navButton, styles.navButtonRight, currentIndex === 1 && styles.navButtonDisabled]}
                        onPress={goRight}
                        activeOpacity={0.7}
                        disabled={currentIndex === 1}
                    >
                        <Ionicons name="chevron-forward" size={24} color={currentIndex === 1 ? 'rgba(255,255,255,0.3)' : '#fff'} />
                    </TouchableOpacity>

                    {/* Indicator dots */}
                    <View style={styles.dotsContainer}>
                        <TouchableOpacity onPress={() => switchView(0)}>
                            <View style={[styles.dot, currentIndex === 0 && styles.dotActive]} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => switchView(1)}>
                            <View style={[styles.dot, currentIndex === 1 && styles.dotActive]} />
                        </TouchableOpacity>
                    </View>

                    {/* Label showing whose view */}
                    <View style={styles.viewLabel}>
                        <Text style={styles.viewLabelText}>
                            {isPartnerView ? `${partnerName}'s` : 'Your'} view
                        </Text>
                    </View>
                </View>
            </WobblyCard>

            {/* Badge with label - positioned on the left */}
            <View style={styles.badge}>
                <Text style={styles.badgeText}>{label}</Text>
            </View>

            {/* See All Memories Button - positioned below with proper spacing */}
            {onSeeAllPress && (
                <TouchableOpacity style={styles.seeAllButton} onPress={onSeeAllPress} activeOpacity={0.8}>
                    <Ionicons name="images-outline" size={16} color="#000" />
                    <Text style={styles.seeAllText}>See all memories</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: verticalScale(20),
        marginBottom: verticalScale(10),
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
    },
    tape: {
        width: scale(100),
        height: verticalScale(24),
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        position: 'absolute',
        top: verticalScale(-10),
        zIndex: 10,
        transform: [{ rotate: '-3deg' }],
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    card: {
        width: '100%',
        aspectRatio: 1.4,
        padding: 0,
        borderWidth: scale(2),
    },
    contentContainer: {
        flex: 1,
        margin: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    imageContainer: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    nameOverlay: {
        position: 'absolute',
        bottom: verticalScale(35),
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingVertical: verticalScale(8),
        paddingHorizontal: theme.spacing.sm,
    },
    nameText: {
        color: '#fff',
        fontSize: theme.typography.fontSize.base,
        fontWeight: '600',
        textAlign: 'center',
    },
    placeholder: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    placeholderContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(139, 107, 117, 0.1)',
    },
    placeholderText: {
        marginTop: theme.spacing.sm,
        color: '#8B6B75',
        fontSize: theme.typography.fontSize.sm,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.md,
    },
    navButton: {
        position: 'absolute',
        top: '50%',
        marginTop: -20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    navButtonLeft: {
        left: 8,
    },
    navButtonRight: {
        right: 8,
    },
    navButtonDisabled: {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    dotsContainer: {
        position: 'absolute',
        bottom: verticalScale(8),
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.spacing.sm,
    },
    dot: {
        width: scale(8),
        height: scale(8),
        borderRadius: scale(4),
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    dotActive: {
        backgroundColor: '#fff',
        width: scale(10),
        height: scale(10),
        borderRadius: scale(5),
    },
    viewLabel: {
        position: 'absolute',
        top: 8,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    viewLabelText: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        color: '#fff',
        fontSize: theme.typography.fontSize.xs,
        fontWeight: '600',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.borderRadius.sm,
        overflow: 'hidden',
    },
    badge: {
        marginTop: verticalScale(12),
        alignSelf: 'flex-start',
        marginLeft: scale(10),
        backgroundColor: '#fff',
        borderWidth: scale(2),
        borderColor: '#000',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: verticalScale(6),
        borderRadius: theme.borderRadius.md,
        transform: [{ rotate: '-1deg' }],
        ...theme.shadows.sm,
    },
    badgeText: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: 'bold',
        letterSpacing: 1,
        color: '#000',
    },
    seeAllButton: {
        marginTop: verticalScale(12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#fff',
        borderWidth: scale(2),
        borderColor: '#000',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: verticalScale(10),
        borderRadius: theme.borderRadius.lg,
        ...theme.shadows.sm,
    },
    seeAllText: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: '600',
        color: '#000',
    },
});
