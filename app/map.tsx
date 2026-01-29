import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Dimensions,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../src/config/firebase';
import { LocationService } from '../src/services/location.service';
import { MoodService, Mood } from '../src/services/mood.service';
import WidgetService from '../src/services/widget.service';
import Constants from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Conditionally import MapView - will be undefined in Expo Go
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;

if (!isExpoGo) {
    try {
        const Maps = require('react-native-maps');
        MapView = Maps.default;
        Marker = Maps.Marker;
        Polyline = Maps.Polyline;
    } catch (e) {
        console.log('react-native-maps not available');
    }
}

const { width, height } = Dimensions.get('window');

// Mood emoji mapping
const MOOD_EMOJIS: Record<string, string> = {
    happy: '😊',
    loved: '🥰',
    excited: '🤩',
    calm: '😌',
    neutral: '😐',
    tired: '😴',
    anxious: '😰',
    sad: '😢',
    angry: '😤',
    stressed: '😫',
};

interface PartnerLocation {
    latitude: number;
    longitude: number;
    city?: string;
}

interface UserData {
    name?: string;
    partnerId?: string;
    // Location fields are stored at root level by LocationService
    latitude?: number;
    longitude?: number;
    city?: string;
    timezone?: string;
    profileImage?: string;
}

export default function MapScreen() {
    const router = useRouter();
    const mapRef = useRef<any>(null);

    const [user, setUser] = useState<any>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [partnerData, setPartnerData] = useState<UserData | null>(null);
    const [yourMood, setYourMood] = useState<Mood | null>(null);
    const [partnerMood, setPartnerMood] = useState<Mood | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // Listen for auth changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (!u) router.replace('/login');
        });
        return () => unsubscribe();
    }, []);

    // Listen for user data
    useEffect(() => {
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
                setUserData(snap.data() as UserData);
            }
        });

        return () => unsubscribe();
    }, [user]);

    // Listen for partner data
    useEffect(() => {
        if (!userData?.partnerId) return;

        const partnerRef = doc(db, 'users', userData.partnerId);
        const unsubscribe = onSnapshot(partnerRef, (snap) => {
            if (snap.exists()) {
                setPartnerData(snap.data() as UserData);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userData?.partnerId]);

    // Fetch moods and calculate distance
    useEffect(() => {
        if (!user || !userData?.partnerId) return;

        const fetchMoods = async () => {
            try {
                const [yourMoodData, partnerMoodData] = [
                    await MoodService.getTodayMood(user.uid, getPairId()),
                    await MoodService.getTodayMood(userData.partnerId!, getPairId()),
                ];
                setYourMood(yourMoodData);
                setPartnerMood(partnerMoodData);

                // Update widget with moods
                const yourMoodText = yourMoodData
                    ? `${MOOD_EMOJIS[yourMoodData.mood] || ''} ${yourMoodData.note || ''}`.trim()
                    : null;
                const partnerMoodText = partnerMoodData
                    ? `${MOOD_EMOJIS[partnerMoodData.mood] || ''} ${partnerMoodData.note || ''}`.trim()
                    : null;

                WidgetService.updateMood(yourMoodText, partnerMoodText);
            } catch (error) {
                console.error('Failed to fetch moods:', error);
            }
        };

        fetchMoods();
    }, [user, userData?.partnerId]);

    // Calculate distance when both locations available
    useEffect(() => {
        if (userData?.latitude && userData?.longitude && partnerData?.latitude && partnerData?.longitude) {
            const dist = LocationService.calculateDistance(
                userData.latitude,
                userData.longitude,
                partnerData.latitude,
                partnerData.longitude
            );
            setDistance(dist);

            // Update widget with locations
            WidgetService.updateLocations(
                { latitude: userData.latitude, longitude: userData.longitude },
                { latitude: partnerData.latitude, longitude: partnerData.longitude }
            );

            // Fit map to show both markers
            fitToMarkers();
        }
    }, [userData?.latitude, userData?.longitude, partnerData?.latitude, partnerData?.longitude]);

    const getPairId = () => {
        if (!user || !userData?.partnerId) return '';
        const [id1, id2] = [user.uid, userData.partnerId].sort();
        return `${id1}_${id2}`;
    };

    const fitToMarkers = () => {
        if (!mapRef.current || !userData?.latitude || !partnerData?.latitude) return;

        mapRef.current.fitToCoordinates(
            [
                { latitude: userData.latitude!, longitude: userData.longitude! },
                { latitude: partnerData.latitude!, longitude: partnerData.longitude! },
            ],
            {
                edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
                animated: true,
            }
        );
    };

    const getMoodMessage = (mood: Mood | null): string => {
        if (!mood) return '';
        const emoji = MOOD_EMOJIS[mood.mood] || '';
        return mood.note ? `${emoji} ${mood.note}` : emoji;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00D4FF" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Our Map</Text>
                <View style={styles.headerRight} />
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
                {!MapView ? (
                    <View style={styles.expoGoFallback}>
                        <Ionicons name="map-outline" size={64} color="#00D4FF" />
                        <Text style={styles.expoGoTitle}>Map Feature</Text>
                        <Text style={styles.expoGoText}>
                            Maps require a development build.
                        </Text>
                        <View style={styles.locationCards}>
                            <View style={styles.locationCard}>
                                <Text style={styles.locationCardLabel}>You</Text>
                                <Text style={styles.locationCardCity}>{userData?.city || 'Unknown'}</Text>
                            </View>
                            {distance !== null && (
                                <View style={styles.distanceCard}>
                                    <Text style={styles.distanceCardText}>{Math.round(distance)} km</Text>
                                </View>
                            )}
                            <View style={styles.locationCard}>
                                <Text style={styles.locationCardLabel}>Partner</Text>
                                <Text style={styles.locationCardCity}>{partnerData?.city || 'Unknown'}</Text>
                            </View>
                        </View>
                    </View>
                ) : (
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        // Default to Apple Maps on iOS (no provider needed)
                        mapType="mutedStandard"
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                        showsCompass={false}
                        initialRegion={{
                            latitude: userData?.latitude || 43.6532,
                            longitude: userData?.longitude || -79.3832,
                            latitudeDelta: 5,
                            longitudeDelta: 5,
                        }}
                    >
                        {/* Your marker */}
                        {userData?.latitude && userData?.longitude && (
                            <Marker
                                coordinate={{
                                    latitude: userData.latitude,
                                    longitude: userData.longitude,
                                }}
                            >
                                <View style={styles.markerContainer}>
                                    {yourMood && (
                                        <View style={styles.moodBubble}>
                                            <Text style={styles.moodBubbleText}>
                                                {getMoodMessage(yourMood)}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={[styles.avatar, styles.yourAvatar]}>
                                        {userData.profileImage ? (
                                            <Image
                                                source={{ uri: userData.profileImage }}
                                                style={styles.avatarImage}
                                            />
                                        ) : (
                                            <Ionicons name="person" size={24} color="#666" />
                                        )}
                                    </View>
                                </View>
                            </Marker>
                        )}

                        {/* Partner marker */}
                        {partnerData?.latitude && partnerData?.longitude && (
                            <Marker
                                coordinate={{
                                    latitude: partnerData.latitude,
                                    longitude: partnerData.longitude,
                                }}
                            >
                                <View style={styles.markerContainer}>
                                    {partnerMood && (
                                        <View style={styles.moodBubble}>
                                            <Text style={styles.moodBubbleText}>
                                                {getMoodMessage(partnerMood)}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={[styles.avatar, styles.partnerAvatar]}>
                                        {partnerData.profileImage ? (
                                            <Image
                                                source={{ uri: partnerData.profileImage }}
                                                style={styles.avatarImage}
                                            />
                                        ) : (
                                            <Ionicons name="person" size={24} color="#666" />
                                        )}
                                    </View>
                                </View>
                            </Marker>
                        )}

                        {/* Line between markers */}
                        {userData?.latitude && userData?.longitude && partnerData?.latitude && partnerData?.longitude && (
                            <Polyline
                                coordinates={[
                                    {
                                        latitude: userData.latitude,
                                        longitude: userData.longitude,
                                    },
                                    {
                                        latitude: partnerData.latitude,
                                        longitude: partnerData.longitude,
                                    },
                                ]}
                                strokeColor="rgba(255, 255, 255, 0.5)"
                                strokeWidth={2}
                                lineDashPattern={[10, 5]}
                            />
                        )}
                    </MapView>
                )}

                {/* Distance badge */}
                {distance !== null && !isExpoGo && (
                    <View style={styles.distanceBadge}>
                        <Text style={styles.distanceText}>{Math.round(distance)} km</Text>
                    </View>
                )}
            </View>

            {/* Bottom info */}
            <View style={styles.bottomInfo}>
                <View style={styles.locationRow}>
                    <View style={styles.locationItem}>
                        <Text style={styles.locationLabel}>You</Text>
                        <Text style={styles.locationCity}>
                            {userData?.city || 'Unknown'}
                        </Text>
                    </View>
                    <Ionicons name="heart" size={20} color="#FF6B8A" />
                    <View style={styles.locationItem}>
                        <Text style={styles.locationLabel}>Partner</Text>
                        <Text style={styles.locationCity}>
                            {partnerData?.city || 'Unknown'}
                        </Text>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fefefe',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fefefe',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fefefe',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#f8f5ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#141118',
    },
    headerRight: {
        width: 40,
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    map: {
        flex: 1,
    },
    markerContainer: {
        alignItems: 'center',
    },
    moodBubble: {
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 4,
        maxWidth: 150,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#e8e0f0',
    },
    moodBubbleText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#141118',
        textAlign: 'center',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f8f5ff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
    },
    yourAvatar: {
        borderColor: '#7f13ec',
    },
    partnerAvatar: {
        borderColor: '#ff85a2',
    },
    avatarImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    distanceBadge: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -40 }, { translateY: -15 }],
        backgroundColor: '#7f13ec',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    distanceText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    bottomInfo: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        borderTopColor: '#e8e0f0',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    locationItem: {
        flex: 1,
        alignItems: 'center',
    },
    locationLabel: {
        fontSize: 12,
        color: '#756189',
        marginBottom: 4,
    },
    locationCity: {
        fontSize: 16,
        fontWeight: '600',
        color: '#141118',
    },
    expoGoFallback: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f5ff',
        padding: 20,
    },
    expoGoTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#141118',
        marginTop: 16,
    },
    expoGoText: {
        fontSize: 14,
        color: '#756189',
        textAlign: 'center',
        marginTop: 8,
    },
    locationCards: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 32,
        gap: 16,
    },
    locationCard: {
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        minWidth: 100,
        borderWidth: 1,
        borderColor: '#e8e0f0',
    },
    locationCardLabel: {
        fontSize: 12,
        color: '#756189',
        marginBottom: 4,
    },
    locationCardCity: {
        fontSize: 16,
        fontWeight: '600',
        color: '#141118',
    },
    distanceCard: {
        backgroundColor: '#f8f5ff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#7f13ec',
    },
    distanceCardText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#7f13ec',
    },
});

