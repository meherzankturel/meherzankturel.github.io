import React, { useState } from 'react';
import {
    Modal,
    View,
    Image,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    ActivityIndicator,
    Alert,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { MomentService } from '../services/moment.service';

const { width, height } = Dimensions.get('window');

interface PhotoViewerModalProps {
    visible: boolean;
    photoUrl: string;
    caption?: string;
    momentId?: string;
    isOwnPhoto?: boolean;
    userId?: string;
    onClose: () => void;
    onCaptionUpdated?: (newCaption: string) => void;
    onReplacePhoto?: () => void;
}

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
    visible,
    photoUrl,
    caption,
    momentId,
    isOwnPhoto = false,
    userId,
    onClose,
    onCaptionUpdated,
    onReplacePhoto,
}) => {
    const [downloading, setDownloading] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editCaption, setEditCaption] = useState(caption || '');
    const [saving, setSaving] = useState(false);

    const handleDownload = async () => {
        try {
            setDownloading(true);

            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant photo library permission to save images.');
                setDownloading(false);
                return;
            }

            console.log(`📥 Downloading image from: ${photoUrl}`);

            const response = await fetch(photoUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
            }

            const blob = await response.blob();

            const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    const base64 = result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            const filename = `moment_${Date.now()}.jpg`;
            const cacheDir = FileSystem.cacheDirectory;
            if (!cacheDir) {
                throw new Error('Cache directory not available');
            }
            const filePath = `${cacheDir}${filename}`;

            await FileSystem.writeAsStringAsync(filePath, base64Data, {
                encoding: FileSystem.EncodingType.Base64,
            });

            const asset = await MediaLibrary.createAssetAsync(filePath);

            try {
                await MediaLibrary.createAlbumAsync('SYNC Moments', asset, false);
            } catch (albumError) {
                console.log('Could not create album, but asset saved');
            }

            try {
                await FileSystem.deleteAsync(filePath, { idempotent: true });
            } catch (e) { }

            Alert.alert('Success', 'Photo saved to your gallery!');
        } catch (error: any) {
            console.error('Download error:', error);
            Alert.alert('Error', `Failed to save photo: ${error.message || 'Unknown error'}`);
        } finally {
            setDownloading(false);
        }
    };

    const handleEditCaption = () => {
        setEditCaption(caption || '');
        setEditing(true);
    };

    const handleSaveCaption = async () => {
        if (!momentId || !userId) {
            Alert.alert('Error', 'Cannot save caption');
            return;
        }

        setSaving(true);
        try {
            const success = await MomentService.updateCaption(momentId, userId, editCaption.trim());
            if (success) {
                Alert.alert('Success', 'Caption updated!');
                setEditing(false);
                onCaptionUpdated?.(editCaption.trim());
            } else {
                Alert.alert('Error', 'Failed to update caption');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to update caption');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditCaption(caption || '');
        setEditing(false);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <TouchableOpacity
                    style={styles.overlay}
                    activeOpacity={1}
                    onPress={!editing ? onClose : undefined}
                />

                <View style={styles.imageContainer}>
                    {imageLoading && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#00D4FF" />
                        </View>
                    )}
                    <Image
                        source={{ uri: photoUrl }}
                        style={styles.image}
                        resizeMode="contain"
                        onLoadStart={() => setImageLoading(true)}
                        onLoadEnd={() => setImageLoading(false)}
                    />

                    {/* Caption overlay or edit input */}
                    {editing ? (
                        <View style={styles.editContainer}>
                            <TextInput
                                style={styles.captionInput}
                                value={editCaption}
                                onChangeText={setEditCaption}
                                placeholder="Enter caption..."
                                placeholderTextColor="#999"
                                multiline
                                maxLength={200}
                                autoFocus
                            />
                            <View style={styles.editButtons}>
                                <TouchableOpacity
                                    style={styles.editButton}
                                    onPress={handleCancelEdit}
                                    disabled={saving}
                                >
                                    <Text style={styles.editButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.editButton, styles.saveButton]}
                                    onPress={handleSaveCaption}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text style={[styles.editButtonText, styles.saveButtonText]}>Save</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        caption && (
                            <TouchableOpacity
                                style={styles.captionContainer}
                                onPress={isOwnPhoto ? handleEditCaption : undefined}
                                activeOpacity={isOwnPhoto ? 0.7 : 1}
                            >
                                <Text style={styles.captionText}>{caption}</Text>
                                {isOwnPhoto && (
                                    <Ionicons name="pencil" size={16} color="#FFF" style={{ marginLeft: 8 }} />
                                )}
                            </TouchableOpacity>
                        )
                    )}
                </View>

                {/* Action buttons */}
                {!editing && (
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={handleDownload}
                            disabled={downloading}
                        >
                            {downloading ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <Ionicons name="download-outline" size={22} color="#FFF" />
                            )}
                        </TouchableOpacity>

                        {isOwnPhoto && (
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={handleEditCaption}
                            >
                                <Ionicons name="text-outline" size={22} color="#FFF" />
                            </TouchableOpacity>
                        )}

                        {isOwnPhoto && onReplacePhoto && (
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => {
                                    onClose();
                                    onReplacePhoto();
                                }}
                            >
                                <Ionicons name="camera-outline" size={22} color="#FFF" />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={onClose}
                            disabled={downloading}
                        >
                            <Ionicons name="close" size={22} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    imageContainer: {
        width: width * 0.95,
        height: height * 0.65,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    captionContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    captionText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    editContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        padding: 16,
    },
    captionInput: {
        backgroundColor: '#333',
        color: '#FFF',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        minHeight: 60,
        maxHeight: 100,
    },
    editButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 12,
        gap: 12,
    },
    editButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: '#555',
    },
    saveButton: {
        backgroundColor: '#00D4FF',
    },
    editButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    saveButtonText: {
        color: '#FFF',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginTop: 30,
    },
    iconButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default PhotoViewerModal;
