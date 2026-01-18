import * as ImagePicker from 'expo-image-picker';
import { MONGODB_API_BASE_URL, API_ENDPOINTS } from '../config/mongodb';

export interface DailyMoment {
    id?: string; // MongoDB document ID for editing
    date: string; // Format: YYYY-MM-DD
    userId: string;
    photoUrl: string;
    caption?: string;
    uploadedAt: Date;
}

export interface CoupleMoment {
    id: string;
    date: string;
    user1Photo?: DailyMoment;
    user2Photo?: DailyMoment;
    createdAt: Date;
}

export class MomentService {
    /**
     * Request camera/photo library permissions
     */
    static async requestPermissions(): Promise<boolean> {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        return cameraStatus === 'granted' && libraryStatus === 'granted';
    }

    /**
     * Pick an image from library
     * Supports high-resolution and Live Photos
     */
    static async pickImage(): Promise<string | null> {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 1.0, // High quality (was 0.8)
                // Live Photos are supported automatically on iOS
            });

            if (!result.canceled && result.assets[0]) {
                return result.assets[0].uri;
            }
            return null;
        } catch (error) {
            console.error('Error picking image:', error);
            return null;
        }
    }

    /**
     * Take a photo with camera
     * Supports high-resolution
     */
    static async takePhoto(): Promise<string | null> {
        try {
            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 1.0, // High quality (was 0.8)
            });

            if (!result.canceled && result.assets[0]) {
                return result.assets[0].uri;
            }
            return null;
        } catch (error) {
            console.error('Error taking photo:', error);
            return null;
        }
    }

    /**
     * Upload image to MongoDB via backend API
     */
    static async uploadImage(
        uri: string,
        userId: string,
        partnerId: string,
        caption?: string
    ): Promise<string | null> {
        try {
            const date = this.getTodayDate();
            const pairId = this.getMomentPairId(userId, partnerId);

            // Prepare form data
            const formData = new FormData();

            // Extract file extension from URI
            const fileExtension = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `moment_${userId}_${date}.${fileExtension}`;

            // Determine MIME type (support HEIC for Live Photos)
            let mimeType = 'image/jpeg';
            if (fileExtension === 'png') mimeType = 'image/png';
            else if (fileExtension === 'heic' || fileExtension === 'heif') mimeType = 'image/heic';
            else if (fileExtension === 'gif') mimeType = 'image/gif';

            // Add file to FormData
            formData.append('file', {
                uri,
                type: mimeType,
                name: fileName,
            } as any);

            // Add metadata
            formData.append('userId', userId);
            formData.append('pairId', pairId);
            formData.append('momentDate', date);
            if (caption) {
                formData.append('caption', caption);
            }

            console.log(`📤 Uploading moment to MongoDB...`);

            // Upload to backend
            const response = await fetch(`${MONGODB_API_BASE_URL}${API_ENDPOINTS.MOMENTS.UPLOAD}`, {
                method: 'POST',
                body: formData,
                headers: {
                    // Don't set Content-Type - let browser set with boundary
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(errorData.error || `Upload failed: ${response.status}`);
            }

            const data = await response.json();
            console.log(`✅ Moment uploaded successfully`);

            return data.url;
        } catch (error) {
            console.error('Error uploading image:', error);
            return null;
        }
    }

    /**
     * Get today's date string (YYYY-MM-DD)
     */
    static getTodayDate(): string {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }

    /**
     * Get the moment pair ID for a couple (consistent ordering)
     */
    static getMomentPairId(user1Id: string, user2Id: string): string {
        const [id1, id2] = [user1Id, user2Id].sort();
        return `${id1}_${id2}`;
    }

    /**
     * Upload/update today's moment
     */
    static async uploadMoment(
        userId: string,
        partnerId: string,
        imageUri: string,
        caption?: string
    ): Promise<boolean> {
        try {
            const photoUrl = await this.uploadImage(imageUri, userId, partnerId, caption);
            return !!photoUrl;
        } catch (error) {
            console.error('Error uploading moment:', error);
            return false;
        }
    }

    /**
     * Get today's moment for a couple from MongoDB
     */
    static async getTodayMoment(userId: string, partnerId: string): Promise<CoupleMoment | null> {
        try {
            const response = await fetch(
                `${MONGODB_API_BASE_URL}${API_ENDPOINTS.MOMENTS.GET_TODAY(userId, partnerId)}`
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch moment: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                return null;
            }

            // Convert API response to CoupleMoment format
            const coupleMoment: CoupleMoment = {
                id: data.pairId,
                date: data.date,
                createdAt: new Date(),
            };

            if (data.userMoment) {
                const moment: DailyMoment = {
                    id: data.userMoment.id,
                    date: data.date,
                    userId: data.userMoment.userId,
                    photoUrl: data.userMoment.url,
                    caption: data.userMoment.caption,
                    uploadedAt: new Date(data.userMoment.uploadedAt),
                };

                // Assign to correct position based on userId
                if (data.userMoment.userId === userId) {
                    coupleMoment.user1Photo = moment;
                } else {
                    coupleMoment.user2Photo = moment;
                }
            }

            if (data.partnerMoment) {
                const moment: DailyMoment = {
                    id: data.partnerMoment.id,
                    date: data.date,
                    userId: data.partnerMoment.userId,
                    photoUrl: data.partnerMoment.url,
                    caption: data.partnerMoment.caption,
                    uploadedAt: new Date(data.partnerMoment.uploadedAt),
                };

                // Assign to correct position based on userId
                if (data.partnerMoment.userId === userId) {
                    coupleMoment.user1Photo = moment;
                } else {
                    coupleMoment.user2Photo = moment;
                }
            }

            return coupleMoment;
        } catch (error) {
            console.error('Error getting moment:', error);
            return null;
        }
    }

    /**
     * Listen to today's moment in real-time
     * Note: For MongoDB, we use polling instead of real-time listeners
     */
    static listenToTodayMoment(
        userId: string,
        partnerId: string,
        callback: (moment: CoupleMoment | null) => void
    ): () => void {
        // Poll every 10 seconds for updates
        const pollInterval = setInterval(async () => {
            const moment = await this.getTodayMoment(userId, partnerId);
            callback(moment);
        }, 10000);

        // Initial fetch
        this.getTodayMoment(userId, partnerId).then(callback);

        // Return cleanup function
        return () => clearInterval(pollInterval);
    }

    /**
     * Get user's photo from couple moment
     */
    static getUserPhoto(moment: CoupleMoment | null, userId: string): DailyMoment | null {
        if (!moment) return null;

        if (moment.user1Photo?.userId === userId) {
            return moment.user1Photo;
        }
        if (moment.user2Photo?.userId === userId) {
            return moment.user2Photo;
        }
        return null;
    }

    /**
     * Get partner's photo from couple moment
     */
    static getPartnerPhoto(moment: CoupleMoment | null, userId: string): DailyMoment | null {
        if (!moment) return null;

        if (moment.user1Photo?.userId !== userId && moment.user1Photo) {
            return moment.user1Photo;
        }
        if (moment.user2Photo?.userId !== userId && moment.user2Photo) {
            return moment.user2Photo;
        }
        return null;
    }

    /**
     * Update caption of a moment
     */
    static async updateCaption(
        momentId: string,
        userId: string,
        caption: string
    ): Promise<boolean> {
        try {
            const response = await fetch(
                `${MONGODB_API_BASE_URL}${API_ENDPOINTS.MOMENTS.UPDATE_CAPTION(momentId)}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ userId, caption }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update caption');
            }

            console.log('✅ Caption updated successfully');
            return true;
        } catch (error) {
            console.error('Error updating caption:', error);
            return false;
        }
    }
}
