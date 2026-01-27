import { MONGODB_API_BASE_URL, API_ENDPOINTS } from '../config/mongodb';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    profileImage?: string;
    partnerId?: string;
}

export class ProfileService {
    /**
     * Pick image from gallery for profile
     */
    static async pickProfileImage(): Promise<string | null> {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                console.log('Media library permission denied');
                return null;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1], // Square for profile
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                return result.assets[0].uri;
            }
            return null;
        } catch (error) {
            console.error('Error picking profile image:', error);
            return null;
        }
    }

    /**
     * Take photo with camera for profile
     */
    static async takeProfilePhoto(): Promise<string | null> {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                console.log('Camera permission denied');
                return null;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                return result.assets[0].uri;
            }
            return null;
        } catch (error) {
            console.error('Error taking profile photo:', error);
            return null;
        }
    }

    /**
     * Upload profile image to MongoDB and update Firebase
     */
    static async uploadProfileImage(
        userId: string,
        imageUri: string
    ): Promise<string | null> {
        try {
            const formData = new FormData();

            // Prepare file
            const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `profile_${userId}_${Date.now()}.${fileExtension}`;

            let mimeType = 'image/jpeg';
            if (fileExtension === 'png') mimeType = 'image/png';
            else if (fileExtension === 'heic' || fileExtension === 'heif') mimeType = 'image/heic';

            formData.append('files', {
                uri: imageUri,
                type: mimeType,
                name: fileName,
            } as any);

            const uploadUrl = `${MONGODB_API_BASE_URL}${API_ENDPOINTS.MEDIA.UPLOAD_MULTIPLE}`;
            console.log('📤 Uploading profile image to:', uploadUrl);
            console.log('📤 File name:', fileName, 'MIME:', mimeType);

            // Upload to MongoDB backend using the media upload endpoint
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
            });

            console.log('📥 Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.log('❌ Error response body:', errorText);
                throw new Error(`Upload failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Upload response data:', JSON.stringify(data));

            // Media upload returns urls array, get the first one
            const imageUrl = data.urls?.[0] || data.url;
            console.log('✅ Image URL:', imageUrl);

            console.log('✅ Profile image uploaded:', imageUrl);

            // Update Firebase with the new profile image URL
            await this.updateFirebaseProfile(userId, imageUrl);

            return imageUrl;
        } catch (error) {
            console.error('Error uploading profile image:', error);

            // Fallback: If MongoDB upload fails, try to use the media upload endpoint
            try {
                return await this.uploadViaMediaEndpoint(userId, imageUri);
            } catch (fallbackError) {
                console.error('Fallback upload also failed:', fallbackError);
                return null;
            }
        }
    }

    /**
     * Fallback upload via existing media endpoint
     */
    private static async uploadViaMediaEndpoint(
        userId: string,
        imageUri: string
    ): Promise<string | null> {
        try {
            const formData = new FormData();
            const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `profile_${userId}_${Date.now()}.${fileExtension}`;

            let mimeType = 'image/jpeg';
            if (fileExtension === 'png') mimeType = 'image/png';

            formData.append('files', {
                uri: imageUri,
                type: mimeType,
                name: fileName,
            } as any);

            const response = await fetch(`${MONGODB_API_BASE_URL}${API_ENDPOINTS.MEDIA.UPLOAD_MULTIPLE}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            const data = await response.json();
            const imageUrl = data.urls?.[0] || data.data?.urls?.[0];

            if (imageUrl) {
                await this.updateFirebaseProfile(userId, imageUrl);
                return imageUrl;
            }

            return null;
        } catch (error) {
            console.error('Media endpoint upload failed:', error);
            return null;
        }
    }

    /**
     * Update Firebase user document with profile image
     */
    static async updateFirebaseProfile(userId: string, imageUrl: string): Promise<void> {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                profileImage: imageUrl,
                profileImageUpdatedAt: new Date(),
            });
            console.log('✅ Firebase profile updated');
        } catch (error) {
            console.error('Failed to update Firebase profile:', error);
        }
    }

    /**
     * Delete profile image
     */
    static async deleteProfileImage(userId: string): Promise<boolean> {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                profileImage: null,
                profileImageUpdatedAt: new Date(),
            });
            console.log('✅ Profile image removed');
            return true;
        } catch (error) {
            console.error('Failed to delete profile image:', error);
            return false;
        }
    }
}
