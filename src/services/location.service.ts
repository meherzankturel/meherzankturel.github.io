import * as Location from 'expo-location';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface UserLocation {
    city: string;
    region?: string;
    country?: string;
    timezone: string;
    latitude: number;
    longitude: number;
    lastUpdated: Date;
}

export class LocationService {
    /**
     * Request location permissions from the user
     * @returns true if permission granted, false otherwise
     */
    static async requestPermissions(): Promise<boolean> {
        try {
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

            if (foregroundStatus !== 'granted') {
                console.log('Foreground location permission denied');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error requesting location permissions:', error);
            return false;
        }
    }

    /**
     * Check if location permissions are granted
     */
    static async hasPermissions(): Promise<boolean> {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            return status === 'granted';
        } catch (error) {
            console.error('Error checking location permissions:', error);
            return false;
        }
    }

    /**
     * Get current location and reverse geocode to get city name
     */
    static async getCurrentLocation(): Promise<UserLocation | null> {
        try {
            // Check permissions first
            const hasPermission = await this.hasPermissions();
            if (!hasPermission) {
                const granted = await this.requestPermissions();
                if (!granted) {
                    return null;
                }
            }

            // Get current position
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            // Reverse geocode to get city name
            const [address] = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            // Get timezone
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const userLocation: UserLocation = {
                city: address?.city || address?.subregion || 'Unknown',
                region: address?.region || undefined,
                country: address?.country || undefined,
                timezone,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                lastUpdated: new Date(),
            };

            return userLocation;
        } catch (error) {
            console.error('Error getting current location:', error);
            return null;
        }
    }

    /**
     * Update user's location in Firebase
     */
    static async updateUserLocation(userId: string): Promise<UserLocation | null> {
        try {
            const location = await this.getCurrentLocation();

            if (!location) {
                return null;
            }

            // Update user document in Firebase
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                city: location.city,
                region: location.region,
                country: location.country,
                timezone: location.timezone,
                latitude: location.latitude,
                longitude: location.longitude,
                locationUpdatedAt: location.lastUpdated,
            });

            return location;
        } catch (error) {
            console.error('Error updating user location:', error);
            return null;
        }
    }

    /**
     * Get time in a specific timezone
     */
    static getTimeInTimezone(timezone: string): Date {
        try {
            const now = new Date();
            const options: Intl.DateTimeFormatOptions = {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            };

            const formatter = new Intl.DateTimeFormat('en-US', options);
            const parts = formatter.formatToParts(now);

            const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

            return new Date(
                parseInt(getPart('year')),
                parseInt(getPart('month')) - 1,
                parseInt(getPart('day')),
                parseInt(getPart('hour')),
                parseInt(getPart('minute')),
                parseInt(getPart('second'))
            );
        } catch (error) {
            console.error('Error getting time in timezone:', error);
            return new Date();
        }
    }

    /**
     * Format time for display
     */
    static formatTime(date: Date): string {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        const paddedMinutes = minutes.toString().padStart(2, '0');

        return `${hour12}:${paddedMinutes} ${ampm}`;
    }

    /**
     * Check if it's day or night in a timezone (for icon display)
     */
    static isDaytime(timezone: string): boolean {
        const time = this.getTimeInTimezone(timezone);
        const hour = time.getHours();
        return hour >= 6 && hour < 20; // 6 AM to 8 PM is daytime
    }

    /**
     * Calculate distance between two coordinates in kilometers
     */
    static calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Start monitoring location changes
     * @param userId User ID to update
     * @param previousLocation Previous location to compare against
     * @param onLocationChange Callback when significant location change detected (>1km)
     * @returns Unsubscribe function
     */
    static async startLocationMonitoring(
        userId: string,
        previousLocation: { latitude: number; longitude: number } | null,
        onLocationChange: (newLocation: UserLocation) => void
    ): Promise<(() => void) | null> {
        try {
            const hasPermission = await this.hasPermissions();
            if (!hasPermission) return null;

            // Watch position with sensitivity threshold
            const subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 60000, // Check every minute
                    distanceInterval: 1000, // Or when moved 1km
                },
                async (location) => {
                    // If we have previous location, check distance
                    if (previousLocation) {
                        const distance = this.calculateDistance(
                            previousLocation.latitude,
                            previousLocation.longitude,
                            location.coords.latitude,
                            location.coords.longitude
                        );

                        // Only update if moved more than 1km
                        if (distance < 1) return;
                    }

                    // Significant location change detected - update
                    const newLocation = await this.updateUserLocation(userId);
                    if (newLocation) {
                        onLocationChange(newLocation);
                    }
                }
            );

            return () => subscription.remove();
        } catch (error) {
            console.error('Error starting location monitoring:', error);
            return null;
        }
    }
}
