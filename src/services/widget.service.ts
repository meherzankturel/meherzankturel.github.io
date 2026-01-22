import { NativeModules, Platform } from 'react-native';

/**
 * Widget Service - Manages data sharing between React Native app and iOS widgets
 * 
 * Communicates with native iOS widgets via App Groups (UserDefaults)
 * Updates widget timelines when data changes
 */

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

class WidgetService {
    private isAvailable: boolean = false;

    constructor() {
        // Check if native module is available (iOS only)
        this.isAvailable = Platform.OS === 'ios' && !!NativeModules.SharedGroupPreferences;

        if (!this.isAvailable) {
            console.log('Widget support not available - iOS native module required');
        }
    }

    /**
     * Update distance data for widget display
     */
    updateDistance(distance: number, yourCity: string, partnerCity: string): void {
        if (!this.isAvailable) return;

        try {
            const defaults = NativeModules.SharedGroupPreferences;

            defaults.setDouble('partner_distance', Math.round(distance * 10) / 10);
            defaults.setString('your_city', yourCity);
            defaults.setString('partner_city', partnerCity);
            defaults.setString('last_update', new Date().toISOString());

            this.reloadWidgets();

            console.log(`✅ Widget distance updated: ${distance}km`);
        } catch (error) {
            console.error('Failed to update widget distance:', error);
        }
    }

    /**
     * Update latest moments for widget display
     */
    updateMoments(yourMoment: MomentData | null, partnerMoment: MomentData | null): void {
        if (!this.isAvailable) return;

        try {
            const defaults = NativeModules.SharedGroupPreferences;

            if (yourMoment) {
                defaults.setObject('your_moment', {
                    photoUrl: yourMoment.photoUrl,
                    caption: yourMoment.caption || '',
                    timestamp: yourMoment.timestamp.toISOString(),
                });
            }

            if (partnerMoment) {
                defaults.setObject('partner_moment', {
                    photoUrl: partnerMoment.photoUrl,
                    caption: partnerMoment.caption || '',
                    timestamp: partnerMoment.timestamp.toISOString(),
                });
            }

            this.reloadWidgets();

            console.log('✅ Widget moments updated');
        } catch (error) {
            console.error('Failed to update widget moments:', error);
        }
    }

    /**
     * Configure SOS emergency call settings
     */
    configureSOS(config: SOSConfig): void {
        if (!this.isAvailable) return;

        try {
            const defaults = NativeModules.SharedGroupPreferences;

            defaults.setBool('sos_onetap_enabled', config.oneTapEnabled);
            defaults.setString('partner_name', config.partnerName);
            defaults.setString('partner_facetime', config.faceTimeEmail);
            defaults.setString('partner_phone', config.phoneNumber);

            this.reloadWidgets();

            console.log(`✅ SOS configured - One-tap: ${config.oneTapEnabled}`);
        } catch (error) {
            console.error('Failed to configure SOS:', error);
        }
    }

    /**
     * Update your profile data for widget display
     */
    updateYourProfile(name: string, avatarUrl?: string): void {
        if (!this.isAvailable) return;

        try {
            const defaults = NativeModules.SharedGroupPreferences;

            defaults.setString('your_name', name);
            if (avatarUrl) {
                defaults.setString('your_avatar', avatarUrl);
            }

            this.reloadWidgets();
        } catch (error) {
            console.error('Failed to update your profile:', error);
        }
    }

    /**
     * Update partner profile data for widget display
     */
    updatePartnerProfile(name: string, avatarUrl?: string): void {
        if (!this.isAvailable) return;

        try {
            const defaults = NativeModules.SharedGroupPreferences;

            defaults.setString('partner_name', name);
            if (avatarUrl) {
                defaults.setString('partner_avatar', avatarUrl);
            }

            this.reloadWidgets();
        } catch (error) {
            console.error('Failed to update partner profile:', error);
        }
    }

    /**
     * Clear all widget data (e.g., on logout)
     */
    clearWidgetData(): void {
        if (!this.isAvailable) return;

        try {
            const defaults = NativeModules.SharedGroupPreferences;

            defaults.removeObject('partner_distance');
            defaults.removeObject('your_city');
            defaults.removeObject('partner_city');
            defaults.removeObject('your_moment');
            defaults.removeObject('partner_moment');
            defaults.removeObject('your_name');
            defaults.removeObject('partner_name');
            defaults.removeObject('your_avatar');
            defaults.removeObject('partner_avatar');

            // Keep SOS config for safety

            this.reloadWidgets();

            console.log('✅ Widget data cleared');
        } catch (error) {
            console.error('Failed to clear widget data:', error);
        }
    }

    /**
     * Trigger widget timeline reload
     */
    private reloadWidgets(): void {
        if (!this.isAvailable) return;

        try {
            const defaults = NativeModules.SharedGroupPreferences;
            if (defaults.reloadAllWidgets) {
                defaults.reloadAllWidgets();
            }
        } catch (error) {
            console.error('Failed to reload widgets:', error);
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
