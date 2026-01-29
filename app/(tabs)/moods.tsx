import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Animated, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WobblySquare, WobblyCard, WobblyCircle, NoPartnerState } from '../../src/components/doodle';
import { useAuth } from '../../src/contexts/AuthContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, onSnapshot, getDoc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { MoodService, Mood, MoodType, MoodCause, MoodReaction, MOOD_CAUSES, MOOD_REACTIONS } from '../../src/services/mood.service';
import MoodSelector from '../../src/components/MoodSelector';
import { theme } from '../../src/config/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { sendPushNotification } from '../../src/utils/notifications';

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

const moodLabels: Record<MoodType, string> = {
  happy: 'Happy',
  calm: 'Calm',
  neutral: 'Neutral',
  sad: 'Sad',
  anxious: 'Anxious',
  excited: 'Excited',
  grateful: 'Grateful',
  loved: 'Loved',
};

const moodColors: Record<MoodType, string> = {
  happy: theme.colors.moodHappy,
  calm: theme.colors.moodCalm,
  neutral: theme.colors.moodNeutral,
  sad: theme.colors.moodSad,
  anxious: theme.colors.moodAnxious,
  excited: theme.colors.accent,
  grateful: theme.colors.primary,
  loved: theme.colors.primary,
};

function formatTimeAgo(timestamp: any): string {
  if (!timestamp) return 'just now';

  const now = new Date();
  const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return time.toLocaleDateString();
}

// Format full date and time for timeline
function formatDateTime(timestamp: any): { date: string; time: string } {
  if (!timestamp) return { date: 'Today', time: 'just now' };

  const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const isToday = time.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = time.toDateString() === yesterday.toDateString();

  // Format time as "2:30 PM"
  const timeStr = time.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Format date
  let dateStr: string;
  if (isToday) {
    dateStr = 'Today';
  } else if (isYesterday) {
    dateStr = 'Yesterday';
  } else {
    // Format as "Mon, Jan 13"
    dateStr = time.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  return { date: dateStr, time: timeStr };
}

// Mood sync messages based on both moods
const getMoodSyncMessage = (myMood: MoodType | null, partnerMood: MoodType | null): { message: string; emoji: string; color: string } | null => {
  if (!myMood || !partnerMood) return null;

  const happyMoods = ['happy', 'excited', 'loved', 'grateful'];
  const calmMoods = ['calm', 'neutral'];
  const needsSupportMoods = ['sad', 'anxious'];

  const bothHappy = happyMoods.includes(myMood) && happyMoods.includes(partnerMood);
  const bothNeedSupport = needsSupportMoods.includes(myMood) && needsSupportMoods.includes(partnerMood);
  const partnerNeedsSupport = needsSupportMoods.includes(partnerMood);
  const iNeedSupport = needsSupportMoods.includes(myMood);
  const bothCalm = calmMoods.includes(myMood) && calmMoods.includes(partnerMood);

  if (bothHappy) {
    return { message: "You're both radiating joy! 🎉", emoji: '✨', color: '#4CAF50' };
  }
  if (myMood === 'loved' && partnerMood === 'loved') {
    return { message: "Love is in the air! 💕", emoji: '💞', color: '#E91E63' };
  }
  if (bothCalm) {
    return { message: "Peaceful vibes together 🧘", emoji: '☮️', color: '#00BCD4' };
  }
  if (bothNeedSupport) {
    return { message: "Lean on each other today 🤝", emoji: '💙', color: '#2196F3' };
  }
  if (partnerNeedsSupport && happyMoods.includes(myMood)) {
    return { message: "Your partner could use your sunshine ☀️", emoji: '🤗', color: '#FF9800' };
  }
  if (iNeedSupport && happyMoods.includes(partnerMood)) {
    return { message: "Your partner is here for you 💪", emoji: '❤️', color: '#E91E63' };
  }
  return null;
};

export default function MoodsScreen() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [partnerData, setPartnerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [submittingMood, setSubmittingMood] = useState(false);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [todayMood, setTodayMood] = useState<Mood | null>(null);
  const [partnerTodayMood, setPartnerTodayMood] = useState<Mood | null>(null);
  const [moodStreak, setMoodStreak] = useState(0);
  const [partnerMoodStreak, setPartnerMoodStreak] = useState(0);
  const [insights, setInsights] = useState<{
    userHappyDays: number;
    partnerHappyDays: number;
    syncedDays: number;
    topUserMood: MoodType | null;
    topPartnerMood: MoodType | null;
    lovedMoments: number;
    totalMoods: number;
  } | null>(null);
  const [sendingReaction, setSendingReaction] = useState<string | null>(null);
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const heartScaleAnim = useRef(new Animated.Value(1)).current;
  const heartRotateAnim = useRef(new Animated.Value(0)).current;

  // Keep reference for MOOD_REACTIONS animation (used in handleReaction)
  const reactionScaleAnims = useRef<{ [key: string]: Animated.Value }>({ heart: heartScaleAnim }).current;
  const reactionRotateAnims = useRef<{ [key: string]: Animated.Value }>({ heart: heartRotateAnim }).current;
  const [showHistory, setShowHistory] = useState(false);

  const ALL_MOODS: MoodType[] = ['happy', 'calm', 'neutral', 'sad', 'anxious', 'excited', 'grateful', 'loved'];

  // Define functions before using them in useEffect
  const loadMoodTimeline = useCallback(async (pairId: string) => {
    try {
      const timeline = await MoodService.getMoodTimeline(pairId, 50);
      setMoods(timeline);
    } catch (error) {
      console.error('Error loading mood timeline:', error);
    }
  }, []);

  const loadTodayMoods = useCallback(async (userId: string, pairId: string, partnerId?: string) => {
    try {
      const myMood = await MoodService.getTodayMood(userId, pairId);
      setTodayMood(myMood);

      if (partnerId) {
        const partnerMood = await MoodService.getTodayMood(partnerId, pairId);
        setPartnerTodayMood(partnerMood);
      }
    } catch (error) {
      console.error('Error loading today moods:', error);
    }
  }, []);

  const calculateStreaks = useCallback(async (pairId: string, userId: string, partnerId?: string) => {
    try {
      const allMoods = await MoodService.getMoodTimeline(pairId, 100);

      // Calculate user streak
      const userMoods = allMoods.filter(m => m.userId === userId);
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < userMoods.length; i++) {
        const moodDate = userMoods[i].createdAt?.toDate ? userMoods[i].createdAt.toDate() : new Date(userMoods[i].createdAt);
        moodDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today.getTime() - moodDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === streak) {
          streak++;
        } else {
          break;
        }
      }
      setMoodStreak(streak);

      // Calculate partner streak
      if (partnerId) {
        const partnerMoods = allMoods.filter(m => m.userId === partnerId);
        let partnerStreak = 0;

        for (let i = 0; i < partnerMoods.length; i++) {
          const moodDate = partnerMoods[i].createdAt?.toDate ? partnerMoods[i].createdAt.toDate() : new Date(partnerMoods[i].createdAt);
          moodDate.setHours(0, 0, 0, 0);
          const daysDiff = Math.floor((today.getTime() - moodDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysDiff === partnerStreak) {
            partnerStreak++;
          } else {
            break;
          }
        }
        setPartnerMoodStreak(partnerStreak);
      }
    } catch (error) {
      console.error('Error calculating streaks:', error);
    }
  }, []);

  // Load mood insights
  const loadInsights = useCallback(async (pairId: string, userId: string, partnerId: string) => {
    try {
      const data = await MoodService.getMoodInsights(pairId, userId, partnerId);
      setInsights(data);
    } catch (error) {
      console.error('Error loading insights:', error);
    }
  }, []);

  // Load user data and pair info
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserData(data);

        // Load partner data
        if (data.partnerId) {
          try {
            const partnerDoc = await getDoc(doc(db, 'users', data.partnerId));
            if (partnerDoc.exists()) {
              setPartnerData(partnerDoc.data());
            }
          } catch (error) {
            console.error('Error loading partner data:', error);
          }
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Helper function to create consistent pairId from two user IDs
  const getPairId = useCallback((uid1: string, uid2: string, storedPairId?: string): string => {
    if (storedPairId) return storedPairId;
    // Sort IDs alphabetically to ensure both users get the same pairId
    const [id1, id2] = [uid1, uid2].sort();
    return `${id1}_${id2}`;
  }, []);

  // Set up real-time mood listeners when userData is available
  useEffect(() => {
    if (!user || !userData?.partnerId) return;

    const pairId = getPairId(user.uid, userData.partnerId, userData.pairId);
    if (!pairId) return;

    // Real-time listener for mood timeline
    let moodsQuery;
    try {
      moodsQuery = query(
        collection(db, 'moods'),
        where('pairId', '==', pairId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    } catch (error) {
      // If orderBy fails (missing index), try without orderBy
      console.warn('Timeline query with orderBy failed, trying without:', error);
      moodsQuery = query(
        collection(db, 'moods'),
        where('pairId', '==', pairId),
        limit(50)
      );
    }

    const unsubscribeTimeline = onSnapshot(
      moodsQuery,
      (snapshot) => {
        const timeline = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Mood[];

        // Sort manually if orderBy didn't work
        timeline.sort((a, b) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
          return bTime - aTime;
        });

        console.log('📊 Timeline updated:', {
          totalMoods: timeline.length,
          myMoods: timeline.filter(m => m.userId === user.uid).length,
          partnerMoods: timeline.filter(m => m.userId === userData.partnerId).length,
          pairId: pairId,
        });

        setMoods(timeline);
      },
      (error: any) => {
        console.error('❌ Error loading mood timeline:', error);
        // Try fallback query without orderBy
        if (error.code === 'failed-precondition' || error.code === 9) {
          console.log('⚠️ Trying fallback timeline query without orderBy...');
          const fallbackQuery = query(
            collection(db, 'moods'),
            where('pairId', '==', pairId),
            limit(50)
          );
          const unsubscribeFallback = onSnapshot(
            fallbackQuery,
            (snapshot) => {
              const timeline = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
              })) as Mood[];

              timeline.sort((a, b) => {
                const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
                const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
                return bTime - aTime;
              });

              console.log('✅ Fallback timeline loaded:', {
                totalMoods: timeline.length,
                myMoods: timeline.filter(m => m.userId === user.uid).length,
                partnerMoods: timeline.filter(m => m.userId === userData.partnerId).length,
              });

              setMoods(timeline);
            },
            (fallbackError) => {
              console.error('❌ Fallback timeline query also failed:', fallbackError);
            }
          );

          // Clean up fallback listener on component unmount
          return unsubscribeFallback;
        }
      }
    );

    // Real-time listener for today's mood (user)
    let todayQuery;
    try {
      todayQuery = query(
        collection(db, 'moods'),
        where('pairId', '==', pairId),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
    } catch (error) {
      todayQuery = query(
        collection(db, 'moods'),
        where('pairId', '==', pairId),
        where('userId', '==', user.uid),
        limit(10)
      );
    }

    const unsubscribeToday = onSnapshot(
      todayQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          // Get most recent mood
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as Mood[];

          // Sort by createdAt if not already sorted
          docs.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
            return bTime - aTime;
          });

          const moodData = docs[0];
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Properly parse Firestore timestamp
          let moodDate: Date;
          if (moodData.createdAt?.toDate) {
            moodDate = moodData.createdAt.toDate();
          } else if (moodData.createdAt?.seconds) {
            moodDate = new Date(moodData.createdAt.seconds * 1000);
          } else {
            moodDate = new Date(moodData.createdAt);
          }

          const moodDateOnly = new Date(moodDate);
          moodDateOnly.setHours(0, 0, 0, 0);

          console.log('🎯 Today Mood Check:', {
            moodType: moodData.mood,
            rawCreatedAt: moodData.createdAt,
            parsedMoodDate: moodDate.toISOString(),
            today: today.toISOString(),
            match: moodDateOnly.getTime() === today.getTime()
          });

          // Check if mood is from today
          if (moodDateOnly.getTime() === today.getTime()) {
            setTodayMood(moodData);
          } else {
            setTodayMood(null);
          }
        } else {
          setTodayMood(null);
        }
        // Recalculate streaks when today's mood changes
        calculateStreaks(pairId, user.uid, userData.partnerId);
      },
      (error: any) => {
        console.error('Error loading today mood:', error);
        // Try fallback without orderBy
        if (error.code === 'failed-precondition') {
          const fallbackQuery = query(
            collection(db, 'moods'),
            where('pairId', '==', pairId),
            where('userId', '==', user.uid),
            limit(10)
          );
          onSnapshot(
            fallbackQuery,
            (snapshot) => {
              if (!snapshot.empty) {
                const docs = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data(),
                })) as Mood[];
                docs.sort((a, b) => {
                  const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
                  const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
                  return bTime - aTime;
                });
                const moodData = docs[0];
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const moodDate = moodData.createdAt?.toDate ? moodData.createdAt.toDate() : new Date(moodData.createdAt);
                moodDate.setHours(0, 0, 0, 0);
                if (moodDate.getTime() === today.getTime()) {
                  setTodayMood(moodData);
                } else {
                  setTodayMood(null);
                }
              } else {
                setTodayMood(null);
              }
            },
            (fallbackError) => {
              console.error('Fallback today mood query also failed:', fallbackError);
            }
          );
        }
      }
    );

    // Real-time listener for partner's today mood
    let partnerTodayQuery;
    try {
      partnerTodayQuery = query(
        collection(db, 'moods'),
        where('pairId', '==', pairId),
        where('userId', '==', userData.partnerId),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
    } catch (error) {
      partnerTodayQuery = query(
        collection(db, 'moods'),
        where('pairId', '==', pairId),
        where('userId', '==', userData.partnerId),
        limit(10)
      );
    }

    const unsubscribePartnerToday = onSnapshot(
      partnerTodayQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as Mood[];

          docs.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
            return bTime - aTime;
          });

          const moodData = docs[0];
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const moodDate = moodData.createdAt?.toDate ? moodData.createdAt.toDate() : new Date(moodData.createdAt);
          moodDate.setHours(0, 0, 0, 0);

          // Check if mood is from today
          if (moodDate.getTime() === today.getTime()) {
            setPartnerTodayMood(moodData);
          } else {
            setPartnerTodayMood(null);
          }
        } else {
          setPartnerTodayMood(null);
        }
        // Recalculate streaks when partner's mood changes
        calculateStreaks(pairId, user.uid, userData.partnerId);
      },
      (error: any) => {
        console.error('Error loading partner today mood:', error);
        // Try fallback without orderBy
        if (error.code === 'failed-precondition') {
          const fallbackQuery = query(
            collection(db, 'moods'),
            where('pairId', '==', pairId),
            where('userId', '==', userData.partnerId),
            limit(10)
          );
          onSnapshot(
            fallbackQuery,
            (snapshot) => {
              if (!snapshot.empty) {
                const docs = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data(),
                })) as Mood[];
                docs.sort((a, b) => {
                  const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
                  const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
                  return bTime - aTime;
                });
                const moodData = docs[0];
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const moodDate = moodData.createdAt?.toDate ? moodData.createdAt.toDate() : new Date(moodData.createdAt);
                moodDate.setHours(0, 0, 0, 0);
                if (moodDate.getTime() === today.getTime()) {
                  setPartnerTodayMood(moodData);
                } else {
                  setPartnerTodayMood(null);
                }
              } else {
                setPartnerTodayMood(null);
              }
            },
            (fallbackError) => {
              console.error('Fallback partner today mood query also failed:', fallbackError);
            }
          );
        }
      }
    );

    return () => {
      unsubscribeTimeline();
      unsubscribeToday();
      unsubscribePartnerToday();
    };
  }, [user, userData?.pairId, userData?.partnerId, calculateStreaks, getPairId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (user && userData?.partnerId) {
      const pairId = getPairId(user.uid, userData.partnerId, userData.pairId);
      if (pairId) {
        await loadMoodTimeline(pairId);
        await loadTodayMoods(user.uid, pairId, userData.partnerId);
        await calculateStreaks(pairId, user.uid, userData.partnerId);
        await loadInsights(pairId, user.uid, userData.partnerId);
      }
    }
    setRefreshing(false);
  }, [userData?.pairId, userData?.partnerId, user, getPairId, loadMoodTimeline, loadTodayMoods, calculateStreaks, loadInsights]);

  // Load insights on mount and when moods change
  useEffect(() => {
    if (user && userData?.partnerId) {
      const pairId = getPairId(user.uid, userData.partnerId, userData.pairId);
      if (pairId) {
        loadInsights(pairId, user.uid, userData.partnerId);
      }
    }
  }, [user, userData?.partnerId, userData?.pairId, moods.length, getPairId, loadInsights]);

  // Celebration animation when both partners are happy
  useEffect(() => {
    const moodSync = getMoodSyncMessage(todayMood?.mood || null, partnerTodayMood?.mood || null);
    if (moodSync && moodSync.message.includes('radiating joy') || moodSync?.message.includes('Love is in the air')) {
      Animated.sequence([
        Animated.timing(celebrationAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(celebrationAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [todayMood?.mood, partnerTodayMood?.mood]);

  const handleMoodSubmit = async (mood: MoodType, note?: string, cause?: MoodCause) => {
    if (!user || !userData?.partnerId) return;

    setSubmittingMood(true);
    try {
      const pairId = getPairId(user.uid, userData.partnerId, userData.pairId);
      if (!pairId) return;

      await MoodService.submitMood(user.uid, pairId, mood, note, cause);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowMoodModal(false);

      // Send push notification to partner
      if (partnerData?.pushToken) {
        const senderName = userData?.name || userData?.displayName || user?.email?.split('@')[0] || 'Your partner';
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
        const causeText = cause ? MOOD_CAUSES.find(c => c.type === cause)?.label : null;
        const emoji = moodEmojis[mood] || '😊';

        sendPushNotification(
          partnerData.pushToken,
          "Mood Update 💕",
          `${senderName} feels ${emoji}${causeText ? ' because of ' + causeText : ''}${note ? ': ' + note.substring(0, 50) : ''}`
        ).catch((notifErr) => {
          console.error('Failed to send mood notification:', notifErr);
        });
      }

      // Real-time listeners will automatically update the UI, but refresh streaks and insights
      calculateStreaks(pairId, user.uid, userData.partnerId);
      loadInsights(pairId, user.uid, userData.partnerId);
    } catch (error: any) {
      console.error('Error submitting mood:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert('Failed to submit mood. Please try again.');
    } finally {
      setSubmittingMood(false);
    }
  };



  // Send love to partner with elegant animation
  const handleReaction = async (moodId: string, reaction: MoodReaction) => {
    if (!user || sendingReaction) return;

    // Start heart animation immediately
    Animated.parallel([
      Animated.sequence([
        Animated.spring(heartScaleAnim, {
          toValue: 1.4,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.spring(heartScaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(heartRotateAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(heartRotateAnim, {
          toValue: -1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(heartRotateAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    setSendingReaction(moodId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await MoodService.reactToMood(moodId, user.uid, reaction);

      // Send notification to partner
      if (partnerData?.pushToken) {
        const senderName = userData?.name || userData?.displayName || user?.email?.split('@')[0] || 'Your partner';

        sendPushNotification(
          partnerData.pushToken,
          '❤️ Love Received',
          `${senderName} sent you love!`
        ).catch(console.error);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Keep "Sent!" showing briefly
      setTimeout(() => {
        setSendingReaction(null);
      }, 1500);
    } catch (error) {
      console.error('Error sending reaction:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSendingReaction(null);
    }
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Show content if partnerId exists - partner connection is determined by partnerId
  if (!userData?.partnerId) {
    return (
      <NoPartnerState
        title="Moods"
        subtitle="Connect with your partner to start sharing moods and staying in sync."
      />
    );
  }

  const userName = userData?.name || userData?.displayName || user?.email?.split('@')[0] || 'You';
  const partnerName = partnerData?.name || partnerData?.displayName || partnerData?.email?.split('@')[0] || 'Partner';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerAvatarColumn}>
            <WobblySquare
              rotate="2deg"
              style={styles.avatarContainer}
              borderColor={todayMood ? moodColors[todayMood.mood] : theme.colors.doodlePurple}
            >
              {userData?.profileImage ? (
                <View style={{ width: '100%', height: '100%' }}>
                  <Image source={{ uri: userData.profileImage }} style={styles.avatarImage} />
                  {todayMood && (
                    <View style={styles.emojiBadge}>
                      <Text style={{ fontSize: 14 }}>{moodEmojis[todayMood.mood]}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.avatarImage, {
                  backgroundColor: todayMood ? moodColors[todayMood.mood] + '20' : '#f0f0f0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }]}>
                  <Text style={{ fontSize: 32 }}>{todayMood ? moodEmojis[todayMood.mood] : ''}</Text>
                </View>
              )}
            </WobblySquare>
            <Text style={[styles.avatarLabel, { color: todayMood ? moodColors[todayMood.mood] : theme.colors.doodlePurple }]}>Me</Text>
          </View>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Mood Hub</Text>
          </View>

          <View style={styles.headerAvatarColumn}>
            <WobblySquare
              rotate="-2deg"
              style={styles.avatarContainer}
              borderColor={partnerTodayMood ? moodColors[partnerTodayMood.mood] : theme.colors.doodlePink}
            >
              {partnerData?.profileImage ? (
                <View style={{ width: '100%', height: '100%' }}>
                  <Image source={{ uri: partnerData.profileImage }} style={styles.avatarImage} />
                  {partnerTodayMood && (
                    <View style={styles.emojiBadge}>
                      <Text style={{ fontSize: 14 }}>{moodEmojis[partnerTodayMood.mood]}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.avatarImage, {
                  backgroundColor: partnerTodayMood ? moodColors[partnerTodayMood.mood] + '20' : '#f0f0f0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }]}>
                  <Text style={{ fontSize: 32 }}>{partnerTodayMood ? moodEmojis[partnerTodayMood.mood] : ''}</Text>
                </View>
              )}
            </WobblySquare>
            <Text style={[styles.avatarLabel, { color: partnerTodayMood ? moodColors[partnerTodayMood.mood] : theme.colors.doodlePink }]}>{partnerName}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          {/* How are you now section - Moved to Top */}
          <View style={styles.promptSection}>
            <Text style={styles.promptTitle}>How are you now?</Text>

            <View style={styles.moodGrid}>
              {ALL_MOODS.map((m) => {
                const moodType = m;
                const emoji = moodEmojis[moodType];
                const label = moodLabels[moodType];
                const isActive = todayMood?.mood === moodType;

                return (
                  <TouchableOpacity
                    key={m}
                    style={styles.moodBtn}
                    onPress={() => handleMoodSubmit(moodType)}
                  >
                    <WobblyCircle
                      style={[
                        styles.moodBtnCircle,
                        isActive && { backgroundColor: moodColors[moodType] + '20' }
                      ]}
                      borderColor={isActive ? moodColors[moodType] : theme.colors.text + '20'}
                    >
                      <Text style={{ fontSize: 24 }}>{emoji}</Text>
                    </WobblyCircle>
                    <Text style={[
                      styles.moodBtnLabel,
                      isActive && { opacity: 1, color: moodColors[moodType] }
                    ]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* History Toggle */}
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Text style={styles.historyButtonText}>{showHistory ? 'Hide Past Moods' : 'See Past Moods'}</Text>
            <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Mood Story Timeline - Conditionally Rendered */}
          {showHistory && (
            <View style={styles.timelineSection}>
              <Text style={styles.timelineTitle}>OUR MOOD STORY</Text>

              <View style={styles.timelineContainer}>
                <View style={styles.timelineLine} />

                {moods.slice(0, 20).map((mood, index) => {
                  const isMe = mood.userId === user?.uid;
                  const moodColor = moodColors[mood.mood] || theme.colors.primary;
                  const emoji = mood.customEmoji || moodEmojis[mood.mood];
                  const timeAgo = formatTimeAgo(mood.createdAt);

                  return (
                    <View key={mood.id || index} style={styles.timelineItem}>
                      <View style={styles.timelineLeft}>
                        {!isMe && (
                          <>
                            <Text style={{ fontSize: 24 }}>{emoji}</Text>
                            <Text style={styles.timestamp}>{timeAgo}</Text>
                          </>
                        )}
                      </View>

                      <View style={[styles.timelineCenter, { backgroundColor: moodColor, borderColor: '#fff' }]} />

                      <View style={styles.timelineRight}>
                        {isMe && (
                          <>
                            <Text style={{ fontSize: 24 }}>{emoji}</Text>
                            <Text style={styles.timestamp}>{timeAgo}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
                {moods.length === 0 && (
                  <Text style={styles.emptyText}>No recent moods</Text>
                )}
              </View>
            </View>
          )}

        </ScrollView>

        <MoodSelector
          visible={showMoodModal}
          onClose={() => setShowMoodModal(false)}
          onSubmit={handleMoodSubmit}
          loading={submittingMood}
          partnerName={partnerName}
        />
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    zIndex: 10,
  },
  headerAvatarColumn: {
    alignItems: 'center',
    gap: 4,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  avatarLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  emojiBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 10,
  },
  headerTitleContainer: {
    transform: [{ rotate: '-2deg' }],
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy-Bold' : 'sans-serif-medium', // Fallback for 'handwritten'
    color: theme.colors.text,
  },

  // Scroll Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100, // Space for bottom nav
  },

  // Timeline
  timelineSection: {
    marginTop: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  timelineTitle: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '700',
    opacity: 0.3,
    marginBottom: 32,
    color: theme.colors.text,
  },
  timelineContainer: {
    width: '100%',
    maxWidth: 280,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.colors.text,
    opacity: 0.1,
    transform: [{ translateX: -1 }],
  },
  timelineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 48,
    width: '100%',
  },
  timelineLeft: {
    width: '42%',
    alignItems: 'flex-end',
    paddingRight: 20,
  },
  timelineRight: {
    width: '42%',
    alignItems: 'flex-start',
    paddingLeft: 20,
  },
  timelineCenter: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: '#fff',
    zIndex: 1,
  },
  moodIcon: {
    // Styling handled in component
  },
  timestamp: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    opacity: 0.4,
    marginTop: 4,
  },

  // Reaction/Prompt Section
  promptSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  promptTitle: {
    fontSize: 32,
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy-Bold' : 'sans-serif-medium',
    marginBottom: 32,
    color: theme.colors.text,
    transform: [{ rotate: '-1deg' }],
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  moodBtn: {
    alignItems: 'center',
    gap: 8,
    width: 70, // Fixed width for alignment
  },
  moodBtnCircle: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodBtnLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
    fontWeight: '900',
    letterSpacing: 1,
    opacity: 0.3,
  },

  // Utility
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: theme.colors.textMuted,
    marginTop: 10,
  },

  // Existing styles to keep for functionality (Modal etc)
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 20,
    backgroundColor: theme.colors.surface || '#f5f5f5',
    borderRadius: 20,
    alignSelf: 'center',
    gap: 8,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

