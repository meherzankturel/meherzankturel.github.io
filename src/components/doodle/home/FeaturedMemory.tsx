import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text, Animated, PanResponder, Dimensions, LayoutChange } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../config/theme';
import { ResponsiveUtils } from '../../../utils/responsive';
import { WobblyCard } from '../index';

const { scale, verticalScale, moderateScale } = ResponsiveUtils;

interface FeaturedMemoryProps {
    partnerImageUri?: string | null;
    userImageUri?: string | null;
    partnerName?: string;
    userName?: string;
    onPress: () => void;
    label?: string;
}

export const FeaturedMemory: React.FC<FeaturedMemoryProps> = ({
    partnerImageUri,
    userImageUri,
    partnerName = "Partner",
    userName = "You",
    onPress,
    label = "FEATURED MEMORY"
}) => {
    const [currentIndex, setCurrentIndex] = useState(0); // 0 = partner, 1 = user
    const [cardWidth, setCardWidth] = useState(0);
    const pan = useRef(new Animated.ValueXY()).current;

    const handleLayout = (event: LayoutChange) => {
        const { width } = event.nativeEvent.layout;
        // The contentContainer already accounts for its own margin (16px on each side)
        // So the width is already the usable width for images
        setCardWidth(width);
    };

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 10;
            },
            onPanResponderGrant: () => {
                pan.setOffset({
                    x: pan.x._value,
                    y: 0,
                });
            },
            onPanResponderMove: (_, gestureState) => {
                pan.setValue({ x: gestureState.dx, y: 0 });
            },
            onPanResponderRelease: (_, gestureState) => {
                pan.flattenOffset();
                if (cardWidth === 0) return;
                
                const swipeThreshold = cardWidth * 0.25;
                
                if (gestureState.dx > swipeThreshold && currentIndex === 1) {
                    // Swipe right - go to partner (index 0)
                    Animated.spring(pan, {
                        toValue: { x: 0, y: 0 },
                        useNativeDriver: false,
                    }).start();
                    setCurrentIndex(0);
                } else if (gestureState.dx < -swipeThreshold && currentIndex === 0) {
                    // Swipe left - go to user (index 1)
                    Animated.spring(pan, {
                        toValue: { x: -cardWidth, y: 0 },
                        useNativeDriver: false,
                    }).start();
                    setCurrentIndex(1);
                } else {
                    // Snap back
                    Animated.spring(pan, {
                        toValue: { x: currentIndex === 0 ? 0 : -cardWidth, y: 0 },
                        useNativeDriver: false,
                    }).start();
                }
            },
        })
    ).current;

    const currentImageUri = currentIndex === 0 ? partnerImageUri : userImageUri;
    const currentName = currentIndex === 0 ? partnerName : userName;
    const hasBothImages = partnerImageUri && userImageUri;

    return (
        <View style={styles.container}>
            {/* Tape Element */}
            <View style={styles.tape} />

            <WobblyCard
                style={styles.card}
                backgroundColor="#EBC5B8" // Tan/Beige color from image
                borderColor="#000"
                onPress={onPress}
            >
                <View 
                    style={styles.contentContainer} 
                    onLayout={handleLayout}
                    {...(hasBothImages ? panResponder.panHandlers : {})}
                >
                    <Animated.View
                        style={[
                            styles.swipeContainer,
                            hasBothImages && {
                                transform: [{ translateX: pan.x }],
                                flexDirection: 'row',
                            },
                        ]}
                    >
                        {/* Partner Image */}
                        <View style={[styles.imageWrapper, hasBothImages && cardWidth > 0 && { width: cardWidth }]}>
                            {partnerImageUri ? (
                                <>
                                    <Image source={{ uri: partnerImageUri }} style={styles.image} resizeMode="cover" />
                                    <View style={styles.nameOverlay}>
                                        <Text style={styles.nameText}>{partnerName}</Text>
                                    </View>
                                </>
                            ) : (
                                <View style={styles.placeholder}>
                                    <Ionicons name="image-outline" size={64} color="#C2A89C" />
                                    <Text style={styles.placeholderText}>Add a memory</Text>
                                </View>
                            )}
                        </View>

                        {/* User Image */}
                        {hasBothImages && (
                            <View style={[styles.imageWrapper, cardWidth > 0 && { width: cardWidth }]}>
                                {userImageUri ? (
                                    <>
                                        <Image source={{ uri: userImageUri }} style={styles.image} resizeMode="cover" />
                                        <View style={styles.nameOverlay}>
                                            <Text style={styles.nameText}>{userName}</Text>
                                        </View>
                                    </>
                                ) : (
                                    <View style={styles.placeholder}>
                                        <Ionicons name="image-outline" size={64} color="#C2A89C" />
                                        <Text style={styles.placeholderText}>Add a memory</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </Animated.View>

                    {/* Swipe indicator dots */}
                    {hasBothImages && (
                        <View style={styles.dotsContainer}>
                            <View style={[styles.dot, currentIndex === 0 && styles.dotActive]} />
                            <View style={[styles.dot, currentIndex === 1 && styles.dotActive]} />
                        </View>
                    )}
                </View>
            </WobblyCard>

            {/* Featured Memory Badge */}
            <View style={styles.badge}>
                <Text style={styles.badgeText}>{label}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: verticalScale(20),
        marginBottom: verticalScale(30),
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
        aspectRatio: 1.4, // Rectangle landscape
        padding: 0, // No padding for image to fill? No, image has border padding
        borderWidth: scale(2), // Thicker border
    },
    contentContainer: {
        flex: 1,
        margin: theme.spacing.md, // Use responsive spacing
        borderRadius: theme.borderRadius.md,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.03)', // Slight darken
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    swipeContainer: {
        flex: 1,
        height: '100%',
    },
    imageWrapper: {
        flex: 1,
        height: '100%',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    nameOverlay: {
        position: 'absolute',
        bottom: 0,
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
    dotsContainer: {
        position: 'absolute',
        bottom: verticalScale(8),
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.spacing.xs,
    },
    dot: {
        width: scale(6),
        height: scale(6),
        borderRadius: scale(3),
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    dotActive: {
        backgroundColor: '#fff',
        width: scale(8),
        height: scale(8),
        borderRadius: scale(4),
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        marginTop: theme.spacing.xs,
        color: '#8B6B75',
        fontFamily: 'Itim_400Regular', // If available, else default
        fontSize: theme.typography.fontSize.md,
    },
    badge: {
        position: 'absolute',
        bottom: verticalScale(-14),
        right: scale(20),
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
});
