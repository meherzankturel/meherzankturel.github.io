import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../config/theme';
import { WobblyCard } from '../index';

interface FeaturedMemoryProps {
    imageUri?: string | null;
    onPress: () => void;
    label?: string;
}

export const FeaturedMemory: React.FC<FeaturedMemoryProps> = ({
    imageUri,
    onPress,
    label = "FEATURED MEMORY"
}) => {
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
                <View style={styles.contentContainer}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
                    ) : (
                        <View style={styles.placeholder}>
                            {/* Illustration of a person/placeholder */}
                            <Ionicons name="image-outline" size={64} color="#C2A89C" />
                            <Text style={styles.placeholderText}>Add a memory</Text>
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
        marginTop: 20,
        marginBottom: 30,
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
    },
    tape: {
        width: 100,
        height: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        position: 'absolute',
        top: -10,
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
        borderWidth: 2, // Thicker border
    },
    contentContainer: {
        flex: 1,
        margin: 16, // Inner margin
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.03)', // Slight darken
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        marginTop: 8,
        color: '#8B6B75',
        fontFamily: 'Itim_400Regular', // If available, else default
        fontSize: 16,
    },
    badge: {
        position: 'absolute',
        bottom: -14,
        right: 20,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#000',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        transform: [{ rotate: '-1deg' }],
        ...theme.shadows.sm,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
        color: '#000',
    },
});
