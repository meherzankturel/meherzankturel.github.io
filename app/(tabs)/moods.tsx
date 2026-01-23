import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, SafeAreaView, Animated } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, onSnapshot, getDoc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { MoodService, Mood, MoodType, MoodCause, MoodReaction, MOOD_CAUSES, MOOD_REACTIONS } from '../../src/services/mood.service';
import MoodSelector from '../../src/components/MoodSelector';
import { SwipeableTabWrapper } from '../../src/components/SwipeableTabWrapper';
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

  // Load mood insights
  const loadInsights = useCallback(async (pairId: string, userId: string, partnerId: string) => {
    try {
      const data = await MoodService.getMoodInsights(pairId, userId, partnerId);
      setInsights(data);
    } catch (error) {
      console.error('Error loading insights:', error);
    }
  }, []);

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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Show content if partnerId exists - partner connection is determined by partnerId
  if (!userData?.partnerId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={64} color={theme.colors.textLight} />
          <Text style={styles.emptyText}>No partner connected</Text>
          <Text style={styles.emptySubtext}>Connect with your partner to start sharing moods</Text>
        </View>
      </SafeAreaView>
    );
  }

  const userName = userData?.name || userData?.displayName || user?.email?.split('@')[0] || 'You';
  const partnerName = partnerData?.name || partnerData?.displayName || partnerData?.email?.split('@')[0] || 'Partner';

  // Debug: Log current state
  console.log('🔍 Moods Screen State:', {
    totalMoodsInTimeline: moods.length,
    myMoodsCount: moods.filter(m => m.userId === user?.uid).length,
    partnerMoodsCount: moods.filter(m => m.userId === userData?.partnerId).length,
    hasTodayMood: !!todayMood,
    hasPartnerTodayMood: !!partnerTodayMood,
    partnerId: userData?.partnerId,
    myUserId: user?.uid,
  });

  const moodSync = getMoodSyncMessage(todayMood?.mood || null, partnerTodayMood?.mood || null);

  return (
    <SwipeableTabWrapper tabIndex={1} totalTabs={4}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Mood Tracker</Text>
            <Text style={styles.subtitle}>Stay connected through feelings</Text>
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
          {/* Mood Sync Banner */}
          {moodSync && (
            <Animated.View style={[
              styles.moodSyncBanner,
              { backgroundColor: moodSync.color + '15', borderColor: moodSync.color + '30' },
              { transform: [{ scale: celebrationAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }] }
            ]}>
              <Text style={styles.moodSyncEmoji}>{moodSync.emoji}</Text>
              <Text style={[styles.moodSyncText, { color: moodSync.color }]}>{moodSync.message}</Text>
            </Animated.View>
          )}


          {/* Today's Moods Side-by-Side */}
          <View style={styles.todaySection}>
            <Text style={styles.sectionTitle}>Today's Moods</Text>
            <View style={styles.todayMoodsContainer}>
              {/* Your Mood */}
              <TouchableOpacity
                style={[styles.todayMoodCard, !todayMood && styles.todayMoodCardEmpty]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowMoodModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.todayMoodHeader}>
                  <Text style={styles.todayMoodLabel}>{userName}</Text>
                  {moodStreak > 0 && (
                    <View style={styles.streakBadge}>
                      <Ionicons name="flame" size={14} color={theme.colors.accent} />
                      <Text style={styles.streakText}>{moodStreak}</Text>
                    </View>
                  )}
                </View>
                {todayMood ? (
                  <>
                    <View style={[styles.todayMoodIcon, { backgroundColor: moodColors[todayMood.mood] + '20' }]}>
                      <Text style={styles.todayMoodEmoji}>{moodEmojis[todayMood.mood]}</Text>
                    </View>
                    <Text style={styles.todayMoodType}>{moodLabels[todayMood.mood]}</Text>
                    {todayMood.cause && (
                      <Text style={styles.todayCause}>
                        {MOOD_CAUSES.find(c => c.type === todayMood.cause)?.emoji} {MOOD_CAUSES.find(c => c.type === todayMood.cause)?.label}
                      </Text>
                    )}
                    {todayMood.note && (
                      <Text style={styles.todayMoodNote} numberOfLines={2}>{todayMood.note}</Text>
                    )}
                    <Text style={styles.updatePrompt}>Tap to update</Text>
                  </>
                ) : (
                  <View style={styles.emptyMoodPrompt}>
                    <Ionicons name="add-circle-outline" size={32} color={theme.colors.textLight} />
                    <Text style={styles.emptyMoodText}>How are you feeling?</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Partner's Mood */}
              <View style={[styles.todayMoodCard, !partnerTodayMood && styles.todayMoodCardEmpty]}>
                <View style={styles.todayMoodHeader}>
                  <Text style={styles.todayMoodLabel}>{partnerName}</Text>
                  {partnerMoodStreak > 0 && (
                    <View style={styles.streakBadge}>
                      <Ionicons name="flame" size={14} color={theme.colors.accent} />
                      <Text style={styles.streakText}>{partnerMoodStreak}</Text>
                    </View>
                  )}
                </View>
                {partnerTodayMood ? (
                  <>
                    <View style={[styles.todayMoodIcon, { backgroundColor: moodColors[partnerTodayMood.mood] + '20' }]}>
                      <Text style={styles.todayMoodEmoji}>{moodEmojis[partnerTodayMood.mood]}</Text>
                    </View>
                    <Text style={styles.todayMoodType}>{moodLabels[partnerTodayMood.mood]}</Text>
                    {partnerTodayMood.cause && (
                      <Text style={styles.todayCause}>
                        {MOOD_CAUSES.find(c => c.type === partnerTodayMood.cause)?.emoji} {MOOD_CAUSES.find(c => c.type === partnerTodayMood.cause)?.label}
                      </Text>
                    )}
                    {partnerTodayMood.note && (
                      <Text style={styles.todayMoodNote} numberOfLines={2}>{partnerTodayMood.note}</Text>
                    )}
                    {/* Simple Send Love Button */}
                    {partnerTodayMood.id && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleReaction(partnerTodayMood.id!, 'heart')}
                        disabled={!!sendingReaction}
                        style={styles.sendLoveButtonWrapper}
                      >
                        <Animated.View style={[
                          styles.sendLoveButton,
                          sendingReaction && styles.sendLoveButtonSending,
                          {
                            transform: [
                              { scale: reactionScaleAnims['heart'] },
                              {
                                rotateZ: reactionRotateAnims['heart'].interpolate({
                                  inputRange: [-1, 0, 1],
                                  outputRange: ['-10deg', '0deg', '10deg'],
                                })
                              },
                            ],
                          },
                        ]}>
                          <Text style={styles.sendLoveEmoji}>
                            {sendingReaction ? '💕' : '❤️'}
                          </Text>
                          <Text style={styles.sendLoveText}>
                            {sendingReaction ? 'Sent!' : 'Send Love'}
                          </Text>
                        </Animated.View>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <View style={styles.emptyMoodPrompt}>
                    <Ionicons name="time-outline" size={32} color={theme.colors.textLight} />
                    <Text style={styles.emptyMoodText}>Waiting...</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Weekly Insights */}
          {insights && insights.totalMoods > 0 && (
            <View style={styles.insightsSection}>
              <Text style={styles.sectionTitle}>💫 This Week's Insights</Text>
              <View style={styles.insightsGrid}>
                <View style={styles.insightCard}>
                  <Text style={styles.insightEmoji}>💕</Text>
                  <Text style={styles.insightValue}>{insights.lovedMoments}</Text>
                  <Text style={styles.insightLabel}>Love Moments</Text>
                </View>
                <View style={styles.insightCard}>
                  <Text style={styles.insightEmoji}>🔄</Text>
                  <Text style={styles.insightValue}>{insights.syncedDays}</Text>
                  <Text style={styles.insightLabel}>Synced Days</Text>
                </View>
                <View style={styles.insightCard}>
                  <Text style={styles.insightEmoji}>😊</Text>
                  <Text style={styles.insightValue}>{insights.userHappyDays + insights.partnerHappyDays}</Text>
                  <Text style={styles.insightLabel}>Happy Vibes</Text>
                </View>
              </View>
              {insights.topUserMood && insights.topPartnerMood && (
                <View style={styles.topMoodsRow}>
                  <Text style={styles.topMoodsText}>
                    Your vibe: {moodEmojis[insights.topUserMood]} • {partnerName}'s vibe: {moodEmojis[insights.topPartnerMood]}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Timeline Section */}
          <View style={styles.timelineSection}>
            <Text style={styles.sectionTitle}>Mood Timeline</Text>
            {moods.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="heart-outline" size={64} color={theme.colors.textLight} />
                <Text style={styles.emptyText}>No moods yet</Text>
                <Text style={styles.emptySubtext}>Share your first mood with your partner</Text>
              </View>
            ) : (
              moods.map((mood, index) => {
                const isCurrentUser = mood.userId === user?.uid;
                const displayName = isCurrentUser ? userName : partnerName;
                const moodColor = moodColors[mood.mood] || theme.colors.primary;
                const causeInfo = mood.cause ? MOOD_CAUSES.find(c => c.type === mood.cause) : null;
                const dateTime = formatDateTime(mood.createdAt);

                return (
                  <View key={mood.id || index} style={styles.moodCard}>
                    <View style={styles.moodHeader}>
                      <View style={[styles.moodIconContainer, { backgroundColor: moodColor + '20' }]}>
                        <Text style={styles.moodEmoji}>{moodEmojis[mood.mood]}</Text>
                      </View>
                      <View style={styles.moodInfo}>
                        <View style={styles.moodNameRow}>
                          <Text style={styles.moodName}>{displayName}</Text>
                        </View>
                        <Text style={styles.moodType}>
                          {moodLabels[mood.mood]}
                          {causeInfo && <Text style={styles.causeBecause}> • {causeInfo.emoji} {causeInfo.label}</Text>}
                        </Text>
                      </View>
                      <View style={styles.moodTimeContainer}>
                        <Text style={styles.moodDate}>{dateTime.date}</Text>
                        <Text style={styles.moodTime}>{dateTime.time}</Text>
                      </View>
                    </View>
                    {mood.note && (
                      <Text style={styles.moodNote}>"{mood.note}"</Text>
                    )}
                    {/* Show reactions that have been sent */}
                    {mood.reactions && mood.reactions.length > 0 && (
                      <View style={styles.reactionsRow}>
                        {mood.reactions.map((r, i) => (
                          <View key={i} style={styles.reactionBubble}>
                            <Text>{MOOD_REACTIONS.find(mr => mr.type === r.type)?.emoji}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        <MoodSelector
          visible={showMoodModal}
          onClose={() => setShowMoodModal(false)}
          onSubmit={handleMoodSubmit}
          loading={submittingMood}
          partnerName={partnerName}
        />
      </SafeAreaView>
    </SwipeableTabWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  // addButton style removed - button no longer in use
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  todaySection: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  todayMoodsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  todayMoodCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.md,
    minHeight: 180,
  },
  todayMoodCardEmpty: {
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.background,
  },
  todayMoodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: theme.spacing.sm,
  },
  todayMoodLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textSecondary,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  streakText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.accent,
  },
  todayMoodIcon: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  todayMoodEmoji: {
    fontSize: 40,
  },
  todayMoodType: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  todayMoodNote: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  emptyMoodPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  emptyMoodText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textLight,
    marginTop: theme.spacing.xs,
  },
  timelineSection: {
    marginTop: theme.spacing.md,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  moodCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  moodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  moodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodInfo: {
    flex: 1,
  },
  moodNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  moodName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
  },
  todayBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  todayBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary,
  },
  moodType: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  moodTimeContainer: {
    alignItems: 'flex-end',
  },
  moodDate: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textSecondary,
  },
  moodTime: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textLight,
    marginTop: 1,
  },
  moodNote: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  // Mood Sync Banner
  moodSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
  },
  moodSyncEmoji: {
    fontSize: 24,
  },
  moodSyncText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  // Today's cause
  todayCause: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  updatePrompt: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
  // Send Love Button
  sendLoveButtonWrapper: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
  },
  sendLoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD1DC',
    gap: 6,
  },
  sendLoveButtonSending: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
  },
  sendLoveEmoji: {
    fontSize: 16,
  },
  sendLoveText: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#E91E63',
  },
  // Insights section
  insightsSection: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  insightsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  insightCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  insightEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 24,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
  },
  insightLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  topMoodsRow: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
  },
  topMoodsText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  // Cause in timeline
  causeBecause: {
    color: theme.colors.textLight,
  },
  // Reactions in timeline
  reactionsRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.xs,
    gap: 4,
  },
  reactionBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

