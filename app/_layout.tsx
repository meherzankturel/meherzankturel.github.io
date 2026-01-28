import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { useCallback, useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { View, LogBox } from 'react-native';
import { AuthProvider } from '../src/contexts/AuthContext';
import ErrorBoundary from '../src/components/ErrorBoundary';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Suppress expected Firebase errors (missing indexes, collections, etc.)
// These are normal during development until Firestore is fully set up
LogBox.ignoreLogs([
  'Error loading SOS events',
  'FirebaseError',
  'index.*does not exist',
  'The query requires an index',
]);

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        // Add custom fonts here if needed, e.g.
        // 'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
    });

    const onLayoutRootView = useCallback(async () => {
        if (fontsLoaded) {
            await SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    if (!fontsLoaded) {
        return null;
    }

    return (
        <ErrorBoundary>
            <AuthProvider>
                <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
                    <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    </Stack>
                </View>
            </AuthProvider>
        </ErrorBoundary>
    );
}
