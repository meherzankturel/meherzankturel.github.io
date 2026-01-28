import { NativeModules, Platform } from 'react-native';

const { RNSnapKit } = NativeModules;

// Interface for User Data based on the graphQL query response
interface SnapUserData {
    displayName?: string;
    bitmoji?: {
        avatar?: string; // URL
        id?: string;
    };
}

// Interface for Login Result
interface LoginResult {
    accessToken: string;
}

class SnapKitService {
    /**
     * Login with Snapchat
     */
    static async login(): Promise<LoginResult> {
        if (!RNSnapKit) {
            throw new Error('Snap Kit native module not initialized');
        }

        try {
            // The native module returns a map/object with accessToken
            const result = await RNSnapKit.login();
            return result;
        } catch (error) {
            console.error('Snap Kit Login Error:', error);
            throw error;
        }
    }

    /**
     * Check if user is logged in
     */
    static async isLoggedIn(): Promise<boolean> {
        if (!RNSnapKit) return false;
        try {
            return await RNSnapKit.isLoggedIn();
        } catch (e) {
            console.warn('isLoggedIn check failed', e);
            return false;
        }
    }

    /**
     * Logout from Snapchat
     */
    static async logout(): Promise<boolean> {
        if (!RNSnapKit) return false;
        try {
            return await RNSnapKit.logout();
        } catch (e) {
            console.error('Logout error', e);
            return false;
        }
    }

    /**
     * Fetch User Data (DisplayName, Bitmoji) from Client Layer if needed
     * (Preferably use backend flow for security, but this is useful for quick UI)
     */
    static async fetchUserData(): Promise<SnapUserData | null> {
        if (!RNSnapKit) return null;
        try {
            // Native module should expose a method to fetch data if implemented
            // Android impl has fetchUserData, iOS impl also added it.
            const data = await RNSnapKit.fetchUserData();
            return data;
        } catch (e) {
            console.error('Fetch user data error', e);
            return null;
        }
    }
}

export default SnapKitService;
