import * as ImagePicker from 'expo-image-picker';
import { API_ENDPOINTS, apiRequest } from '../config/mongodb';

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

            // Use XMLHttpRequest for better FormData support in React Native
            const { MONGODB_API_BASE_URL } = require('../config/mongodb');
            const { auth } = require('../config/firebase');
            
            if (!MONGODB_API_BASE_URL) {
                throw new Error('MongoDB API base URL is not configured. Please start the backend server or set EXPO_PUBLIC_MONGODB_API_URL');
            }

            const url = `${MONGODB_API_BASE_URL}${API_ENDPOINTS.MOMENTS.UPLOAD}`;
            let token = await auth.currentUser?.getIdToken();

            if (!token) {
                let attempts = 0;
                while (!auth.currentUser && attempts < 20) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                token = await auth.currentUser?.getIdToken();
            }

            return new Promise<string>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const progress = (event.loaded / event.total) * 100;
                        console.log(`📤 Upload progress: ${Math.round(progress)}%`);
                    }
                };

                xhr.onload = () => {
                    console.log(`📥 Upload response: ${xhr.status} ${xhr.statusText}`);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            if (response.url) {
                                console.log(`✅ Moment uploaded successfully`);
                                resolve(response.url);
                            } else {
                                reject(new Error('Server did not return a URL'));
                            }
                        } catch (error) {
                            console.error('❌ Failed to parse upload response:', xhr.responseText);
                            reject(new Error('Failed to parse upload response'));
                        }
                    } else {
                        try {
                            const errorResponse = JSON.parse(xhr.responseText);
                            const errorMsg = errorResponse.error || `Upload failed: ${xhr.status} ${xhr.statusText}`;
                            reject(new Error(errorMsg));
                        } catch {
                            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}. Make sure the backend server is running.`));
                        }
                    }
                };

                xhr.onerror = () => {
                    let errorMsg = 'Cannot connect to backend server. ';
                    if (MONGODB_API_BASE_URL.includes('localhost') || MONGODB_API_BASE_URL.includes('127.0.0.1')) {
                        errorMsg += 'If testing on a physical device, update src/config/mongodb.ts to use your computer\'s IP address. ';
                    }
                    errorMsg += 'Make sure: 1) Backend is running (run: cd backend && npm run dev), 2) Phone and computer are on the same Wi-Fi network.';
                    reject(new Error(errorMsg));
                };

                xhr.ontimeout = () => {
                    reject(new Error('Upload timeout. The file may be too large or the server is slow.'));
                };

                xhr.open('POST', url);
                xhr.timeout = 300000; // 5 minutes timeout

                if (token) {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                }

                xhr.send(formData as any);
            });
        } catch (error: any) {
            const errorMessage = error?.message || 'Unknown error';
            console.error('Error uploading image:', error);
            
            // Re-throw network errors with more context
            if (errorMessage.includes('Network request failed') || errorMessage.includes('Network')) {
                throw new Error(`Network request failed: ${errorMessage}`);
            }
            
            // Re-throw other errors
            throw error;
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
        } catch (error: any) {
            console.error('Error uploading moment:', error);
            // Re-throw to let caller handle with better error messages
            throw error;
        }
    }

    /**
     * Get today's moment for a couple from MongoDB
     */
    static async getTodayMoment(userId: string, partnerId: string): Promise<CoupleMoment | null> {
        try {
            const data = await apiRequest<any>(
                API_ENDPOINTS.MOMENTS.GET_TODAY(userId, partnerId)
            );

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
        } catch (error: any) {
            // Don't log network errors here - they're handled in listenToTodayMoment
            // Only log unexpected errors
            const errorMessage = error?.message || 'Unknown error';
            if (!errorMessage.includes('Network request failed')) {
                console.error('Error getting moment:', error);
            }
            throw error; // Re-throw to let caller handle it
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
        let pollInterval: NodeJS.Timeout | null = null;
        let consecutiveErrors = 0;
        let lastErrorLogTime = 0;
        const ERROR_LOG_THROTTLE = 30000; // Only log errors every 30 seconds
        const BASE_POLL_INTERVAL = 10000; // 10 seconds
        const MAX_POLL_INTERVAL = 60000; // Max 60 seconds
        let currentPollInterval = BASE_POLL_INTERVAL;
        let isPolling = true;

        const poll = async () => {
            if (!isPolling) return;

            try {
                const moment = await this.getTodayMoment(userId, partnerId);
                // Reset on success
                consecutiveErrors = 0;
                currentPollInterval = BASE_POLL_INTERVAL;
                callback(moment);
            } catch (error: any) {
                consecutiveErrors++;
                
                // Exponential backoff: increase interval on consecutive errors
                if (consecutiveErrors > 1) {
                    currentPollInterval = Math.min(
                        BASE_POLL_INTERVAL * Math.pow(2, consecutiveErrors - 1),
                        MAX_POLL_INTERVAL
                    );
                }

                // Throttle error logging to prevent spam
                const now = Date.now();
                if (now - lastErrorLogTime > ERROR_LOG_THROTTLE) {
                    const errorMessage = error?.message || 'Unknown error';
                    if (errorMessage.includes('Network request failed')) {
                        // Only log network errors occasionally
                        if (__DEV__) {
                            console.warn(`⚠️ Network error fetching moment (attempt ${consecutiveErrors}). Backend may be offline. Polling interval increased to ${currentPollInterval}ms.`);
                        }
                    } else {
                        console.error('Error getting moment:', error);
                    }
                    lastErrorLogTime = now;
                }

                // Still call callback with null on error to prevent UI blocking
                callback(null);
            }

            // Schedule next poll with current interval
            if (isPolling) {
                pollInterval = setTimeout(poll, currentPollInterval);
            }
        };

        // Initial fetch
        this.getTodayMoment(userId, partnerId)
            .then((moment) => {
                callback(moment);
                // Start polling after initial fetch
                pollInterval = setTimeout(poll, currentPollInterval);
            })
            .catch((error) => {
                // Handle initial fetch error silently
                callback(null);
                // Start polling anyway
                pollInterval = setTimeout(poll, currentPollInterval);
            });

        // Return cleanup function
        return () => {
            isPolling = false;
            if (pollInterval) {
                clearTimeout(pollInterval);
            }
        };
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
            await apiRequest<any>(
                API_ENDPOINTS.MOMENTS.UPDATE_CAPTION(momentId),
                {
                    method: 'PATCH',
                    body: JSON.stringify({ userId, caption }),
                }
            );

            console.log('✅ Caption updated successfully');
            return true;
        } catch (error) {
            console.error('Error updating caption:', error);
            return false;
        }
    }
}
