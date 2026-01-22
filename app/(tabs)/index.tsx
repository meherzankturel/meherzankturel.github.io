import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, Pressable, ScrollView, SafeAreaView, RefreshControl, AppState, Animated, Easing, Image, ActionSheetIOS, TextInput, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../src/config/firebase';
import { theme } from '../../src/config/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, orderBy, query, limit, where, getDoc, getDocs } from 'firebase/firestore';
import { SOSService, SOSEvent } from '../../src/services/sos.service';
import { MoodService, MoodType } from '../../src/services/mood.service';
import { PresenceService, Presence } from '../../src/services/presence.service';
import { sendPushNotification } from '../../src/utils/notifications';
import MoodSelector from '../../src/components/MoodSelector';
import SignalButton from '../../src/components/SignalButton';
import HeartEffect from '../../src/components/HeartEffect';
import { SwipeableTabWrapper } from '../../src/components/SwipeableTabWrapper';
import { SyncLogoHeader } from '../../src/components/SyncLogoHeader';
import { PhotoViewerModal } from '../../src/components/PhotoViewerModal';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import NetInfo from '@react-native-community/netinfo';
import { LocationService, UserLocation } from '../../src/services/location.service';
import { WeatherService, WeatherData } from '../../src/services/weather.service';
import { MomentService, CoupleMoment, DailyMoment } from '../../src/services/moment.service';
import { DailyEchoService, DailyEcho } from '../../src/services/dailyEcho.service';
import WidgetService from '../../src/services/widget.service';

export default function HomeScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [updatingMood, setUpdatingMood] = useState(false);
    const [todaysMood, setTodaysMood] = useState<string | null>(null);
    const [partnerMood, setPartnerMood] = useState<any>(null);
    const [partnerData, setPartnerData] = useState<any>(null);
    const [senderData, setSenderData] = useState<any>(null); // Sender's data for SOS notifications
    const [showMoodModal, setShowMoodModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [activeSOS, setActiveSOS] = useState<any>(null);
    const [sendingSOS, setSendingSOS] = useState(false);
    const [lastSOSId, setLastSOSId] = useState<string | null>(null);
    const [heartTrigger, setHeartTrigger] = useState(0); // Trigger for heart effects
    const [singleHeartMode, setSingleHeartMode] = useState(true); // Track if we should show single heart
    const lastPulseTimeRef = useRef<number>(0); // Track last pulse time
    const lastReceivedPulseTimeRef = useRef<number>(0); // Track last received pulse time
    const lastReceivedPulseIdRef = useRef<string | null>(null); // Track last received pulse ID to avoid duplicates
    const [timeAgo, setTimeAgo] = useState<string>('just now'); // Real-time time display

    // Live Status
    const [partnerPresence, setPartnerPresence] = useState<Presence | null>(null);
    const [isOnline, setIsOnline] = useState(true);
    const liveBlinkAnim = useRef(new Animated.Value(1)).current;
    const partnerBlinkAnim = useRef(new Animated.Value(1)).current;

    // Location & Time
    const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
    const [myTime, setMyTime] = useState<Date>(new Date());
    const [partnerTime, setPartnerTime] = useState<Date>(new Date());
    const [loadingLocation, setLoadingLocation] = useState(false);

    // Weather
    const [myWeather, setMyWeather] = useState<WeatherData | null>(null);
    const [partnerWeather, setPartnerWeather] = useState<WeatherData | null>(null);
    const [loadingWeather, setLoadingWeather] = useState(false);

    // Moment of the Day
    const [todayMoment, setTodayMoment] = useState<CoupleMoment | null>(null);
    const [uploadingMoment, setUploadingMoment] = useState(false);
    const [showCaptionInput, setShowCaptionInput] = useState(false);
    const [momentCaption, setMomentCaption] = useState('');
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

    // Photo Viewer
    const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
    const [selectedPhotoUrl, setSelectedPhotoUrl] = useState('');
    const [selectedPhotoCaption, setSelectedPhotoCaption] = useState<string | undefined>();
    const [selectedMomentId, setSelectedMomentId] = useState<string | undefined>();
    const [isOwnPhoto, setIsOwnPhoto] = useState(false);

    // Daily Echo
    const [dailyEcho, setDailyEcho] = useState<DailyEcho | null>(null);
    const [showEchoAnswerModal, setShowEchoAnswerModal] = useState(false);
    const [echoAnswer, setEchoAnswer] = useState('');
    const [submittingEcho, setSubmittingEcho] = useState(false);
    const [showEchoRevealModal, setShowEchoRevealModal] = useState(false);
    const [echoCountdown, setEchoCountdown] = useState(0);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        // Check for active SOS manually when refreshing
        if (userData?.partnerId) {
            try {
                // Try simple query without orderBy (doesn't need index)
                const q = query(
                    collection(db, 'sosEvents'),
                    where('userId', '==', userData.partnerId),
                    where('responded', '==', false),
                    limit(5)
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    // Get most recent
                    const sosDocs = snapshot.docs.sort((a, b) => {
                        const aTime = a.data().timestamp?.toMillis() || 0;
                        const bTime = b.data().timestamp?.toMillis() || 0;
                        return bTime - aTime;
                    });
                    const sosData: SOSEvent & { id: string } = { id: sosDocs[0].id, ...sosDocs[0].data() } as SOSEvent & { id: string };
                    const sosId = sosData.id;

                    // Only show notification if this is a new SOS (not the same one we already saw)
                    if (sosId !== lastSOSId) {
                        setLastSOSId(sosId);
                        setActiveSOS(sosData);

                        // Fetch sender's data to get their name
                        const fetchSenderData = async () => {
                            try {
                                const senderDoc = await getDoc(doc(db, 'users', sosData.userId));
                                if (senderDoc.exists()) {
                                    const sender = senderDoc.data();
                                    setSenderData(sender);
                                    return sender;
                                }
                            } catch (error) {
                                console.warn('Failed to fetch sender data:', error);
                            }
                            return null;
                        };

                        // Show notification immediately with available data
                        const senderName = partnerData?.name || partnerData?.displayName || partnerData?.email?.split('@')[0] || 'Your partner';

                        // Haptic feedback when SOS is received
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

                        // Show local notification on partner's device
                        Notifications.scheduleNotificationAsync({
                            content: {
                                title: '🚨 SOS Alert',
                                body: `${senderName} needs you right now!${sosData.message ? ' ' + sosData.message : ''}`,
                                sound: true,
                                priority: Notifications.AndroidNotificationPriority.MAX,
                                data: {
                                    type: 'sos',
                                    sosId: sosId,
                                    userId: sosData.userId,
                                },
                            },
                            trigger: null,
                        }).then(() => {
                            console.log('✅ SOS notification shown to partner (manual check)');
                        }).catch(err => {
                            console.error('❌ Failed to show SOS notification (manual check):', err);
                        });

                        // Fetch sender data for future use
                        fetchSenderData();
                    } else {
                        // Same SOS - just update state (don't show duplicate notification)
                        setActiveSOS(sosData);
                    }
                } else {
                    setActiveSOS(null);
                    setLastSOSId(null);
                }
            } catch (error) {
                console.warn('Manual SOS check failed:', error);
            }
        }

        // Reload weather data with fresh fetch (clear cache first)
        if (userData?.latitude && userData?.longitude) {
            // Clear cache to force fresh data
            await WeatherService.clearCache();
            const weather = await WeatherService.getWeatherByCoords(
                userData.latitude,
                userData.longitude
            );
            if (weather) {
                setMyWeather(weather);
            }
        }

        if (partnerData?.latitude && partnerData?.longitude) {
            const weather = await WeatherService.getWeatherByCoords(
                partnerData.latitude,
                partnerData.longitude
            );
            if (weather) {
                setPartnerWeather(weather);
            }
        }

        // Reload moods (listeners will update automatically)
        // Reload moments (listeners will update automatically)
        // Reload Daily Echo (listener will update automatically)

        console.log('✅ Refresh complete - all data reloaded');

        await new Promise(resolve => setTimeout(resolve, 500));
        setRefreshing(false);
    }, [userData?.partnerId, userData?.latitude, userData?.longitude, partnerData?.latitude, partnerData?.longitude]);

    // 1. Listen to User Profile
    useEffect(() => {
        if (!user) return;
        const unsubscribe = onSnapshot(
            doc(db, 'users', user.uid),
            (doc) => {
                setUserData(doc.data());
                setLoading(false);
            },
            (error: any) => {
                // Log but don't show error overlay for expected errors
                if (__DEV__) {
                    console.warn('User profile query failed:', error.code || error.message);
                }
                setLoading(false);
            }
        );
        return unsubscribe;
    }, [user]);

    // Live Status - Blinking Animation
    useEffect(() => {
        const startBlinkAnimation = (anim: Animated.Value, isLive: boolean) => {
            if (!isLive) {
                anim.setValue(1);
                return null;
            }

            return Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 0.3,
                        duration: 800,
                        easing: Easing.ease,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: 800,
                        easing: Easing.ease,
                        useNativeDriver: true,
                    }),
                ])
            );
        };

        // My live indicator animation
        const myAnimation = startBlinkAnimation(liveBlinkAnim, isOnline);
        myAnimation?.start();

        return () => {
            myAnimation?.stop();
        };
    }, [isOnline]);

    // Location permission and initialization
    useEffect(() => {
        const initLocation = async () => {
            if (!user) return;

            // Check if we have permission
            const hasPermission = await LocationService.hasPermissions();
            setLocationPermission(hasPermission);

            // If we have permission, update location
            if (hasPermission) {
                setLoadingLocation(true);
                await LocationService.updateUserLocation(user.uid);
                setLoadingLocation(false);
            }
        };

        initLocation();
    }, [user]);

    // Real-time clock updates (every second for accuracy)
    useEffect(() => {
        const updateTimes = () => {
            // My time
            const myTimezone = userData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
            setMyTime(LocationService.getTimeInTimezone(myTimezone));

            // Partner time
            if (partnerData?.timezone) {
                setPartnerTime(LocationService.getTimeInTimezone(partnerData.timezone));
            } else {
                setPartnerTime(new Date());
            }
        };

        // Update immediately
        updateTimes();

        // Update every second for real-time display
        const interval = setInterval(updateTimes, 1000);

        return () => clearInterval(interval);
    }, [userData?.timezone, partnerData?.timezone]);

    // Handle location permission request
    const handleLocationPermission = async () => {
        if (!user) return;

        setLoadingLocation(true);
        const granted = await LocationService.requestPermissions();
        setLocationPermission(granted);

        if (granted) {
            await LocationService.updateUserLocation(user.uid);
        }
        setLoadingLocation(false);
    };

    // Fetch weather data for both users
    useEffect(() => {
        const fetchWeather = async () => {
            // Fetch my weather
            if (userData?.latitude && userData?.longitude) {
                setLoadingWeather(true);
                const weather = await WeatherService.getWeatherByCoords(
                    userData.latitude,
                    userData.longitude
                );
                if (weather) {
                    setMyWeather(weather);
                    console.log('✅ Got my weather by coords:', weather.temp, weather.condition);
                }

                // Check for severe weather and notify partner
                if (weather?.isSevere && partnerData?.pushToken && userData?.name) {
                    await WeatherService.notifyPartnerOfSevereWeather(
                        partnerData.pushToken,
                        userData.city || 'their city',
                        weather,
                        userData.name
                    );
                }
                setLoadingWeather(false);
            } else if (userData?.city) {
                // Fallback to city name if no coords
                setLoadingWeather(true);
                const weather = await WeatherService.getWeatherByCity(userData.city);
                if (weather) {
                    setMyWeather(weather);
                    console.log('✅ Got my weather by city:', weather.temp, weather.condition);
                }
                setLoadingWeather(false);
            }

            // Fetch partner weather
            if (partnerData?.latitude && partnerData?.longitude) {
                const weather = await WeatherService.getWeatherByCoords(
                    partnerData.latitude,
                    partnerData.longitude
                );
                if (weather) {
                    setPartnerWeather(weather);
                    console.log('✅ Got partner weather by coords:', weather.temp, weather.condition);
                }
            } else if (partnerData?.city) {
                const weather = await WeatherService.getWeatherByCity(partnerData.city);
                if (weather) {
                    setPartnerWeather(weather);
                    console.log('✅ Got partner weather by city:', weather.temp, weather.condition);
                }
            }
        };

        fetchWeather();

        // Refresh weather every 3 minutes for real-time updates
        const interval = setInterval(fetchWeather, 180000); // 3 minutes
        return () => clearInterval(interval);
    }, [userData?.latitude, userData?.longitude, userData?.city, partnerData?.latitude, partnerData?.longitude, partnerData?.city]);

    // Update iOS widgets when location/distance changes
    useEffect(() => {
        if (userData?.latitude && userData?.longitude && partnerData?.latitude && partnerData?.longitude) {
            // Calculate distance
            const R = 6371; // Radius of Earth in km
            const dLat = (partnerData.latitude - userData.latitude) * Math.PI / 180;
            const dLon = (partnerData.longitude - userData.longitude) * Math.PI / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(userData.latitude * Math.PI / 180) * Math.cos(partnerData.latitude * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;

            // Update widget
            WidgetService.updateDistance(
                distance,
                userData.city || 'Your City',
                partnerData.city || 'Partner City'
            );
        }
    }, [userData?.latitude, userData?.longitude, userData?.city, partnerData?.latitude, partnerData?.longitude, partnerData?.city]);

    // Real-time moment listener
    useEffect(() => {
        if (!user || !userData?.partnerId) return;

        const unsubscribe = MomentService.listenToTodayMoment(
            user.uid,
            userData.partnerId,
            (moment) => {
                setTodayMoment(moment);

                // Update widgets with latest moments
                if (moment) {
                    const yourPhoto = moment.user1Photo?.userId === user.uid ? moment.user1Photo : moment.user2Photo;
                    const partnerPhoto = moment.user1Photo?.userId === user.uid ? moment.user2Photo : moment.user1Photo;

                    WidgetService.updateMoments(
                        yourPhoto ? {
                            photoUrl: yourPhoto.photoUrl,
                            caption: yourPhoto.caption,
                            timestamp: yourPhoto.uploadedAt,
                        } : null,
                        partnerPhoto ? {
                            photoUrl: partnerPhoto.photoUrl,
                            caption: partnerPhoto.caption,
                            timestamp: partnerPhoto.uploadedAt,
                        } : null
                    );
                }
            }
        );

        return unsubscribe;
    }, [user, userData?.partnerId]);

    // Real-time Daily Echo listener
    useEffect(() => {
        if (!user || !userData?.pairId) return;

        // Initialize today's echo
        DailyEchoService.getTodayEcho(userData.pairId).then(setDailyEcho);

        // Listen to real-time updates
        const unsubscribe = DailyEchoService.listenToTodayEcho(
            userData.pairId,
            (echo) => {
                setDailyEcho(echo);
            }
        );

        return unsubscribe;
    }, [user, userData?.pairId]);

    // Daily Echo countdown timer
    useEffect(() => {
        if (!dailyEcho) return;

        const updateCountdown = () => {
            const seconds = DailyEchoService.getCountdownSeconds(dailyEcho);
            setEchoCountdown(seconds);
        };

        // Update immediately
        updateCountdown();

        // Update every second
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [dailyEcho]);

    // Handle Daily Echo answer submission
    const handleSubmitEchoAnswer = async () => {
        if (!echoAnswer.trim() || !user || !userData?.pairId) return;

        setSubmittingEcho(true);
        const success = await DailyEchoService.submitAnswer(
            userData.pairId,
            user.uid,
            echoAnswer.trim()
        );

        if (success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowEchoAnswerModal(false);
            setEchoAnswer('');
        } else {
            Alert.alert('Error', 'Failed to submit your answer. Please try again.');
        }
        setSubmittingEcho(false);
    };

    // Handle reveal click
    const handleRevealEcho = async () => {
        if (!userData?.pairId || !dailyEcho) return;

        // Mark as revealed
        await DailyEchoService.markRevealed(userData.pairId);
        setShowEchoRevealModal(true);
    };

    // Handle photo selection
    const handleAddMoment = async () => {
        const hasPermission = await MomentService.requestPermissions();
        if (!hasPermission) {
            Alert.alert(
                'Permission Required',
                'Please grant camera and photo library permissions to share your moment.'
            );
            return;
        }

        // Show action sheet
        Alert.alert(
            'Add Your Moment',
            'Choose how you want to share your moment for today',
            [
                {
                    text: 'Take Photo',
                    onPress: async () => {
                        const uri = await MomentService.takePhoto();
                        if (uri) {
                            setSelectedImageUri(uri);
                            setShowCaptionInput(true);
                        }
                    },
                },
                {
                    text: 'Choose from Library',
                    onPress: async () => {
                        const uri = await MomentService.pickImage();
                        if (uri) {
                            setSelectedImageUri(uri);
                            setShowCaptionInput(true);
                        }
                    },
                },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    // Handle moment upload
    const handleUploadMoment = async () => {
        if (!selectedImageUri || !user || !userData?.partnerId) return;

        setUploadingMoment(true);
        const success = await MomentService.uploadMoment(
            user.uid,
            userData.partnerId,
            selectedImageUri,
            momentCaption.trim() || undefined
        );

        if (success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowCaptionInput(false);
            setSelectedImageUri(null);
            setMomentCaption('');
        } else {
            Alert.alert('Error', 'Failed to upload your moment. Please try again.');
        }
        setUploadingMoment(false);
    };

    // Partner live indicator animation  
    useEffect(() => {
        const isPartnerOnline = partnerPresence?.isOnline ?? false;

        if (!isPartnerOnline) {
            partnerBlinkAnim.setValue(1);
            return;
        }

        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(partnerBlinkAnim, {
                    toValue: 0.3,
                    duration: 800,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
                Animated.timing(partnerBlinkAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();

        return () => animation.stop();
    }, [partnerPresence?.isOnline]);

    // Update my presence when app opens/closes
    useEffect(() => {
        if (!user || !userData?.pairId) return;

        const pairId = userData.pairId;

        // Set online when component mounts
        PresenceService.updatePresence(user.uid, pairId, true)
            .then(() => console.log('✅ Presence set to online'))
            .catch((err) => console.warn('Failed to set presence online:', err));

        // Listen to app state changes (foreground/background)
        const subscription = AppState.addEventListener('change', async (nextAppState) => {
            if (nextAppState === 'active') {
                setIsOnline(true);
                await PresenceService.updatePresence(user.uid, pairId, true)
                    .catch(err => console.warn('Failed to update presence to online:', err));
            } else if (nextAppState === 'background' || nextAppState === 'inactive') {
                setIsOnline(false);
                await PresenceService.setOffline(user.uid, pairId)
                    .catch(err => console.warn('Failed to set presence offline:', err));
            }
        });

        // Cleanup: set offline when component unmounts
        return () => {
            subscription.remove();
            PresenceService.setOffline(user.uid, pairId)
                .catch(err => console.warn('Failed to set presence offline on unmount:', err));
        };
    }, [user, userData?.pairId]);

    // Subscribe to partner's presence
    useEffect(() => {
        if (!userData?.partnerId || !userData?.pairId) return;

        const unsubscribe = PresenceService.subscribeToPartnerPresence(
            userData.pairId,
            userData.partnerId,
            (presence) => {
                setPartnerPresence(presence);
            }
        );

        return unsubscribe;
    }, [userData?.partnerId, userData?.pairId]);

    // Helper function to format "last seen" time with actual time
    const formatLastSeen = (lastSeen: any): string => {
        if (!lastSeen) return '';

        const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        // Format time as "3:45 PM"
        const formatTime = (d: Date) => {
            const hours = d.getHours();
            const mins = d.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const hour12 = hours % 12 || 12;
            return `${hour12}:${mins.toString().padStart(2, '0')} ${ampm}`;
        };

        // Check if same day
        const isToday = date.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) {
            if (diffMins < 1) return `Today, ${formatTime(date)}`;
            if (diffMins < 60) return `${diffMins}m ago`;
            return `Today, ${formatTime(date)}`;
        }

        if (isYesterday) {
            return `Yesterday, ${formatTime(date)}`;
        }

        if (diffHours < 168) { // Within a week
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return `${days[date.getDay()]}, ${formatTime(date)}`;
        }

        // More than a week ago
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
    };

    // Helper function to create consistent pairId from two user IDs (same as moods tab)
    const getPairId = (uid1: string, uid2: string, storedPairId?: string): string => {
        if (storedPairId) return storedPairId;
        // Sort IDs alphabetically to ensure both users get the same pairId
        const [id1, id2] = [uid1, uid2].sort();
        return `${id1}_${id2}`;
    };

    // 2. Listen to My Recent Mood
    useEffect(() => {
        if (!user || !userData?.partnerId) return;

        const pairId = getPairId(user.uid, userData.partnerId, userData.pairId);
        if (!pairId) return;

        const q = query(
            collection(db, 'moods'),
            where('userId', '==', user.uid),
            where('pairId', '==', pairId),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const moodEmojis: Record<string, string> = {
            happy: '😊',
            calm: '😌',
            neutral: '😐',
            sad: '😢',
            anxious: '😰',
            excited: '🤩',
            grateful: '🙏',
            loved: '💕',
        };

        let unsubscribe: (() => void) | null = null;

        const tryQuery = (useOrderBy: boolean) => {
            let q;
            try {
                if (useOrderBy) {
                    q = query(
                        collection(db, 'moods'),
                        where('userId', '==', user.uid),
                        where('pairId', '==', pairId),
                        orderBy('createdAt', 'desc'),
                        limit(1)
                    );
                } else {
                    q = query(
                        collection(db, 'moods'),
                        where('userId', '==', user.uid),
                        where('pairId', '==', pairId),
                        limit(10)
                    );
                }
            } catch (error) {
                if (useOrderBy) {
                    return tryQuery(false);
                }
                return null;
            }

            return onSnapshot(
                q,
                (snapshot) => {
                    if (!snapshot.empty) {
                        let docs = snapshot.docs.map(doc => doc.data());
                        if (!useOrderBy) {
                            // Sort manually if orderBy didn't work
                            docs.sort((a, b) => {
                                const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
                                const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
                                return bTime - aTime;
                            });
                        }
                        const moodData = docs[0];
                        const moodType = moodData.mood || moodData.emoji; // Support both formats
                        const emoji = moodEmojis[moodType] || moodType || '❔';
                        setTodaysMood(emoji);
                    } else {
                        setTodaysMood(null);
                    }
                },
                (error: any) => {
                    // If orderBy fails, try without orderBy
                    if ((error.code === 'failed-precondition' || error.code === 9) && useOrderBy) {
                        console.warn('Mood query with orderBy failed, trying without:', error);
                        unsubscribe = tryQuery(false);
                    } else {
                        if (__DEV__) {
                            console.warn('Mood query failed:', error.code || error.message);
                        }
                        setTodaysMood(null);
                    }
                }
            );
        };

        unsubscribe = tryQuery(true);

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user, userData?.partnerId, userData?.pairId]);

    // 3. Listen to Partner's Profile (for push token)
    useEffect(() => {
        if (!userData?.partnerId) return;
        const unsubscribe = onSnapshot(
            doc(db, 'users', userData.partnerId),
            (doc) => {
                setPartnerData(doc.data());
            },
            (error: any) => {
                // Silently fail - this is okay if partner doesn't exist yet
                if (__DEV__) {
                    console.warn('Partner profile query failed:', error.code || error.message);
                }
            }
        );
        return unsubscribe;
    }, [userData?.partnerId]);

    // Helper function to format time ago
    const formatTimeAgo = (timestamp: any): string => {
        if (!timestamp) return 'just now';

        let timestampMs: number;
        if (timestamp.toMillis) {
            // Firestore Timestamp
            timestampMs = timestamp.toMillis();
        } else if (timestamp.seconds) {
            // Firestore Timestamp (alternative format)
            timestampMs = timestamp.seconds * 1000;
        } else if (typeof timestamp === 'number') {
            timestampMs = timestamp;
        } else {
            return 'just now';
        }

        const now = Date.now();
        const diffMs = now - timestampMs;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSeconds < 10) {
            return 'just now';
        } else if (diffSeconds < 60) {
            return `${diffSeconds}s ago`;
        } else if (diffMinutes < 60) {
            return `${diffMinutes}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays === 1) {
            return '1 day ago';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            // For older dates, show the actual date
            const date = new Date(timestampMs);
            return date.toLocaleDateString();
        }
    };

    // 4. Listen to Partner's Mood
    useEffect(() => {
        if (!user || !userData?.partnerId) return;

        const pairId = getPairId(user.uid, userData.partnerId, userData.pairId);
        if (!pairId) return;

        const q = query(
            collection(db, 'moods'),
            where('userId', '==', userData.partnerId),
            where('pairId', '==', pairId),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const moodEmojis: Record<string, string> = {
            happy: '😊',
            calm: '😌',
            neutral: '😐',
            sad: '😢',
            anxious: '😰',
            excited: '🤩',
            grateful: '🙏',
            loved: '💕',
        };

        const moodLabels: Record<string, string> = {
            happy: 'Happy',
            calm: 'Calm',
            neutral: 'Neutral',
            sad: 'Sad',
            anxious: 'Anxious',
            excited: 'Excited',
            grateful: 'Grateful',
            loved: 'Loved',
        };

        let unsubscribe: (() => void) | null = null;

        const tryQuery = (useOrderBy: boolean) => {
            let q;
            try {
                if (useOrderBy) {
                    q = query(
                        collection(db, 'moods'),
                        where('userId', '==', userData.partnerId),
                        where('pairId', '==', pairId),
                        orderBy('createdAt', 'desc'),
                        limit(1)
                    );
                } else {
                    q = query(
                        collection(db, 'moods'),
                        where('userId', '==', userData.partnerId),
                        where('pairId', '==', pairId),
                        limit(10)
                    );
                }
            } catch (error) {
                if (useOrderBy) {
                    return tryQuery(false);
                }
                return null;
            }

            return onSnapshot(
                q,
                (snapshot) => {
                    if (!snapshot.empty) {
                        let docs = snapshot.docs.map(doc => doc.data());
                        if (!useOrderBy) {
                            // Sort manually if orderBy didn't work
                            docs.sort((a, b) => {
                                const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
                                const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
                                return bTime - aTime;
                            });
                        }
                        const moodData = docs[0];
                        const moodType = moodData.mood || moodData.emoji; // Support both formats
                        const emoji = moodEmojis[moodType] || moodType || '❔';
                        const label = moodLabels[moodType] || moodData.label || 'Unknown';

                        // Store in format compatible with display
                        setPartnerMood({
                            emoji,
                            label,
                            mood: moodType,
                            createdAt: moodData.createdAt,
                        });
                    } else {
                        setPartnerMood(null);
                    }
                },
                (error: any) => {
                    // If orderBy fails, try without orderBy
                    if ((error.code === 'failed-precondition' || error.code === 9) && useOrderBy) {
                        console.warn('Partner mood query with orderBy failed, trying without:', error);
                        unsubscribe = tryQuery(false);
                    } else {
                        if (__DEV__) {
                            console.warn('Partner mood query failed:', error.code || error.message);
                        }
                        setPartnerMood(null);
                    }
                }
            );
        };

        unsubscribe = tryQuery(true);

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user, userData?.partnerId, userData?.pairId]);

    // Real-time time ago updater for partner's mood
    useEffect(() => {
        if (!partnerMood?.createdAt) {
            setTimeAgo('just now');
            return;
        }

        // Update immediately
        setTimeAgo(formatTimeAgo(partnerMood.createdAt));

        // Update every second
        const interval = setInterval(() => {
            setTimeAgo(formatTimeAgo(partnerMood.createdAt));
        }, 1000);

        return () => clearInterval(interval);
    }, [partnerMood?.createdAt]);

    // 5. Listen to Active SOS from Partner
    useEffect(() => {
        if (!userData?.partnerId) return;

        let unsubscribe: (() => void) | null = null;

        // Function to check for active SOS (fallback if real-time listener fails)
        const checkForActiveSOS = async () => {
            try {
                const q = query(
                    collection(db, 'sosEvents'),
                    where('userId', '==', userData.partnerId),
                    where('responded', '==', false),
                    orderBy('timestamp', 'desc'),
                    limit(1)
                );
                const snapshot = await getDoc(q as any);
                // Note: getDoc doesn't work with query, we need getDocs
                // But let's use the real-time listener instead
            } catch (error) {
                // Fallback: try simpler query without orderBy
                try {
                    const simpleQ = query(
                        collection(db, 'sosEvents'),
                        where('userId', '==', userData.partnerId),
                        where('responded', '==', false),
                        limit(1)
                    );
                    const unsubscribeSimple = onSnapshot(
                        simpleQ,
                        (snapshot) => {
                            if (!snapshot.empty) {
                                // Get the most recent one
                                const sosDocs = snapshot.docs.sort((a, b) => {
                                    const aTime = a.data().timestamp?.toMillis() || 0;
                                    const bTime = b.data().timestamp?.toMillis() || 0;
                                    return bTime - aTime;
                                });
                                const sosData: SOSEvent & { id: string } = { id: sosDocs[0].id, ...sosDocs[0].data() } as SOSEvent & { id: string };
                                const sosId = sosData.id;

                                // Only show notification if this is a new SOS (not the same one we already saw)
                                if (sosId !== lastSOSId) {
                                    setLastSOSId(sosId);
                                    setActiveSOS(sosData);

                                    // Fetch sender's data to get their name
                                    const fetchSenderData = async () => {
                                        try {
                                            const senderDoc = await getDoc(doc(db, 'users', sosData.userId));
                                            if (senderDoc.exists()) {
                                                const sender = senderDoc.data();
                                                setSenderData(sender);
                                                return sender;
                                            }
                                        } catch (error) {
                                            console.warn('Failed to fetch sender data:', error);
                                        }
                                        return null;
                                    };

                                    // Show notification immediately with available data
                                    const senderName = partnerData?.name || partnerData?.displayName || partnerData?.email?.split('@')[0] || 'Your partner';

                                    // Haptic feedback when SOS is received
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

                                    // Show local notification on partner's device
                                    Notifications.scheduleNotificationAsync({
                                        content: {
                                            title: '🚨 SOS Alert',
                                            body: `${senderName} needs you right now!${sosData.message ? ' ' + sosData.message : ''}`,
                                            sound: true,
                                            priority: Notifications.AndroidNotificationPriority.MAX,
                                            data: {
                                                type: 'sos',
                                                sosId: sosId,
                                                userId: sosData.userId,
                                            },
                                        },
                                        trigger: null,
                                    }).then(() => {
                                        console.log('✅ SOS notification shown to partner (fallback)');
                                    }).catch(err => {
                                        console.error('❌ Failed to show SOS notification (fallback):', err);
                                    });

                                    // Fetch sender data for future use
                                    fetchSenderData();
                                } else {
                                    // Same SOS - just update state (don't show duplicate notification)
                                    setActiveSOS(sosData);
                                }
                            } else {
                                setActiveSOS(null);
                                setLastSOSId(null);
                            }
                        },
                        (error: any) => {
                            console.warn('SOS listener error (using fallback):', error.code || error.message);
                        }
                    );
                    unsubscribe = unsubscribeSimple;
                } catch (fallbackError) {
                    console.warn('SOS fallback query also failed');
                }
            }
        };

        try {
            const q = query(
                collection(db, 'sosEvents'),
                where('userId', '==', userData.partnerId),
                where('responded', '==', false),
                orderBy('timestamp', 'desc'),
                limit(1)
            );
            unsubscribe = onSnapshot(
                q,
                (snapshot) => {
                    if (!snapshot.empty) {
                        const sosData: SOSEvent & { id: string } = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SOSEvent & { id: string };
                        const sosId = sosData.id;

                        // Only show notification if this is a new SOS (not the same one we already saw)
                        if (sosId !== lastSOSId) {
                            setLastSOSId(sosId);
                            setActiveSOS(sosData);

                            // Fetch sender's data to get their name
                            const fetchSenderData = async () => {
                                try {
                                    const senderDoc = await getDoc(doc(db, 'users', sosData.userId));
                                    if (senderDoc.exists()) {
                                        const sender = senderDoc.data();
                                        setSenderData(sender);
                                        return sender;
                                    }
                                } catch (error) {
                                    console.warn('Failed to fetch sender data:', error);
                                }
                                return null;
                            };

                            // Show notification immediately with available data, then update if needed
                            const senderName = partnerData?.name || partnerData?.displayName || partnerData?.email?.split('@')[0] || 'Your partner';

                            // Haptic feedback when SOS is received
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

                            // Show local notification on partner's device
                            Notifications.scheduleNotificationAsync({
                                content: {
                                    title: '🚨 SOS Alert',
                                    body: `${senderName} needs you right now!${sosData.message ? ' ' + sosData.message : ''}`,
                                    sound: true,
                                    priority: Notifications.AndroidNotificationPriority.MAX,
                                    data: {
                                        type: 'sos',
                                        sosId: sosId,
                                        userId: sosData.userId,
                                    },
                                },
                                trigger: null,
                            }).then(() => {
                                console.log('✅ SOS notification shown to partner');
                            }).catch(err => {
                                console.error('❌ Failed to show SOS notification:', err);
                            });

                            // Fetch sender data for future use
                            fetchSenderData();
                        } else {
                            // Same SOS - just update state (don't show duplicate notification)
                            setActiveSOS(sosData);
                        }
                    } else {
                        setActiveSOS(null);
                        setLastSOSId(null);
                    }
                },
                (error: any) => {
                    // If query fails due to missing index, use fallback
                    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
                        console.warn('SOS query requires index. Using fallback query.');
                        checkForActiveSOS();
                    } else {
                        console.warn('SOS listener error:', error.code || error.message);
                    }
                }
            );
        } catch (error: any) {
            // Query creation failed - try fallback
            checkForActiveSOS();
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [userData?.partnerId]);

    // 6. Listen to Pulse Signals from Partner (for real-time heart effects)
    // OPTIMIZED: Uses simple ID tracking and processes signals immediately
    const processedSignalIds = useRef<Set<string>>(new Set()); // Track processed signal IDs
    const listenerStartTime = useRef<number>(0); // Track when listener started (ignore older signals)

    useEffect(() => {
        if (!user || !userData?.partnerId) return;

        // Clear processed IDs and set start time when listener mounts
        processedSignalIds.current.clear();
        listenerStartTime.current = Date.now();

        console.log('💓 Setting up FAST pulse listener for partner:', userData.partnerId);

        // OPTIMIZED: Query only the most recent signals, ordered by timestamp
        // This requires a composite index but is MUCH faster for real-time updates
        const q = query(
            collection(db, 'signals'),
            where('toUserId', '==', user.uid),
            where('fromUserId', '==', userData.partnerId),
            where('type', '==', 'pulse'),
            orderBy('timestamp', 'desc'),
            limit(5) // Only need last few signals
        );

        let unsubscribeFallback: (() => void) | null = null;

        // OPTIMIZED: Simplified processing - no complex filtering
        const processSignals = (snapshot: any, isInitialLoad: boolean = false) => {
            if (snapshot.empty) return;

            // Get the newest signal (first doc due to orderBy desc)
            const newestDoc = snapshot.docs[0];
            const signalId = newestDoc.id;
            const signalData = newestDoc.data();
            const signalTimestamp = signalData.timestamp || Date.now();

            // Skip if already processed
            if (processedSignalIds.current.has(signalId)) return;

            // Skip old signals on initial load (only show new ones after listener started)
            if (isInitialLoad && signalTimestamp < listenerStartTime.current - 1000) {
                // Mark as processed so we don't process again
                processedSignalIds.current.add(signalId);
                return;
            }

            // Mark as processed immediately
            processedSignalIds.current.add(signalId);

            // Keep processed IDs set small (max 20)
            if (processedSignalIds.current.size > 20) {
                const idsArray = Array.from(processedSignalIds.current);
                processedSignalIds.current = new Set(idsArray.slice(-10));
            }

            // INSTANT: Trigger heart effects immediately!
            const now = Date.now();
            const timeSinceLastPulse = now - lastReceivedPulseTimeRef.current;
            const isRapidPulse = timeSinceLastPulse < 500;

            lastReceivedPulseTimeRef.current = now;
            setSingleHeartMode(!isRapidPulse);
            setHeartTrigger((prev: number) => prev + 1);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            console.log('💖 INSTANT pulse received!', { signalId, isRapidPulse, latency: now - signalTimestamp + 'ms' });
        };

        let isFirstSnapshot = true;

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                processSignals(snapshot, isFirstSnapshot);
                isFirstSnapshot = false;
            },
            (error: any) => {
                console.warn('Pulse signal listener error:', error.code || error.message);

                // Fallback: simpler query without orderBy (if index missing)
                if (error.code === 'failed-precondition' || error.message?.includes('index')) {
                    console.log('💓 Using fallback pulse listener (add Firestore index for better performance)');

                    const fallbackQ = query(
                        collection(db, 'signals'),
                        where('toUserId', '==', user.uid),
                        where('type', '==', 'pulse'),
                        limit(10)
                    );

                    let isFirstFallback = true;

                    unsubscribeFallback = onSnapshot(
                        fallbackQ,
                        (snapshot) => {
                            // Filter to partner's signals and sort by timestamp
                            const partnerDocs = snapshot.docs
                                .filter((docSnap: any) => docSnap.data().fromUserId === userData.partnerId)
                                .sort((a: any, b: any) => {
                                    const aTime = a.data().timestamp || 0;
                                    const bTime = b.data().timestamp || 0;
                                    return bTime - aTime;
                                });

                            if (partnerDocs.length > 0) {
                                const fakeSnapshot = { empty: false, docs: partnerDocs };
                                processSignals(fakeSnapshot, isFirstFallback);
                            }
                            isFirstFallback = false;
                        },
                        (fallbackError: any) => {
                            console.error('Pulse fallback listener also failed:', fallbackError);
                        }
                    );
                }
            }
        );

        return () => {
            unsubscribe();
            if (unsubscribeFallback) unsubscribeFallback();
        };
    }, [user?.uid, userData?.partnerId]);

    const handleLogout = async () => {
        // Set presence to offline before logging out
        if (user && userData?.pairId) {
            try {
                await PresenceService.setOffline(user.uid, userData.pairId);
                console.log('✅ Presence set to offline on logout');
            } catch (err) {
                console.warn('Failed to set presence offline on logout:', err);
            }
        }
        await signOut(auth);
    };

    const handleMoodSelect = async (mood: MoodType, note?: string, cause?: any) => {
        if (!user || updatingMood) return;
        setUpdatingMood(true);

        // Close modal immediately for better UX
        setShowMoodModal(false);

        try {
            // Get pairId - use existing or create from partnerId (with consistent format)
            const pairId = getPairId(user.uid, userData?.partnerId || '', userData?.pairId);

            if (!pairId) {
                console.warn('No pairId available for mood submission');
                setUpdatingMood(false);
                return;
            }

            // Submit mood using MoodService (non-blocking)
            MoodService.submitMood(user.uid, pairId, mood, note, cause)
                .then(() => {
                    console.log('Mood submitted successfully');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                })
                .catch((error) => {
                    console.error('Failed to submit mood:', error);
                    // Don't show blocking alert - just log
                })
                .finally(() => {
                    setUpdatingMood(false);
                });

            // Send Push Notification to Partner (non-blocking, fire and forget)
            if (partnerData?.pushToken) {
                const senderName = userData?.name || userData?.displayName || user.email?.split('@')[0] || 'Your partner';
                const moodEmojis: Record<MoodType, string> = {
                    happy: '😊',
                    calm: '😌',
                    neutral: '😐',
                    sad: '😢',
                    anxious: '😰',
                    excited: '🤩',
                    grateful: '🙏',
                    loved: '💕',
                };
                const emoji = moodEmojis[mood] || '😊';

                // Fire and forget - don't await
                sendPushNotification(
                    partnerData.pushToken,
                    "Vibe Update",
                    `${senderName} feels ${emoji}`
                ).catch((notifErr) => {
                    console.error('Failed to send notification (non-blocking):', notifErr);
                });
            }
        } catch (error) {
            console.error('Error in handleMoodSelect:', error);
            setUpdatingMood(false);
        }
    };

    const handleSignal = async (type: 'pulse' | 'sos') => {
        if (!user || !userData?.partnerId) {
            Alert.alert('Not Connected', 'You need to connect with your partner first.');
            return;
        }

        try {
            if (type === 'pulse') {
                // Detect if this is a rapid tap (within 500ms) or single tap
                const now = Date.now();
                const timeSinceLastPulse = now - lastPulseTimeRef.current;
                const isRapidTap = timeSinceLastPulse < 500; // Rapid if within 500ms

                // Update last pulse time
                lastPulseTimeRef.current = now;

                // Set single heart mode: true for single tap, false for rapid taps
                setSingleHeartMode(!isRapidTap);

                // Trigger heart effects IMMEDIATELY (don't wait for Firestore)
                setHeartTrigger((prev: number) => prev + 1);

                // Haptic feedback IMMEDIATELY
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                // Send pulse signal to Firestore
                // Use high-precision timestamp to ensure unique signals for rapid taps
                const signalData = {
                    fromUserId: user.uid,
                    toUserId: userData.partnerId,
                    type: 'pulse',
                    timestamp: now, // Client timestamp for immediate sync
                    createdAt: serverTimestamp(),
                    // Add a unique identifier to prevent any deduplication issues
                    signalId: `${user.uid}_${now}_${Math.random().toString(36).substr(2, 9)}`,
                };

                // Save to Firestore - use await to ensure it's sent before rapid taps
                // But don't block UI - fire and handle errors
                addDoc(collection(db, 'signals'), signalData)
                    .then(() => {
                        console.log('💗 Pulse signal sent to partner');
                    })
                    .catch((error) => {
                        console.warn('Failed to save pulse signal to Firestore:', error);
                        // Signal will still show locally, partner might not see it if offline
                    });

                // Don't show alert for pulse - just the hearts!
            } else if (type === 'sos') {
                // Show confirmation dialog first
                Alert.alert(
                    '🚨 Send SOS?',
                    'This will immediately notify your partner that you need them. They will receive an urgent notification and FaceTime will be launched if available.',
                    [
                        {
                            text: 'Cancel',
                            style: 'cancel',
                        },
                        {
                            text: 'SEND SOS',
                            style: 'destructive',
                            onPress: async () => {
                                setSendingSOS(true);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

                                try {
                                    // Check if partner data is loaded
                                    if (!partnerData) {
                                        setSendingSOS(false);
                                        Alert.alert(
                                            'Partner Data Not Loaded',
                                            'Please wait a moment for partner information to load, then try again.',
                                            [{ text: 'OK' }]
                                        );
                                        return;
                                    }

                                    const pairId = userData.pairId || (user.uid + '_' + userData.partnerId);

                                    // Debug: Log partner data to see what we have
                                    console.log('🔍 Partner Data Debug:', {
                                        partnerId: userData?.partnerId,
                                        hasPartnerData: !!partnerData,
                                        partnerDataKeys: partnerData ? Object.keys(partnerData) : [],
                                        partnerData: partnerData ? {
                                            email: partnerData.email,
                                            phoneNumber: partnerData.phoneNumber,
                                            phone: partnerData.phone,
                                            faceTimeContact: partnerData.faceTimeContact,
                                            faceTimeEmail: partnerData.faceTimeEmail,
                                            displayName: partnerData.displayName,
                                            name: partnerData.name
                                        } : null
                                    });

                                    // Smart contact handling:
                                    // - faceTimeContact: Email or phone for FaceTime (preferred)
                                    // - phoneNumber: Regular phone number for fallback calls
                                    const faceTimeContact = partnerData?.faceTimeContact || partnerData?.faceTimeEmail || partnerData?.email;
                                    const phoneNumber = partnerData?.phoneNumber || partnerData?.phone;

                                    // If no contact info found, show helpful error
                                    if (!faceTimeContact && !phoneNumber) {
                                        setSendingSOS(false);
                                        const partnerName = partnerData?.displayName || partnerData?.name || partnerData?.email?.split('@')[0] || 'Your partner';
                                        const partnerId = userData?.partnerId || 'Unknown';
                                        const partnerEmail = partnerData?.email || 'Unknown email';

                                        Alert.alert(
                                            'Contact Information Missing',
                                            `${partnerName}'s contact information is not available.\n\nTo fix this:\n1. Go to Firebase Console\n2. Firestore → users collection\n3. Find user with email: ${partnerEmail}\n4. Add fields: phoneNumber and/or faceTimeContact\n\nPartner User ID: ${partnerId}\nPartner Email: ${partnerEmail}`,
                                            [
                                                {
                                                    text: 'Copy User ID',
                                                    onPress: () => {
                                                        // Copy user ID to clipboard (if clipboard is available)
                                                        console.log('Partner User ID to copy:', partnerId);
                                                        Alert.alert('User ID', `Copy this User ID:\n\n${partnerId}\n\n(Check console if clipboard not available)`);
                                                    }
                                                },
                                                { text: 'OK' }
                                            ]
                                        );
                                        return;
                                    }

                                    console.log('📤 Sending SOS with:', {
                                        userId: user.uid,
                                        pairId,
                                        hasPushToken: !!partnerData?.pushToken,
                                        hasFaceTimeContact: !!faceTimeContact,
                                        faceTimeContact: faceTimeContact || 'NONE',
                                        hasPhoneNumber: !!phoneNumber,
                                        phoneNumber: phoneNumber ? 'SET' : 'NONE'
                                    });

                                    // Check internet before sending (for logging)
                                    const networkState = await NetInfo.fetch();
                                    const hasInternet = networkState.isConnected === true && networkState.isInternetReachable === true;
                                    console.log('🌐 Pre-SOS Internet Check:', {
                                        isConnected: networkState.isConnected,
                                        isInternetReachable: networkState.isInternetReachable,
                                        hasInternet: hasInternet
                                    });

                                    // If no internet, show informational message and proceed with call
                                    if (!hasInternet && phoneNumber) {
                                        const partnerName = partnerData?.displayName || partnerData?.name || partnerData?.email?.split('@')[0] || 'Your partner';

                                        // Proceed with SOS call immediately
                                        try {
                                            await SOSService.triggerSOS(
                                                user.uid,
                                                pairId,
                                                partnerData?.pushToken,
                                                userData?.name || userData?.displayName || user.email?.split('@')[0] || 'Your partner',
                                                faceTimeContact, // For FaceTime (email or number)
                                                phoneNumber,     // For regular phone call fallback
                                                'I need you right now!'
                                            );

                                            setSendingSOS(false);
                                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                                            // Show success message
                                            Alert.alert(
                                                '✅ SOS Sent',
                                                `Phone call launched. ${partnerName} will be notified when connection is restored.`,
                                                [{ text: 'OK' }]
                                            );
                                        } catch (sosError: any) {
                                            setSendingSOS(false);
                                            console.error('SOS failed:', sosError);
                                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                            Alert.alert(
                                                'SOS Error',
                                                sosError.message || 'Failed to send SOS. Please try again.',
                                                [{ text: 'OK' }]
                                            );
                                        }
                                        return; // Exit early
                                    }

                                    // Call SOS service - it will handle everything and return quickly
                                    // Note: faceTimeContact will be email if phoneNumber is not available
                                    await SOSService.triggerSOS(
                                        user.uid,
                                        pairId,
                                        partnerData?.pushToken,
                                        userData?.name || userData?.displayName || user.email?.split('@')[0] || 'Your partner',
                                        faceTimeContact, // For FaceTime (email or number)
                                        phoneNumber,     // For regular phone call fallback
                                        'I need you right now!'
                                    );

                                    // Clear loading state immediately after SOS call completes
                                    setSendingSOS(false);
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                                    Alert.alert(
                                        '✅ SOS Sent',
                                        'Your partner has been notified. They should respond soon.',
                                        [{ text: 'OK' }]
                                    );
                                } catch (sosError: any) {
                                    // Clear loading state immediately on error
                                    setSendingSOS(false);
                                    console.error('SOS failed:', sosError);
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

                                    // Show error message
                                    Alert.alert(
                                        'SOS Error',
                                        sosError.message || 'Failed to send SOS. Please try again.',
                                        [{ text: 'OK' }]
                                    );
                                }
                            },
                        },
                    ]
                );
            }
        } catch (error: any) {
            console.error('Signal failed:', error);
            Alert.alert('Error', error.message || 'Failed to send signal. Please try again.');
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    // Mock data for demo (replace with real data as needed)
    const currentTime = new Date();
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).toUpperCase();
    };

    // Next reunion date (example: 2 weeks from now)
    const reunionDate = new Date();
    reunionDate.setDate(reunionDate.getDate() + 12);

    return (
        <SwipeableTabWrapper tabIndex={0} totalTabs={4}>
            <View style={styles.container}>
                <SafeAreaView style={{ flex: 1 }}>
                    {/* Heart Effects Overlay */}
                    <HeartEffect trigger={heartTrigger} duration={3000} singleHeart={singleHeartMode} />

                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={theme.colors.primary}
                                colors={[theme.colors.primary]}
                            />
                        }
                    >
                        {/* HEADER */}
                        <SyncLogoHeader
                            onSettingsPress={() => router.push('/settings')}
                            onLogoutPress={handleLogout}
                        />

                        {/* SOS BANNER */}
                        {activeSOS && (
                            <TouchableOpacity
                                style={styles.sosBanner}
                                onPress={async () => {
                                    const senderName = senderData?.name || partnerData?.name || 'Your partner';
                                    Alert.alert(
                                        'SOS Alert',
                                        `${senderName} needs you right now!`,
                                        [
                                            { text: 'Dismiss', style: 'cancel' },
                                            {
                                                text: 'Call Partner',
                                                onPress: async () => {
                                                    const faceTimeContact = partnerData?.faceTimeContact || partnerData?.email;
                                                    if (faceTimeContact) {
                                                        await SOSService.launchFaceTime(faceTimeContact);
                                                    }
                                                    if (activeSOS?.id) {
                                                        await SOSService.markResponded(activeSOS.id);
                                                        setActiveSOS(null);
                                                    }
                                                },
                                            },
                                        ]
                                    );
                                }}
                            >
                                <Ionicons name="alert-circle" size={20} color="#fff" />
                                <Text style={styles.sosBannerText}>
                                    {senderData?.name || partnerData?.name || 'Partner'} needs you!
                                </Text>
                            </TouchableOpacity>
                        )}

                        {userData?.partnerId ? (
                            <>
                                {/* MOMENT OF THE DAY */}
                                <Text style={styles.momentSectionTitle}>Today's Moments</Text>
                                <TouchableOpacity
                                    style={styles.momentCard}
                                    onPress={handleAddMoment}
                                    activeOpacity={0.9}
                                >
                                    <View style={styles.momentSplitContainer}>
                                        {/* My Photo */}
                                        <View style={styles.momentPhotoHalf}>
                                            {MomentService.getUserPhoto(todayMoment, user?.uid || '') ? (
                                                <TouchableOpacity
                                                    activeOpacity={0.9}
                                                    onPress={() => {
                                                        const photo = MomentService.getUserPhoto(todayMoment, user?.uid || '');
                                                        if (photo) {
                                                            setSelectedPhotoUrl(photo.photoUrl);
                                                            setSelectedPhotoCaption(photo.caption);
                                                            setSelectedMomentId(photo.id);
                                                            setIsOwnPhoto(true);
                                                            setPhotoViewerVisible(true);
                                                        }
                                                    }}
                                                >
                                                    <Image
                                                        source={{ uri: MomentService.getUserPhoto(todayMoment, user?.uid || '')!.photoUrl }}
                                                        style={styles.momentPhoto}
                                                        resizeMode="cover"
                                                    />
                                                    {MomentService.getUserPhoto(todayMoment, user?.uid || '')?.caption && (
                                                        <View style={styles.momentCaptionOverlay}>
                                                            <Text style={styles.momentCaptionText}>
                                                                {MomentService.getUserPhoto(todayMoment, user?.uid || '')!.caption}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            ) : (
                                                <View style={styles.momentPlaceholder}>
                                                    <Ionicons name="camera-outline" size={32} color={theme.colors.textMuted} />
                                                    <Text style={styles.momentPlaceholderText}>Add your moment</Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Partner Photo */}
                                        <View style={styles.momentPhotoHalf}>
                                            {MomentService.getPartnerPhoto(todayMoment, user?.uid || '') ? (
                                                <TouchableOpacity
                                                    activeOpacity={0.9}
                                                    onPress={() => {
                                                        const photo = MomentService.getPartnerPhoto(todayMoment, user?.uid || '');
                                                        if (photo) {
                                                            setSelectedPhotoUrl(photo.photoUrl);
                                                            setSelectedPhotoCaption(photo.caption);
                                                            setSelectedMomentId(undefined);
                                                            setIsOwnPhoto(false);
                                                            setPhotoViewerVisible(true);
                                                        }
                                                    }}
                                                >
                                                    <Image
                                                        source={{ uri: MomentService.getPartnerPhoto(todayMoment, user?.uid || '')!.photoUrl }}
                                                        style={styles.momentPhoto}
                                                        resizeMode="cover"
                                                    />
                                                    {MomentService.getPartnerPhoto(todayMoment, user?.uid || '')?.caption && (
                                                        <View style={styles.momentCaptionOverlay}>
                                                            <Text style={styles.momentCaptionText}>
                                                                {MomentService.getPartnerPhoto(todayMoment, user?.uid || '')!.caption}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            ) : (
                                                <View style={styles.momentPlaceholder}>
                                                    <Ionicons name="time-outline" size={32} color={theme.colors.textMuted} />
                                                    <Text style={styles.momentPlaceholderText}>Waiting...</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                </TouchableOpacity>

                                {/* TIMEZONE CARDS */}
                                <View style={styles.timezoneRow}>
                                    {/* My City */}
                                    <TouchableOpacity
                                        style={styles.timezoneCard}
                                        onPress={!userData?.city ? handleLocationPermission : undefined}
                                        activeOpacity={userData?.city ? 1 : 0.7}
                                    >
                                        {loadingLocation ? (
                                            <ActivityIndicator size="small" color={theme.colors.primary} />
                                        ) : (
                                            <>
                                                <View style={styles.timezoneHeader}>
                                                    <Text style={styles.timezoneCity}>
                                                        {userData?.city?.toUpperCase() || 'TAP TO SET'}
                                                    </Text>
                                                    <Ionicons
                                                        name={LocationService.isDaytime(userData?.timezone || 'America/New_York') ? 'sunny-outline' : 'moon-outline'}
                                                        size={16}
                                                        color={theme.colors.textSecondary}
                                                    />
                                                </View>
                                                <Text style={styles.timezoneTime}>
                                                    {LocationService.formatTime(myTime)}
                                                </Text>
                                                {userData?.city ? (
                                                    myWeather ? (
                                                        <View style={styles.weatherRow}>
                                                            <Ionicons
                                                                name={WeatherService.getWeatherIcon(myWeather.condition, LocationService.isDaytime(userData?.timezone || 'America/New_York')) as any}
                                                                size={14}
                                                                color={WeatherService.getWeatherColor(myWeather.condition)}
                                                            />
                                                            <Text style={[styles.weatherText, myWeather.isSevere && styles.weatherSevere]}>
                                                                {Math.round(myWeather.temp)}°
                                                                <Text style={styles.feelsLikeText}>
                                                                    {' '}(feels {Math.round(myWeather.feelsLike)}°)
                                                                </Text>
                                                            </Text>
                                                        </View>
                                                    ) : loadingWeather ? (
                                                        <ActivityIndicator size="small" color={theme.colors.textMuted} />
                                                    ) : null
                                                ) : (
                                                    <Text style={styles.timezoneHint}>
                                                        <Ionicons name="location-outline" size={12} /> Enable location
                                                    </Text>
                                                )}
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    {/* Partner City */}
                                    <View style={styles.timezoneCard}>
                                        <View style={styles.timezoneHeader}>
                                            <Text style={styles.timezoneCity}>
                                                {partnerData?.city?.toUpperCase() || 'PARTNER'}
                                            </Text>
                                            <Ionicons
                                                name={LocationService.isDaytime(partnerData?.timezone || 'America/New_York') ? 'sunny-outline' : 'moon-outline'}
                                                size={16}
                                                color={theme.colors.textSecondary}
                                            />
                                        </View>
                                        <Text style={styles.timezoneTime}>
                                            {LocationService.formatTime(partnerTime)}
                                        </Text>
                                        {partnerWeather ? (
                                            <View style={styles.weatherRow}>
                                                <Ionicons
                                                    name={WeatherService.getWeatherIcon(partnerWeather.condition, LocationService.isDaytime(partnerData?.timezone || 'America/New_York')) as any}
                                                    size={14}
                                                    color={WeatherService.getWeatherColor(partnerWeather.condition)}
                                                />
                                                <Text style={[styles.weatherText, partnerWeather.isSevere && styles.weatherSevere]}>
                                                    {Math.round(partnerWeather.temp)}°
                                                    <Text style={styles.feelsLikeText}>
                                                        {' '}(feels {Math.round(partnerWeather.feelsLike)}°)
                                                    </Text>
                                                </Text>
                                                {partnerWeather.isSevere && (
                                                    <Ionicons name="warning" size={12} color={theme.colors.error} />
                                                )}
                                            </View>
                                        ) : partnerData?.city ? (
                                            <Text style={styles.timezoneRegion}>
                                                {partnerData?.region || ''}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>


                                {/* OUR MOODS SECTION */}
                                <View style={styles.moodsSection}>
                                    <Text style={styles.sectionTitle}>Our Moods</Text>
                                    <View style={styles.moodsRow}>
                                        {/* Your Mood */}
                                        <TouchableOpacity
                                            style={styles.moodItem}
                                            onPress={() => setShowMoodModal(true)}
                                        >
                                            <View style={styles.moodAvatarContainer}>
                                                <View style={styles.moodAvatar}>
                                                    <Text style={styles.moodAvatarText}>
                                                        {userData?.name?.charAt(0) || '?'}
                                                    </Text>
                                                </View>
                                                {todaysMood && (
                                                    <View style={styles.moodBadge}>
                                                        <Text style={styles.moodEmoji}>{todaysMood}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.moodLabel}>
                                                {todaysMood ? 'Feeling Good' : 'Set Mood'}
                                            </Text>
                                            <Text style={styles.moodName}>
                                                {userData?.name?.split(' ')[0] || 'You'}
                                            </Text>
                                        </TouchableOpacity>

                                        {/* Partner Mood */}
                                        <View style={styles.moodItem}>
                                            <View style={styles.moodAvatarContainer}>
                                                <View style={[styles.moodAvatar, styles.moodAvatarPartner]}>
                                                    <Text style={styles.moodAvatarText}>
                                                        {partnerData?.name?.charAt(0) || '?'}
                                                    </Text>
                                                </View>
                                                {partnerMood && (
                                                    <View style={styles.moodBadge}>
                                                        <Text style={styles.moodEmoji}>{partnerMood.emoji}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.moodLabel}>
                                                {partnerMood?.label || 'No mood yet'}
                                            </Text>
                                            <Text style={styles.moodNamePartner}>
                                                {partnerData?.name?.split(' ')[0] || 'Partner'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* DAILY ECHO PROMPT */}
                                <View style={styles.dailyEchoCard}>
                                    <View style={styles.dailyEchoHeader}>
                                        <View style={styles.dailyEchoIcon}>
                                            <Ionicons name="chatbubble-ellipses" size={18} color={theme.colors.primary} />
                                        </View>
                                        <Text style={styles.dailyEchoLabel}>DAILY ECHO</Text>
                                        {DailyEchoService.hasUserAnswered(dailyEcho, user?.uid || '') && (
                                            <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} style={{ marginLeft: 'auto' }} />
                                        )}
                                    </View>
                                    <Text style={styles.dailyEchoQuestion}>
                                        {dailyEcho?.question || "What's one thing that made you think of me today?"}
                                    </Text>

                                    {!DailyEchoService.hasUserAnswered(dailyEcho, user?.uid || '') ? (
                                        <TouchableOpacity onPress={() => setShowEchoAnswerModal(true)}>
                                            <Text style={styles.dailyEchoAction}>Answer now →</Text>
                                        </TouchableOpacity>
                                    ) : DailyEchoService.canReveal(dailyEcho!) && DailyEchoService.haveBothAnswered(dailyEcho) ? (
                                        <TouchableOpacity onPress={handleRevealEcho} style={styles.revealButton}>
                                            <Ionicons name="eye" size={16} color="#FFF" />
                                            <Text style={styles.revealButtonText}>Reveal Answers</Text>
                                        </TouchableOpacity>
                                    ) : DailyEchoService.haveBothAnswered(dailyEcho) ? (
                                        <View style={styles.countdownContainer}>
                                            <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
                                            <Text style={styles.countdownText}>
                                                Reveals in {DailyEchoService.formatCountdown(echoCountdown)}
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.waitingText}>
                                            <Ionicons name="hourglass-outline" size={12} /> Waiting for partner...
                                        </Text>
                                    )}
                                </View>

                                {/* SIGNAL BUTTON */}
                                <View style={styles.signalSection}>
                                    {sendingSOS ? (
                                        <View style={styles.sosLoadingContainer}>
                                            <ActivityIndicator size="large" color={theme.colors.error} />
                                            <Text style={styles.sosLoadingText}>Sending SOS...</Text>
                                        </View>
                                    ) : (
                                        <SignalButton onSendSignal={handleSignal} />
                                    )}
                                </View>
                            </>
                        ) : (
                            /* UNLINKED STATE */
                            <View style={styles.unlinkedContainer}>
                                <View style={styles.unlinkedCard}>
                                    <Text style={styles.unlinkedEmoji}>💕</Text>
                                    <Text style={styles.unlinkedTitle}>Echoes of Us</Text>
                                    <Text style={styles.unlinkedText}>
                                        Connect with your partner to share moods, memories, and stay close no matter the distance.
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.connectButton}
                                        onPress={() => router.push('/invite')}
                                    >
                                        <Text style={styles.connectButtonText}>Connect Partner</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* MOOD SELECTION MODAL */}
                    <MoodSelector
                        visible={showMoodModal}
                        onClose={() => setShowMoodModal(false)}
                        onSubmit={handleMoodSelect}
                        loading={updatingMood}
                    />

                    {/* PHOTO VIEWER MODAL */}
                    <PhotoViewerModal
                        visible={photoViewerVisible}
                        photoUrl={selectedPhotoUrl}
                        caption={selectedPhotoCaption}
                        momentId={selectedMomentId}
                        isOwnPhoto={isOwnPhoto}
                        userId={user?.uid}
                        onClose={() => setPhotoViewerVisible(false)}
                        onCaptionUpdated={(newCaption) => {
                            setSelectedPhotoCaption(newCaption);
                            // Refresh moments to get updated caption
                            if (user?.uid && userData?.partnerId) {
                                MomentService.getTodayMoment(user.uid, userData.partnerId)
                                    .then(setTodayMoment);
                            }
                        }}
                        onReplacePhoto={() => {
                            // Trigger the add moment flow to pick a new photo
                            handleAddMoment();
                        }}
                    />

                    {/* CAPTION INPUT MODAL */}
                    <Modal visible={showCaptionInput} transparent animationType="fade">
                        <Pressable
                            style={styles.overlay}
                            onPress={() => {
                                Keyboard.dismiss();
                                if (!uploadingMoment) setShowCaptionInput(false);
                            }}
                        >
                            <Pressable onPress={(e) => e.stopPropagation()} style={styles.captionModal}>
                                <Text style={styles.captionModalTitle}>Add Caption</Text>
                                {selectedImageUri && (
                                    <Image source={{ uri: selectedImageUri }} style={styles.captionPreview} resizeMode="cover" />
                                )}
                                <Text style={styles.captionLabel}>Caption (optional)</Text>
                                <TextInput
                                    style={styles.captionTextInput}
                                    placeholder="What's your moment?"
                                    placeholderTextColor={theme.colors.textMuted}
                                    value={momentCaption}
                                    onChangeText={setMomentCaption}
                                    maxLength={50}
                                    multiline
                                    returnKeyType="done"
                                    blurOnSubmit={true}
                                    onSubmitEditing={() => Keyboard.dismiss()}
                                />
                                <TouchableOpacity
                                    style={[styles.uploadButton, uploadingMoment && styles.uploadButtonDisabled]}
                                    onPress={handleUploadMoment}
                                    disabled={uploadingMoment}
                                >
                                    {uploadingMoment ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.uploadButtonText}>Upload Moment</Text>
                                    )}
                                </TouchableOpacity>
                            </Pressable>
                        </Pressable>
                    </Modal>

                    {/* DAILY ECHO ANSWER MODAL */}
                    <Modal visible={showEchoAnswerModal} transparent animationType="fade">
                        <Pressable style={styles.overlay} onPress={() => !submittingEcho && setShowEchoAnswerModal(false)}>
                            <Pressable onPress={(e) => e.stopPropagation()} style={styles.captionModal}>
                                <Text style={styles.captionModalTitle}>Daily Echo</Text>
                                <Text style={[styles.dailyEchoQuestion, { marginBottom: theme.spacing.md }]}>
                                    {dailyEcho?.question}
                                </Text>
                                <TextInput
                                    style={styles.captionTextInput}
                                    placeholder="Share your thoughts..."
                                    placeholderTextColor={theme.colors.textMuted}
                                    value={echoAnswer}
                                    onChangeText={setEchoAnswer}
                                    maxLength={200}
                                    multiline
                                    autoFocus
                                />
                                <TouchableOpacity
                                    style={[styles.uploadButton, submittingEcho && styles.uploadButtonDisabled]}
                                    onPress={handleSubmitEchoAnswer}
                                    disabled={submittingEcho || !echoAnswer.trim()}
                                >
                                    {submittingEcho ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.uploadButtonText}>Submit Answer</Text>
                                    )}
                                </TouchableOpacity>
                            </Pressable>
                        </Pressable>
                    </Modal>

                    {/* DAILY ECHO REVEAL MODAL */}
                    <Modal visible={showEchoRevealModal} transparent animationType="fade">
                        <Pressable style={styles.overlay} onPress={() => setShowEchoRevealModal(false)}>
                            <Pressable onPress={(e) => e.stopPropagation()} style={styles.revealModal}>
                                <View style={styles.revealHeader}>
                                    <Ionicons name="chatbubble-ellipses" size={24} color={theme.colors.primary} />
                                    <Text style={styles.revealModalTitle}>Today's Answers</Text>
                                </View>

                                <Text style={styles.revealQuestion}>{dailyEcho?.question}</Text>

                                <View style={styles.answerSection}>
                                    <View style={styles.answerHeader}>
                                        <View style={styles.answerAvatar}>
                                            <Text style={styles.answerAvatarText}>
                                                {userData?.name?.charAt(0) || '?'}
                                            </Text>
                                        </View>
                                        <Text style={styles.answerName}>{userData?.name?.split(' ')[0] || 'You'}</Text>
                                    </View>
                                    <Text style={styles.answerText}>
                                        {DailyEchoService.getUserAnswer(dailyEcho, user?.uid || '') || 'No answer'}
                                    </Text>
                                </View>

                                <View style={styles.answerSection}>
                                    <View style={styles.answerHeader}>
                                        <View style={[styles.answerAvatar, styles.answerAvatarPartner]}>
                                            <Text style={styles.answerAvatarText}>
                                                {partnerData?.name?.charAt(0) || '?'}
                                            </Text>
                                        </View>
                                        <Text style={styles.answerName}>{partnerData?.name?.split(' ')[0] || 'Partner'}</Text>
                                    </View>
                                    <Text style={styles.answerText}>
                                        {DailyEchoService.getPartnerAnswer(dailyEcho, user?.uid || '') || 'No answer'}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.closeRevealButton}
                                    onPress={() => setShowEchoRevealModal(false)}
                                >
                                    <Text style={styles.closeRevealButtonText}>Close</Text>
                                </TouchableOpacity>
                            </Pressable>
                        </Pressable>
                    </Modal>
                </SafeAreaView>
            </View>
        </SwipeableTabWrapper>
    );
}

const styles = StyleSheet.create({
    // ═══════════════════════════════════════════
    // ECHOES OF US - Dark Theme
    // ═══════════════════════════════════════════

    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },

    // Loading
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    loadingText: {
        marginTop: 16,
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.textSecondary,
    },

    scrollContent: {
        paddingHorizontal: theme.spacing.md,
        paddingBottom: theme.spacing['2xl'],
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.md,
    },
    headerTitle: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: '600',
        color: theme.colors.text,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },

    // SOS Banner
    sosBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.error,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        marginBottom: theme.spacing.md,
        gap: theme.spacing.sm,
    },
    sosBannerText: {
        color: '#fff',
        fontSize: theme.typography.fontSize.md,
        fontWeight: '600',
        flex: 1,
    },

    // Moment Card - Split Screen Photo
    momentSectionTitle: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        letterSpacing: 0.5,
        marginBottom: theme.spacing.xs,
        textTransform: 'uppercase',
    },
    momentCard: {
        height: 240,
        borderRadius: theme.borderRadius['2xl'],
        backgroundColor: theme.colors.surface,
        marginBottom: theme.spacing.md,
        overflow: 'hidden',
        ...theme.shadows.md,
    },
    momentSplitContainer: {
        flexDirection: 'row',
        flex: 1,
    },
    momentPhotoHalf: {
        flex: 1,
        position: 'relative',
    },
    momentPhoto: {
        width: '100%',
        height: '100%',
    },
    momentCaptionOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: theme.spacing.sm,
    },
    momentCaptionText: {
        fontSize: theme.typography.fontSize.sm,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    momentPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.backgroundAlt,
    },
    momentPlaceholderText: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textMuted,
        marginTop: theme.spacing.xs,
    },
    momentBottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingVertical: theme.spacing.xs,
        alignItems: 'center',
    },
    momentBottomTitle: {
        fontSize: theme.typography.fontSize.md,
        fontWeight: '600',
        color: '#FFFFFF',
        letterSpacing: 1,
    },

    // Timezone Cards
    timezoneRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.md,
    },
    timezoneCard: {
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.md,
    },
    timezoneHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.xs,
    },
    timezoneCity: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: '600',
        color: theme.colors.primary,
        letterSpacing: 1,
    },
    timezoneTime: {
        fontSize: theme.typography.fontSize['2xl'],
        fontWeight: '500',
        color: theme.colors.text,
    },
    timezoneWeather: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
        marginTop: 2,
    },
    timezoneHint: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.primary,
        marginTop: 4,
    },
    timezoneRegion: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.textMuted,
        marginTop: 2,
    },
    weatherRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    weatherText: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
        fontWeight: '500',
    },
    weatherSevere: {
        color: theme.colors.error,
        fontWeight: '600',
    },
    feelsLikeText: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.textMuted,
        fontWeight: '400',
    },


    // Countdown
    countdownCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius['2xl'],
        padding: theme.spacing.lg,
        alignItems: 'center',
        marginBottom: theme.spacing.md,
    },
    countdownLabel: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        letterSpacing: 2,
        marginBottom: theme.spacing.md,
    },
    countdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    countdownBlock: {
        alignItems: 'center',
        minWidth: 50,
    },
    countdownNumber: {
        fontSize: theme.typography.fontSize['4xl'],
        fontWeight: '300',
        color: theme.colors.text,
    },
    countdownUnit: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: '500',
        color: theme.colors.textSecondary,
        marginTop: 4,
        letterSpacing: 1,
    },
    countdownSeparator: {
        fontSize: theme.typography.fontSize['3xl'],
        fontWeight: '300',
        color: theme.colors.textMuted,
        marginHorizontal: theme.spacing.sm,
        paddingBottom: 16,
    },
    countdownQuote: {
        fontSize: theme.typography.fontSize.sm,
        fontStyle: 'italic',
        color: theme.colors.textSecondary,
        marginTop: theme.spacing.md,
    },

    // Moods Section
    moodsSection: {
        marginBottom: theme.spacing.md,
    },
    sectionTitle: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
    },
    moodsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    moodItem: {
        alignItems: 'center',
    },
    moodAvatarContainer: {
        position: 'relative',
        marginBottom: theme.spacing.sm,
    },
    moodAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: theme.colors.primary,
    },
    moodAvatarPartner: {
        borderColor: theme.colors.accentPink,
    },
    moodAvatarText: {
        fontSize: theme.typography.fontSize.xl,
        fontWeight: '600',
        color: theme.colors.text,
    },
    moodBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        padding: 2,
    },
    moodEmoji: {
        fontSize: 18,
    },
    moodLabel: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: '500',
        color: theme.colors.text,
        marginBottom: 2,
    },
    moodName: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.primary,
    },
    moodNamePartner: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.accentPink,
    },

    // Daily Echo
    dailyEchoCard: {
        backgroundColor: theme.colors.surfaceElevated,
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.md,
    },
    dailyEchoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.sm,
    },
    dailyEchoIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dailyEchoLabel: {
        fontSize: theme.typography.fontSize.xs,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        letterSpacing: 1,
    },
    dailyEchoQuestion: {
        fontSize: theme.typography.fontSize.md,
        color: theme.colors.text,
        lineHeight: 22,
        marginBottom: theme.spacing.sm,
    },
    dailyEchoAction: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: '600',
        color: theme.colors.primary,
    },
    revealButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        backgroundColor: theme.colors.primary,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        marginTop: theme.spacing.xs,
    },
    revealButtonText: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    countdownContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: theme.spacing.xs,
    },
    countdownText: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textMuted,
        fontWeight: '500',
    },
    waitingText: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textMuted,
        fontStyle: 'italic',
        marginTop: theme.spacing.xs,
    },

    // Daily Echo Reveal Modal
    revealModal: {
        width: '90%',
        maxWidth: 500,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius['2xl'],
        padding: theme.spacing.xl,
        maxHeight: '80%',
    },
    revealHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.md,
    },
    revealModalTitle: {
        fontSize: theme.typography.fontSize['2xl'],
        fontWeight: '700',
        color: theme.colors.text,
    },
    revealQuestion: {
        fontSize: theme.typography.fontSize.md,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.lg,
        fontStyle: 'italic',
    },
    answerSection: {
        backgroundColor: theme.colors.backgroundAlt,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
    },
    answerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.sm,
    },
    answerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: theme.colors.primary,
    },
    answerAvatarPartner: {
        borderColor: theme.colors.accentPink,
    },
    answerAvatarText: {
        fontSize: theme.typography.fontSize.sm,
        fontWeight: '600',
        color: theme.colors.text,
    },
    answerName: {
        fontSize: theme.typography.fontSize.base,
        fontWeight: '600',
        color: theme.colors.text,
    },
    answerText: {
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.text,
        lineHeight: 22,
    },
    closeRevealButton: {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: theme.borderRadius.lg,
        paddingVertical: theme.spacing.md,
        alignItems: 'center',
        marginTop: theme.spacing.sm,
    },
    closeRevealButtonText: {
        fontSize: theme.typography.fontSize.md,
        fontWeight: '600',
        color: theme.colors.text,
    },

    // Signal Section
    signalSection: {
        marginTop: theme.spacing.sm,
    },
    sosLoadingContainer: {
        alignItems: 'center',
        padding: theme.spacing.lg,
    },
    sosLoadingText: {
        marginTop: theme.spacing.sm,
        color: theme.colors.error,
        fontWeight: '500',
    },

    // Unlinked State
    unlinkedContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: theme.spacing['2xl'],
    },
    unlinkedCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius['2xl'],
        padding: theme.spacing.xl,
        alignItems: 'center',
    },
    unlinkedEmoji: {
        fontSize: 64,
        marginBottom: theme.spacing.md,
    },
    unlinkedTitle: {
        fontSize: theme.typography.fontSize['2xl'],
        fontWeight: '700',
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
    },
    unlinkedText: {
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: theme.spacing.lg,
        lineHeight: 22,
    },
    connectButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        borderRadius: theme.borderRadius.xl,
    },
    connectButtonText: {
        color: theme.colors.text,
        fontWeight: '700',
        fontSize: theme.typography.fontSize.base,
    },

    // Caption Modal
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.lg,
    },
    captionModal: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius['2xl'],
        padding: theme.spacing.lg,
    },
    captionModalTitle: {
        fontSize: theme.typography.fontSize['2xl'],
        fontWeight: '700',
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
    },
    captionPreview: {
        width: '100%',
        height: 200,
        borderRadius: theme.borderRadius.xl,
        marginBottom: theme.spacing.md,
    },
    captionLabel: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.xs,
    },
    captionTextInput: {
        backgroundColor: theme.colors.backgroundAlt,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        fontSize: theme.typography.fontSize.md,
        color: theme.colors.text,
        minHeight: 80,
        marginBottom: theme.spacing.md,
        textAlignVertical: 'top',
    },
    uploadButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.xl,
        paddingVertical: theme.spacing.md,
        alignItems: 'center',
    },
    uploadButtonDisabled: {
        opacity: 0.6,
    },
    uploadButtonText: {
        color: '#FFFFFF',
        fontSize: theme.typography.fontSize.md,
        fontWeight: '600',
    },
});
