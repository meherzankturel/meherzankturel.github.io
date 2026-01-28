import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../config/theme';

interface ReviewDateDoodleProps {
    title: string;
    imageUri?: string;
    rating: number; // 0-5
    setRating: (r: number) => void;
    message: string;
    setMessage: (t: string) => void;
    onAddPhoto: () => void;
    onSubmit: () => void;
    onBack: () => void;
}

export const ReviewDateDoodle: React.FC<ReviewDateDoodleProps> = ({
    title,
    imageUri,
    rating,
    setRating,
    message,
    setMessage,
    onAddPhoto,
    onSubmit,
    onBack
}) => {
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>moment from last night</Text>
                <TouchableOpacity onPress={onSubmit}>
                    {/* Ellipsis/Menu in ref, but using as 'Save' here? Or header is just title */}
                    <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Photo Frame */}
                <View style={styles.photoContainer}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
                    ) : (
                        <View style={styles.photoPlaceholder}>
                            <Text style={{ color: '#888' }}>No photo yet</Text>
                        </View>
                    )}

                    <View style={styles.heartBadge}>
                        <Ionicons name="heart" size={24} color="#fff" />
                    </View>
                </View>

                {/* Rating Section */}
                <Text style={styles.questionText}>how was it?</Text>
                <View style={styles.underline} />

                <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => setRating(star)}>
                            <Ionicons
                                name="star"
                                size={40}
                                color={star <= rating ? '#E85D75' : '#E0E0E0'}
                            />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Text Area */}
                <Text style={[styles.messageInput, { fontStyle: message ? 'normal' : 'italic' }]}>
                    {/* Using Text wrapper or just inputs? Ref has 'the pasta was amazing...' */}
                </Text>
                <TextInput
                    style={styles.messageInput}
                    placeholder="write a little memory..."
                    placeholderTextColor="#aaa"
                    value={message}
                    onChangeText={setMessage}
                    multiline
                />
                <View style={styles.dashedLine} />

                {/* Add Photo Button */}
                <TouchableOpacity style={styles.addPhotoButton} onPress={onAddPhoto}>
                    <Ionicons name="camera" size={24} color="#E85D75" />
                    <Text style={styles.addPhotoText}>Add More Photos</Text>
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
    content: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    photoContainer: {
        width: '100%',
        height: 300,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#000',
        transform: [{ rotate: '-1deg' }], // Slight wobble
        marginBottom: 30,
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    photoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heartBadge: {
        position: 'absolute',
        bottom: -10,
        right: -10,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#E85D75',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    questionText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 8,
    },
    underline: {
        width: 100,
        height: 4,
        backgroundColor: '#FFE5E5', // Light pink
        marginBottom: 20,
    },
    starsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 30,
    },
    messageInput: {
        fontSize: 18,
        color: '#000',
        marginBottom: 20,
        minHeight: 60,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', // Ideally a handwritten font
    },
    dashedLine: {
        height: 1,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 1,
        width: '100%',
        marginBottom: 30,
    },
    addPhotoButton: {
        borderWidth: 2,
        borderColor: '#E85D75',
        borderStyle: 'dashed',
        borderRadius: 12,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    addPhotoText: {
        color: '#E85D75',
        fontSize: 16,
        fontWeight: 'bold',
    }
});
