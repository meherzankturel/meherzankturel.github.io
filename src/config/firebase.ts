/**
 * FIREBASE CONFIGURATION
 * 
 * This file exports Firebase services with proper initialization for React Native/Expo.
 * 
 * IMPORTANT: For React Native, Firebase Auth requires initializeAuth with AsyncStorage.
 * Make sure @react-native-async-storage/async-storage is installed:
 *   npx expo install @react-native-async-storage/async-storage
 * 
 * To update your Firebase config:
 * 1. Go to https://console.firebase.google.com/
 * 2. Select your project
 * 3. Click the gear icon ⚙️ → Project settings
 * 4. Scroll to "Your apps" section
 * 5. Click the Web icon </> (or "Add app" → Web)
 * 6. Copy the config values and update firebaseConfig below
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { initializeAuth, Auth, getAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getFunctions, Functions } from "firebase/functions";
import { getStorage, FirebaseStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
    apiKey: "AIzaSyAfR51brr6nhQcxoVAkGQsbo0ZHPzEpsUU",
    authDomain: "boundless-d2a20.firebaseapp.com",
    projectId: "boundless-d2a20",
    storageBucket: "boundless-d2a20.firebasestorage.app",
    messagingSenderId: "138504465804",
    appId: "1:138504465804:web:67b2f177e3d92c87ab3aa9",
    measurementId: "G-PS6RKY49FB"
};

// Initialize Firebase app (only if not already initialized)
let app: FirebaseApp;
try {
    app = getApps().length === 0
        ? initializeApp(firebaseConfig)
        : getApps()[0];
} catch (error) {
    console.error("Failed to initialize Firebase app:", error);
    throw error;
}

// Store service instances
let _auth: Auth | undefined;
let _db: Firestore | undefined;
let _functions: Functions | undefined;
let _storage: FirebaseStorage | undefined;

// Initialize Auth for React Native
// With metro.config.js fix, initializeAuth should work properly
export const auth: Auth = (() => {
    if (!_auth) {
        try {
            // Try to get existing auth instance first
            try {
                _auth = getAuth(app);
                // If getAuth works, auth was already initialized
            } catch (getAuthError: any) {
                // If getAuth fails with "not been registered", initialize it
                if (getAuthError.message?.includes("not been registered")) {
                    // Initialize auth with AsyncStorage persistence for React Native
                    _auth = initializeAuth(app, {
                        persistence: getReactNativePersistence(AsyncStorage),
                    });
                } else {
                    // Some other error - rethrow it
                    throw getAuthError;
                }
            }
        } catch (error: any) {
            console.error("Firebase Auth initialization failed:", error);
            throw new Error(
                `Firebase Auth initialization failed: ${error.message}\n\n` +
                "SOLUTION:\n" +
                "1. Make sure metro.config.js is in the project root\n" +
                "2. Stop the app (Ctrl+C in terminal)\n" +
                "3. Run: rm -rf .expo && npm install && npm start\n" +
                "4. Reload the app on your device"
            );
        }
    }
    return _auth;
})();

export const db: Firestore = (() => {
    if (!_db) {
        try {
            _db = getFirestore(app);
        } catch (error: any) {
            console.error("Firestore initialization failed:", error);
            throw error;
        }
    }
    return _db;
})();

export const functions: Functions = (() => {
    if (!_functions) {
        try {
            _functions = getFunctions(app);
        } catch (error: any) {
            console.error("Functions initialization failed:", error);
            throw error;
        }
    }
    return _functions;
})();

export const storage: FirebaseStorage = (() => {
    if (!_storage) {
        try {
            _storage = getStorage(app);
            // Increase retry times for large file uploads on potentially slow connections
            _storage.maxUploadRetryTime = 600000; // 10 minutes (default)
            _storage.maxOperationRetryTime = 300000; // 5 minutes
        } catch (error: any) {
            console.error("Firebase Storage initialization failed:", error);
            throw error;
        }
    }
    return _storage;
})();

// For local development/testing, you can use emulators:
// Uncomment the lines below if you want to use Firebase emulators
// import { connectAuthEmulator } from "firebase/auth";
// import { connectFirestoreEmulator } from "firebase/firestore";
// 
// if (__DEV__) {
//   connectAuthEmulator(auth, "http://localhost:9099");
//   connectFirestoreEmulator(db, "localhost", 8080);
// }
