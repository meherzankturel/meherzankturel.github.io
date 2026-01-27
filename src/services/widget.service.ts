import { Platform } from 'react-native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

/**
 * Widget Service - Manages data sharing between React Native app and iOS widgets
 * 
 * Communicates with native iOS widgets via App Groups (UserDefaults)
 * Updates widget timelines when data changes
 */

// App Group identifier - must match the one in Xcode entitlements
const APP_GROUP = 'group.com.sync.app';

interface MomentData {
    photoUrl: string;
    caption?: string;
    timestamp: Date;
}

interface SOSConfig {
    oneTapEnabled: boolean;
    partnerName: string;
    faceTimeEmail: string;
    phoneNumber: string;
}

interface LocationData {
    latitude: number;
    longitude: number;
}

class WidgetService {
    private isAvailable: boolean = false;

    constructor() {
        // Only available on iOS and when native module is properly linked
        this.isAvailable = Platform.OS === 'ios' && SharedGroupPreferences != null;

        if (!this.isAvailable) {
            console.log('Widget support not available - iOS only or native module not linked');
        }
    }

    /**
     * Safe wrapper for SharedGroupPreferences.setItem
     */
    private async safeSetItem(key: string, value: string): Promise<boolean> {
        if (!SharedGroupPreferences?.setItem) {
            console.warn('SharedGroupPreferences.setItem not available');
            return false;
        }
        try {
            await SharedGroupPreferences.setItem(key, value, APP_GROUP);
            return true;
        } catch (error) {
            console.warn(`Failed to set widget item ${key}:`, error);
            return false;
        }
    }

    /**
     * Update distance data for widget display
     */
    async updateDistance(distance: number, yourCity: string, partnerCity: string): Promise<void> {
        if (!this.isAvailable) return;

        try {
            // Store data as a JSON object for easier reading on the Swift side
            const widgetData = {
                partner_distance: Math.round(distance * 10) / 10,
                your_city: yourCity,
                partner_city: partnerCity,
                last_update: new Date().toISOString(),
            };

            await this.safeSetItem('widgetData', JSON.stringify(widgetData));

            // Also store individual keys for simpler Swift access
            await this.safeSetItem('partner_distance', String(Math.round(distance * 10) / 10));
            await this.safeSetItem('your_city', yourCity);
            await this.safeSetItem('partner_city', partnerCity);
            await this.safeSetItem('last_update', new Date().toISOString());

            console.log(`✅ Widget distance updated: ${Math.round(distance)}km (${yourCity} ↔ ${partnerCity})`);
        } catch (error) {
            console.error('Failed to update widget distance:', error);
        }
    }

    /**
     * Update mood data for widget display
     */
    async updateMood(yourMood: string | null, partnerMood: string | null): Promise<void> {
        if (!this.isAvailable) return;

        try {
            if (yourMood) {
                await this.safeSetItem('your_mood', yourMood);
            }
            if (partnerMood) {
                await this.safeSetItem('partner_mood', partnerMood);
            }
            console.log(`✅ Widget moods updated: You: "${yourMood}" Partner: "${partnerMood}"`);
        } catch (error) {
            console.error('Failed to update widget moods:', error);
        }
    }

    /**
     * Update location coordinates for map widget
     */
    async updateLocations(yourLocation: LocationData | null, partnerLocation: LocationData | null): Promise<void> {
        if (!this.isAvailable) return;

        try {
            if (yourLocation) {
                await this.safeSetItem('your_latitude', String(yourLocation.latitude));
                await this.safeSetItem('your_longitude', String(yourLocation.longitude));
            }
            if (partnerLocation) {
                await this.safeSetItem('partner_latitude', String(partnerLocation.latitude));
                await this.safeSetItem('partner_longitude', String(partnerLocation.longitude));
            }
            console.log('✅ Widget locations updated');
        } catch (error) {
            console.error('Failed to update widget locations:', error);
        }
    }

    /**
     * Update latest moments for widget display
     */
    async updateMoments(yourMoment: MomentData | null, partnerMoment: MomentData | null): Promise<void> {
        if (!this.isAvailable) return;

        try {
            if (yourMoment) {
                const momentData = {
                    photoUrl: yourMoment.photoUrl,
                    caption: yourMoment.caption || '',
                    timestamp: yourMoment.timestamp.toISOString(),
                };
                await this.safeSetItem('your_moment', JSON.stringify(momentData));
            }

            if (partnerMoment) {
                const momentData = {
                    photoUrl: partnerMoment.photoUrl,
                    caption: partnerMoment.caption || '',
                    timestamp: partnerMoment.timestamp.toISOString(),
                };
                await this.safeSetItem('partner_moment', JSON.stringify(momentData));
            }

            console.log('✅ Widget moments updated');
        } catch (error) {
            console.error('Failed to update widget moments:', error);
        }
    }

    /**
     * Configure SOS emergency call settings
     */
    async configureSOS(config: SOSConfig): Promise<void> {
        if (!this.isAvailable) return;

        try {
            const sosData = {
                oneTapEnabled: config.oneTapEnabled,
                partnerName: config.partnerName,
                faceTimeEmail: config.faceTimeEmail,
                phoneNumber: config.phoneNumber,
            };
            await this.safeSetItem('sos_config', JSON.stringify(sosData));

            console.log(`✅ SOS configured - One-tap: ${config.oneTapEnabled}`);
        } catch (error) {
            console.error('Failed to configure SOS:', error);
        }
    }

    /**
     * Update your profile data for widget display
     */
    async updateYourProfile(name: string, avatarUrl?: string): Promise<void> {
        if (!this.isAvailable) return;

        try {
            await this.safeSetItem('your_name', name);
            if (avatarUrl) {
                await this.safeSetItem('your_avatar', avatarUrl);
            }
            console.log(`✅ Your profile updated for widget: ${name}`);
        } catch (error) {
            console.error('Failed to update your profile:', error);
        }
    }

    /**
     * Update partner profile data for widget display
     */
    async updatePartnerProfile(name: string, avatarUrl?: string): Promise<void> {
        if (!this.isAvailable) return;

        try {
            await this.safeSetItem('partner_name', name);
            if (avatarUrl) {
                await this.safeSetItem('partner_avatar', avatarUrl);
            }
            console.log(`✅ Partner profile updated for widget: ${name}`);
        } catch (error) {
            console.error('Failed to update partner profile:', error);
        }
    }

    /**
     * Clear all widget data (e.g., on logout)
     */
    async clearWidgetData(): Promise<void> {
        if (!this.isAvailable) return;

        try {
            const keysToRemove = [
                'widgetData',
                'partner_distance',
                'your_city',
                'partner_city',
                'your_moment',
                'partner_moment',
                'your_name',
                'partner_name',
                'your_avatar',
                'partner_avatar',
                'your_mood',
                'partner_mood',
                'your_latitude',
                'your_longitude',
                'partner_latitude',
                'partner_longitude',
                'last_update',
            ];

            for (const key of keysToRemove) {
                await this.safeSetItem(key, '');
            }

            // Keep SOS config for safety

            console.log('✅ Widget data cleared');
        } catch (error) {
            console.error('Failed to clear widget data:', error);
        }
    }

    /**
     * Check if widgets are supported on this device
     */
    isSupported(): boolean {
        return this.isAvailable;
    }
}

export default new WidgetService();
