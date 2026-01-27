import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProfileService } from '../services/profile.service';
import WidgetService from '../services/widget.service';

interface ProfileImagePickerProps {
    currentImageUrl?: string;
    userId: string;
    userName: string;
    onImageUpdated: (newImageUrl: string | null) => void;
    size?: number;
}

export const ProfileImagePicker: React.FC<ProfileImagePickerProps> = ({
    currentImageUrl,
    userId,
    userName,
    onImageUpdated,
    size = 100,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [showOptions, setShowOptions] = useState(false);

    const handleSelectImage = async () => {
        setShowOptions(false);
        setIsLoading(true);

        try {
            const imageUri = await ProfileService.pickProfileImage();
            if (imageUri) {
                const uploadedUrl = await ProfileService.uploadProfileImage(userId, imageUri);
                if (uploadedUrl) {
                    onImageUpdated(uploadedUrl);
                    // Update widget with new avatar
                    WidgetService.updateYourProfile(userName, uploadedUrl);
                } else {
                    Alert.alert('Upload Failed', 'Could not upload your profile photo. Please try again.');
                }
            }
        } catch (error) {
            console.error('Error selecting image:', error);
            Alert.alert('Error', 'Failed to update profile photo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTakePhoto = async () => {
        setShowOptions(false);
        setIsLoading(true);

        try {
            const imageUri = await ProfileService.takeProfilePhoto();
            if (imageUri) {
                const uploadedUrl = await ProfileService.uploadProfileImage(userId, imageUri);
                if (uploadedUrl) {
                    onImageUpdated(uploadedUrl);
                    WidgetService.updateYourProfile(userName, uploadedUrl);
                } else {
                    Alert.alert('Upload Failed', 'Could not upload your profile photo. Please try again.');
                }
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take profile photo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemovePhoto = async () => {
        setShowOptions(false);
        setIsLoading(true);

        try {
            const success = await ProfileService.deleteProfileImage(userId);
            if (success) {
                onImageUpdated(null);
                WidgetService.updateYourProfile(userName, undefined);
            }
        } catch (error) {
            console.error('Error removing photo:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <TouchableOpacity
                style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}
                onPress={() => setShowOptions(true)}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator color="#00D4FF" size="large" />
                ) : currentImageUrl ? (
                    <>
                        <Image
                            source={{ uri: currentImageUrl }}
                            style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
                        />
                        <View style={styles.editBadge}>
                            <Ionicons name="camera" size={14} color="#fff" />
                        </View>
                    </>
                ) : (
                    <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
                        <Ionicons name="person" size={size * 0.4} color="#666" />
                        <View style={styles.addBadge}>
                            <Ionicons name="add" size={16} color="#fff" />
                        </View>
                    </View>
                )}
            </TouchableOpacity>

            {/* Options Modal */}
            <Modal
                visible={showOptions}
                transparent
                animationType="fade"
                onRequestClose={() => setShowOptions(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowOptions(false)}
                >
                    <View style={styles.optionsContainer}>
                        <Text style={styles.optionsTitle}>Profile Photo</Text>

                        <TouchableOpacity style={styles.option} onPress={handleTakePhoto}>
                            <Ionicons name="camera-outline" size={24} color="#fff" />
                            <Text style={styles.optionText}>Take Photo</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.option} onPress={handleSelectImage}>
                            <Ionicons name="images-outline" size={24} color="#fff" />
                            <Text style={styles.optionText}>Choose from Library</Text>
                        </TouchableOpacity>

                        {currentImageUrl && (
                            <TouchableOpacity
                                style={[styles.option, styles.removeOption]}
                                onPress={handleRemovePhoto}
                            >
                                <Ionicons name="trash-outline" size={24} color="#FF6B8A" />
                                <Text style={[styles.optionText, styles.removeText]}>Remove Photo</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setShowOptions(false)}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1A1A24',
        overflow: 'hidden',
    },
    image: {
        resizeMode: 'cover',
    },
    placeholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#2A2A35',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#00D4FF',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#0A0A0F',
    },
    addBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#00D4FF',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#0A0A0F',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    optionsContainer: {
        backgroundColor: '#1A1A24',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
    },
    optionsTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 20,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#2A2A35',
        borderRadius: 12,
        marginBottom: 10,
        gap: 12,
    },
    optionText: {
        fontSize: 16,
        color: '#fff',
    },
    removeOption: {
        marginTop: 10,
    },
    removeText: {
        color: '#FF6B8A',
    },
    cancelButton: {
        marginTop: 10,
        padding: 16,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 16,
        color: '#888',
    },
});

export default ProfileImagePicker;
