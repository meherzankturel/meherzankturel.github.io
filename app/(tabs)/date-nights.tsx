import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal, Pressable, Alert, Switch, RefreshControl, Keyboard, Image, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { doc, onSnapshot, collection, query, where, orderBy, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { DateNightService, DateNight } from '../../src/services/dateNight.service';
import { DateReviewService, DateReview } from '../../src/services/dateReview.service';
import { SOSService } from '../../src/services/sos.service';
import { SwipeableTabWrapper } from '../../src/components/SwipeableTabWrapper';
import { SimpleTabs } from '../../src/components/SimpleTabs';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { DateTimePicker } from '../../src/components/DateTimePicker';
import DateReviewModal from '../../src/components/DateReviewModal';
import DateCalendar from '../../src/components/DateCalendar';
import MediaPreviewModal from '../../src/components/MediaPreviewModal';
import { PolaroidMemoryCard } from '../../src/components/PolaroidMemoryCard';
import { MemoryStats } from '../../src/components/MemoryStats';
import { theme } from '../../src/config/theme';
import { Ionicons } from '@expo/vector-icons';
import { debugPairIdConsistency } from '../../src/utils/pairIdDebug';
import { Timestamp } from 'firebase/firestore';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { useRouter, useFocusEffect } from 'expo-router';


const CATEGORIES = [
  { id: 'movie', name: 'Movie', icon: 'film', color: theme.colors.primary },
  { id: 'dinner', name: 'Dinner', icon: 'restaurant', color: theme.colors.secondary },
  { id: 'activity', name: 'Activity', icon: 'bicycle', color: theme.colors.accent },
  { id: 'virtual', name: 'Virtual', icon: 'videocam', color: theme.colors.info },
  { id: 'other', name: 'Other', icon: 'ellipse', color: theme.colors.textSecondary },
];

const REMINDER_OPTIONS = [
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '2 hours before', value: 120 },
  { label: '1 day before', value: 1440 },
];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `${hours}h ${mins}m`;
}

function formatTimeRange(startDate: Date, durationMinutes: number): string {
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const startTime = formatTime(startDate);
  const endTime = formatTime(endDate);
  const duration = formatDuration(durationMinutes);
  return `${startTime} - ${endTime} (${duration})`;
}

function isUpcoming(date: any): boolean {
  if (!date) return false;
  const dateObj = date.toDate ? date.toDate() : new Date(date);
  return dateObj > new Date();
}

// Sort past dates by date (newest/most recent first - descending order)
function sortPastDates(dates: DateNight[]): DateNight[] {
  return [...dates].sort((a, b) => {
    try {
      // Helper function to get date timestamp reliably
      const getDateTimestamp = (night: DateNight): number => {
        try {
          if (night.date?.toDate) {
            return night.date.toDate().getTime();
          } else if (night.date) {
            const parsed = new Date(night.date);
            if (!isNaN(parsed.getTime())) {
              return parsed.getTime();
            }
          }
          // Fallback to createdAt if date is invalid
          if (night.createdAt?.toDate) {
            return night.createdAt.toDate().getTime();
          } else if (night.createdAt) {
            const parsed = new Date(night.createdAt);
            if (!isNaN(parsed.getTime())) {
              return parsed.getTime();
            }
          }
        } catch (e) {
          console.warn('Error parsing date for night:', night.title, e);
        }
        return 0; // Invalid dates go to the end
      };

      const dateA = getDateTimestamp(a);
      const dateB = getDateTimestamp(b);

      // Validate dates - push invalid to end
      if (isNaN(dateA) || dateA === 0) {
        return 1; // a goes after b
      }
      if (isNaN(dateB) || dateB === 0) {
        return -1; // b goes after a (a comes first)
      }

      // Primary sort: by date DESCENDING (newest/most recent first)
      // If dateB is more recent (larger timestamp), return negative (b comes first)
      const dateDiff = dateB - dateA;
      if (dateDiff !== 0) {
        return dateDiff;
      }

      // Secondary sort: by createdAt DESCENDING (newest first)
      const getCreatedAtTimestamp = (night: DateNight): number => {
        try {
          if (night.createdAt?.toDate) {
            return night.createdAt.toDate().getTime();
          } else if (night.createdAt) {
            const parsed = new Date(night.createdAt);
            if (!isNaN(parsed.getTime())) {
              return parsed.getTime();
            }
          }
        } catch (e) {
          // Ignore
        }
        return 0;
      };

      const createdAtA = getCreatedAtTimestamp(a);
      const createdAtB = getCreatedAtTimestamp(b);

      // Return negative if createdAtB is more recent (should come first)
      return createdAtB - createdAtA;
    } catch (e) {
      console.warn('⚠️ Error sorting past dates:', e);
      // Fallback: sort by title alphabetically
      return (a.title || '').localeCompare(b.title || '');
    }
  });
}

// Schedule reminder notification
async function scheduleReminderNotification(
  dateNightId: string,
  title: string,
  dateTime: Date,
  offsetMinutes: number
): Promise<void> {
  try {
    // Calculate when to send the reminder
    const reminderTime = new Date(dateTime);
    reminderTime.setMinutes(reminderTime.getMinutes() - offsetMinutes);

    // Don't schedule if reminder time is in the past
    if (reminderTime <= new Date()) {
      console.log('Reminder time is in the past, skipping notification');
      return;
    }

    // Format the date/time for the notification message
    const timeString = formatTime(dateTime);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📅 Date Night Reminder',
        body: `Your date "${title}" is coming up at ${timeString}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          type: 'dateNightReminder',
          dateNightId: dateNightId,
        },
      },
      trigger: { seconds: Math.max(1, Math.floor((reminderTime.getTime() - Date.now()) / 1000)) } as Notifications.NotificationTriggerInput,
    });

    console.log('✅ Reminder notification scheduled for:', reminderTime);
  } catch (error) {
    console.error('Failed to schedule reminder notification:', error);
  }
}

// Schedule review reminder notifications at intervals
async function scheduleReviewReminders(
  dateNightId: string,
  dateNight: DateNight,
  userId1: string,
  userId2: string,
  partnerPushToken?: string
): Promise<void> {
  try {
    if (!dateNight.date) return;

    const date = dateNight.date?.toDate ? dateNight.date.toDate() : new Date(dateNight.date);
    const now = new Date();

    // Only schedule for past dates
    if (date > now) return;

    // Check if both partners have reviewed
    const bothReviewed = await DateReviewService.bothPartnersReviewed(
      dateNightId,
      userId1,
      userId2
    );

    if (bothReviewed) {
      console.log(`✅ Both partners have reviewed "${dateNight.title}", skipping reminders`);
      return;
    }

    // Calculate days since the date passed
    const daysSince = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    // Notification intervals: 1 day, 3 days, 7 days, 14 days
    const intervals = [1, 3, 7, 14];

    for (const interval of intervals) {
      // Only schedule if the interval has passed and we haven't reached the next interval yet
      if (daysSince >= interval && daysSince < interval + 1) {
        const notificationTime = new Date(date);
        notificationTime.setDate(notificationTime.getDate() + interval);
        notificationTime.setHours(10, 0, 0, 0); // 10 AM

        // Don't schedule if notification time is more than 1 day in the future
        if (notificationTime > now && notificationTime <= new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
          // Get missing reviews
          const missingReviews = await DateReviewService.getMissingReviews(
            dateNightId,
            userId1,
            userId2
          );

          if (missingReviews.length === 0) continue; // Both reviewed, skip

          // Create notification message
          let body = '';
          if (missingReviews.length === 2) {
            body = `Both of you haven't reviewed "${dateNight.title}" yet. Share your thoughts!`;
          } else {
            body = `You haven't reviewed "${dateNight.title}" yet. Don't forget to share your experience!`;
          }

          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '📝 Review Your Date Night',
                body: body,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
                data: {
                  type: 'reviewReminder',
                  dateNightId: dateNightId,
                  daysSince: interval,
                },
              },
              trigger: { seconds: Math.max(1, Math.floor((notificationTime.getTime() - Date.now()) / 1000)) } as Notifications.NotificationTriggerInput,
            });

            console.log(`✅ Review reminder scheduled for "${dateNight.title}" (${interval} day interval)`);
          } catch (error) {
            console.warn(`Failed to schedule review reminder for interval ${interval}:`, error);
          }

          // Also send push notification to partner if available
          if (partnerPushToken && missingReviews.includes(userId2)) {
            try {
              const { sendPushNotification } = await import('../../src/utils/notifications');
              await sendPushNotification(
                partnerPushToken,
                '📝 Review Your Date Night',
                body,
                { type: 'reviewReminder', dateNightId }
              );
            } catch (error) {
              console.warn('Failed to send push notification for review reminder:', error);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to schedule review reminders:', error);
  }
}

// Check and schedule review reminders for all past dates
async function checkAndScheduleReviewReminders(
  pastDates: DateNight[],
  userId1: string,
  userId2: string,
  partnerPushToken?: string
): Promise<void> {
  try {
    console.log(`🔍 Checking ${pastDates.length} past dates for review reminders...`);

    for (const dateNight of pastDates) {
      if (!dateNight.id) continue;

      // Check if date is in the past and not completed
      const date = dateNight.date?.toDate ? dateNight.date.toDate() : new Date(dateNight.date);
      const now = new Date();

      if (date > now || dateNight.completed) continue;

      // Schedule reminders for this date
      await scheduleReviewReminders(
        dateNight.id,
        dateNight,
        userId1,
        userId2,
        partnerPushToken
      );
    }

    console.log('✅ Finished checking review reminders');
  } catch (error) {
    console.error('Error checking review reminders:', error);
  }
}

export default function DateNightsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [partnerData, setPartnerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateNights, setDateNights] = useState<DateNight[]>([]);
  const [upcomingNights, setUpcomingNights] = useState<DateNight[]>([]);
  const [pastNights, setPastNights] = useState<DateNight[]>([]);

  // Ensure pastNights are always sorted in real-time (newest first)
  const sortedPastNights = useMemo(() => {
    if (pastNights.length === 0) return pastNights;
    const sorted = sortPastDates(pastNights);
    return sorted;
  }, [pastNights]);

  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingDateNight, setEditingDateNight] = useState<DateNight | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedDateNightForReview, setSelectedDateNightForReview] = useState<DateNight | null>(null);
  const [reviews, setReviews] = useState<{ [dateNightId: string]: DateReview[] }>({});
  const [userReviews, setUserReviews] = useState<{ [dateNightId: string]: DateReview | null }>({});
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<DateNight | null>(null);
  const [activeDateTab, setActiveDateTab] = useState<'upcoming' | 'past'>('upcoming');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<DateNight['category']>('other');
  const [otherCategoryText, setOtherCategoryText] = useState('');
  const [duration, setDuration] = useState(120); // Default 2 hours in minutes
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderOffset, setReminderOffset] = useState(30);

  // Media preview state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewItems, setPreviewItems] = useState<Array<{ uri: string; type: 'image' | 'video' }>>([]);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);

  const openMediaPreview = (items: Array<{ uri: string; type: 'image' | 'video' }>, initialIndex: number = 0) => {
    console.log('🖼️ openMediaPreview called with:', { itemCount: items.length, initialIndex, items });
    setPreviewItems(items);
    setPreviewInitialIndex(initialIndex);
    setPreviewVisible(true);
    console.log('🖼️ State should be set now - preview should open');
  };

  // Debug: Log when preview state changes
  useEffect(() => {
    console.log('🖼️ Preview state updated:', {
      previewVisible,
      itemCount: previewItems.length,
      items: previewItems
    });
  }, [previewVisible, previewItems]);

  // Handle date night notifications (auto-add to calendar, handle deletions)
  useEffect(() => {
    if (!user || !userData?.pairId) return;

    // Listen for foreground notifications (when app is open)
    const foregroundSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data;

      if (data?.type === 'dateNight' && data?.dateNightId) {
        // Partner received a new date night notification - add to calendar
        const dateNightId = String(data.dateNightId);
        console.log('📅 Received date night notification (foreground):', dateNightId);
        try {
          const dateNightDoc = await getDoc(doc(db, 'dateNights', dateNightId));
          if (dateNightDoc.exists()) {
            const dateNightData = dateNightDoc.data() as DateNight;
            const date = dateNightData.date?.toDate ? dateNightData.date.toDate() : new Date(dateNightData.date);

            // Only add if date is in the future and not already in calendar
            if (date > new Date() && user && (!dateNightData.calendarEventIds || !dateNightData.calendarEventIds[user.uid])) {
              console.log('📅 Adding date to calendar from foreground notification...');
              const eventId = await DateNightService.addDateToUserCalendar(
                dateNightId,
                user.uid,
                {
                  date: date,
                  title: dateNightData.title,
                  description: dateNightData.description,
                  location: dateNightData.location,
                  duration: dateNightData.duration, // Include duration
                  reminders: dateNightData.reminders,
                }
              );
              if (eventId) {
                console.log('✅ Auto-added date to calendar from foreground notification');
              }
            }
          }
        } catch (error) {
          console.warn('Failed to auto-add date from foreground notification:', error);
        }
      } else if (data?.type === 'dateNightDeleted' && data?.dateNightId) {
        // Partner deleted a date - remove from this user's calendar
        const deletedDateNightId = String(data.dateNightId);
        console.log('🗑️ Received date night deletion notification (foreground):', deletedDateNightId);
        try {
          // Try to get the document before it was deleted (might still be in cache)
          const dateNightDoc = await getDoc(doc(db, 'dateNights', deletedDateNightId));
          if (dateNightDoc.exists() && user) {
            const dateNightData = dateNightDoc.data() as DateNight;
            const calendarEventIds = dateNightData.calendarEventIds || {};
            const eventId = calendarEventIds[user.uid];

            if (eventId) {
              await DateNightService.deleteCalendarEvent(eventId);
              console.log('✅ Deleted calendar event from foreground notification');
            } else {
              // Try to find and delete by searching
              const deleted = await DateNightService.findAndDeleteCalendarEvent(dateNightData);
              if (deleted) {
                console.log('✅ Found and deleted calendar event by searching (foreground)');
              }
            }
          } else {
            // Document already deleted - we can't search without data
            console.log('⚠️ Date night already deleted from Firestore, cannot search calendar');
          }
        } catch (error) {
          console.warn('Failed to delete calendar event from foreground notification:', error);
        }
      }
    });

    // Listen for notification taps (when app is in background)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;

      if (data?.type === 'dateNight' && data?.dateNightId) {
        // Partner received a new date night notification - add to calendar
        const tappedDateNightId = String(data.dateNightId);
        console.log('📅 Received date night notification (tap):', tappedDateNightId);
        try {
          const dateNightDoc = await getDoc(doc(db, 'dateNights', tappedDateNightId));
          if (dateNightDoc.exists() && user) {
            const dateNightData = dateNightDoc.data() as DateNight;
            const date = dateNightData.date?.toDate ? dateNightData.date.toDate() : new Date(dateNightData.date);

            // Only add if date is in the future and not already in calendar
            if (date > new Date() && (!dateNightData.calendarEventIds || !dateNightData.calendarEventIds[user.uid])) {
              console.log('📅 Adding date to calendar from notification tap...');
              const eventId = await DateNightService.addDateToUserCalendar(
                tappedDateNightId,
                user.uid,
                {
                  date: date,
                  title: dateNightData.title,
                  description: dateNightData.description,
                  location: dateNightData.location,
                  duration: dateNightData.duration, // Include duration
                  reminders: dateNightData.reminders,
                }
              );
              if (eventId) {
                console.log('✅ Auto-added date to calendar from notification tap');
              }
            }
          }
        } catch (error) {
          console.warn('Failed to auto-add date from notification tap:', error);
        }
      } else if (data?.type === 'dateNightDeleted' && data?.dateNightId) {
        // Partner deleted a date - remove from this user's calendar
        const tappedDeletedDateNightId = String(data.dateNightId);
        console.log('🗑️ Received date night deletion notification (tap):', tappedDeletedDateNightId);
        try {
          // Try to get the document before it was deleted (might still be in cache)
          // Use a timeout to avoid waiting too long if document is already deleted
          const dateNightDoc = await Promise.race([
            getDoc(doc(db, 'dateNights', tappedDeletedDateNightId)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]) as any;

          if (dateNightDoc && dateNightDoc.exists()) {
            const dateNightData = dateNightDoc.data() as DateNight;
            const calendarEventIds = dateNightData.calendarEventIds || {};
            const eventId = calendarEventIds[user.uid];

            console.log(`🗑️ Deleting calendar event for partner's deleted date: ${dateNightData.title}`);
            console.log(`   Event ID: ${eventId || 'NOT FOUND'}`);

            if (eventId) {
              await DateNightService.deleteCalendarEvent(eventId);
              console.log('✅ Deleted calendar event from notification tap');
            } else {
              // Try to find and delete by searching
              console.log('🔍 No event ID stored, searching for calendar event...');
              const deleted = await DateNightService.findAndDeleteCalendarEvent(dateNightData);
              if (deleted) {
                console.log('✅ Found and deleted calendar event by searching (tap)');
              } else {
                console.warn('⚠️ Could not find calendar event to delete');
              }
            }
          } else {
            // Document already deleted - we can't search without data
            // But we can try to search by common patterns if we have title/date in notification data
            console.log('⚠️ Date night already deleted from Firestore');
            console.log('💡 Calendar event should be deleted by real-time listener');
          }
        } catch (error: any) {
          if (error.message === 'Timeout') {
            console.log('⚠️ Document fetch timed out (likely already deleted)');
            console.log('💡 Calendar event should be deleted by real-time listener');
          } else {
            console.warn('Failed to delete calendar event from notification tap:', error);
          }
        }
      } else if (data?.type === 'dateNightUpdated' && data?.dateNightId) {
        // Partner updated a date - check if it was marked as completed
        const updatedDateNightId = String(data.dateNightId);
        console.log('📅 Received date night update notification (tap):', updatedDateNightId);
        try {
          const dateNightDoc = await getDoc(doc(db, 'dateNights', updatedDateNightId));
          if (dateNightDoc.exists() && user) {
            const dateNightData = dateNightDoc.data() as DateNight;

            // If date was marked as completed, delete from calendar
            if (dateNightData.completed) {
              const calendarEventIds = dateNightData.calendarEventIds || {};
              const eventId = calendarEventIds[user.uid];

              console.log(`🗑️ Date marked as completed - deleting calendar event: ${dateNightData.title}`);
              console.log(`   Event ID: ${eventId || 'NOT FOUND'}`);

              if (eventId) {
                await DateNightService.deleteCalendarEvent(eventId);
                console.log('✅ Deleted calendar event (date completed)');
              } else {
                // Try to find and delete by searching
                console.log('🔍 No event ID stored, searching for calendar event...');
                const deleted = await DateNightService.findAndDeleteCalendarEvent(dateNightData);
                if (deleted) {
                  console.log('✅ Found and deleted calendar event by searching (completed)');
                }
              }
            }
          }
        } catch (error: any) {
          console.warn('Failed to handle date night update notification:', error);
        }
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, [user, userData?.pairId]);

  // Load user data and pair info
  useEffect(() => {
    if (!user) return;

    let partnerUnsubscribe: (() => void) | null = null;
    let dateNightsUnsubscribe: (() => void) | null = null;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        console.log('Date Nights - User data updated:', {
          hasPairId: !!data.pairId,
          hasPartnerId: !!data.partnerId,
          pairId: data.pairId
        });
        setUserData(data);

        // Load partner data
        if (data.partnerId) {
          try {
            const partnerDoc = doc(db, 'users', data.partnerId);
            partnerUnsubscribe = onSnapshot(partnerDoc, (snap) => {
              if (snap.exists()) {
                setPartnerData(snap.data());
              }
            });
          } catch (error) {
            console.error('Error loading partner data:', error);
          }
        }

        // Handle pairing: If partnerId exists but no pairId, generate one
        let effectivePairId = data.pairId;

        if (!effectivePairId && data.partnerId) {
          console.log('⚠️ No pairId found, but partnerId exists. Generating consistent pairId...');
          // Generate a consistent pairId from both user IDs (sorted to ensure both users get the same ID)
          const userIds = [user.uid, data.partnerId].sort();
          effectivePairId = `pair_${userIds[0]}_${userIds[1]}`;

          console.log('📝 Generated pairId:', effectivePairId);

          // Update current user's pairId
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              pairId: effectivePairId,
              updatedAt: serverTimestamp(),
            });
            console.log('✅ Updated current user with pairId');

            // Also update partner's pairId (if they don't have one)
            try {
              const partnerDoc = await getDoc(doc(db, 'users', data.partnerId));
              if (partnerDoc.exists()) {
                const partnerData = partnerDoc.data();
                if (!partnerData.pairId || partnerData.pairId !== effectivePairId) {
                  await updateDoc(doc(db, 'users', data.partnerId), {
                    pairId: effectivePairId,
                    updatedAt: serverTimestamp(),
                  });
                  console.log('✅ Updated partner with pairId');
                }
              }
            } catch (partnerUpdateError) {
              console.warn('⚠️ Failed to update partner pairId (non-critical):', partnerUpdateError);
            }

            // Update local state
            setUserData({ ...data, pairId: effectivePairId });
          } catch (updateError) {
            console.error('❌ Failed to update pairId:', updateError);
            // Continue anyway - we'll use the generated pairId for this session
          }
        }

        // Load date nights with real-time listener
        if (effectivePairId) {
          console.log('Date Nights - Setting up listener for pairId:', effectivePairId);
          dateNightsUnsubscribe = setupDateNightsListener(effectivePairId);

          // Also add dates to partner's calendar if they were created by partner
          // This runs in the background and doesn't block
          syncPartnerDatesToCalendar(effectivePairId, user.uid).catch(err => {
            console.warn('Failed to sync partner dates to calendar:', err);
          });
        } else {
          console.log('Date Nights - No pairId or partnerId found. User needs to connect with partner.');
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (partnerUnsubscribe) partnerUnsubscribe();
      if (dateNightsUnsubscribe) dateNightsUnsubscribe();
    };
  }, [user]);

  const setupDateNightsListener = useCallback((pairId: string) => {
    console.log('🔍 Setting up date nights listener for pairId:', pairId);

    // Track previous date night IDs to detect deletions
    let previousDateNightIds = new Set<string>();
    let previousDateNightsMap = new Map<string, DateNight>();

    // Use fallback query first (more reliable, doesn't require index)
    // This will work even if Firestore indexes aren't created yet
    const fallbackQ = query(
      collection(db, 'dateNights'),
      where('pairId', '==', pairId)
    );

    return onSnapshot(
      fallbackQ,
      async (snapshot) => {
        console.log('📅 Date nights snapshot received:', snapshot.docs.length, 'documents');

        // Get current date night IDs
        const currentDateNightIds = new Set(snapshot.docs.map(doc => doc.id));

        // Find deleted date nights (were in previous set but not in current)
        const deletedIds = Array.from(previousDateNightIds).filter(id => !currentDateNightIds.has(id));

        // Delete from calendar for any deleted date nights
        if (deletedIds.length > 0 && user) {
          console.log('🗑️ Detected deleted date nights:', deletedIds);
          for (const deletedId of deletedIds) {
            try {
              const deletedDateNight = previousDateNightsMap.get(deletedId);
              if (deletedDateNight) {
                const calendarEventIds = deletedDateNight.calendarEventIds || {};
                const eventId = calendarEventIds[user.uid];

                if (eventId) {
                  console.log(`🗑️ Deleting calendar event for deleted date night: ${deletedDateNight.title} (eventId: ${eventId})`);
                  await DateNightService.deleteCalendarEvent(eventId);
                  console.log(`✅ Deleted calendar event for "${deletedDateNight.title}"`);
                } else {
                  // Try to find and delete by searching
                  console.log(`🔍 No event ID stored, searching for calendar event: ${deletedDateNight.title}`);
                  const deleted = await DateNightService.findAndDeleteCalendarEvent(deletedDateNight);
                  if (deleted) {
                    console.log(`✅ Found and deleted calendar event by searching for "${deletedDateNight.title}"`);
                  } else {
                    console.warn(`⚠️ Could not find calendar event to delete for "${deletedDateNight.title}"`);
                  }
                }
              }
            } catch (err: any) {
              console.error(`❌ Failed to delete calendar event for deleted date night ${deletedId}:`, err);
            }
          }
        }

        // Check for dates that were just marked as completed
        if (user) {
          for (const docSnap of snapshot.docs) {
            const currentData = docSnap.data() as DateNight;
            const previousData = previousDateNightsMap.get(docSnap.id);

            // If date was just marked as completed (wasn't completed before, but is now)
            if (currentData.completed && previousData && !previousData.completed) {
              console.log(`✅ Date marked as completed: ${currentData.title}`);
              const calendarEventIds = currentData.calendarEventIds || {};
              const eventId = calendarEventIds[user.uid];

              if (eventId) {
                try {
                  console.log(`🗑️ Deleting calendar event for completed date: ${currentData.title} (eventId: ${eventId})`);
                  await DateNightService.deleteCalendarEvent(eventId);
                  console.log(`✅ Deleted calendar event for completed date "${currentData.title}"`);
                } catch (err: any) {
                  console.warn(`⚠️ Failed to delete calendar event for completed date:`, err);
                  // Try searching as fallback
                  try {
                    const deleted = await DateNightService.findAndDeleteCalendarEvent(currentData);
                    if (deleted) {
                      console.log(`✅ Found and deleted calendar event by searching for completed date "${currentData.title}"`);
                    }
                  } catch (searchErr) {
                    console.warn(`⚠️ Search deletion also failed for completed date:`, searchErr);
                  }
                }
              } else {
                // Try searching as fallback
                try {
                  console.log(`🔍 No event ID stored, searching for calendar event: ${currentData.title}`);
                  const deleted = await DateNightService.findAndDeleteCalendarEvent(currentData);
                  if (deleted) {
                    console.log(`✅ Found and deleted calendar event by searching for completed date "${currentData.title}"`);
                  }
                } catch (searchErr) {
                  console.warn(`⚠️ Could not find calendar event to delete for completed date "${currentData.title}"`);
                }
              }
            }
          }
        }

        if (snapshot.docs.length === 0) {
          console.log('⚠️ No date nights found for pairId:', pairId);
          console.log('💡 Make sure dates are created with the correct pairId');
        }

        const nights = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('📝 Date night doc:', {
            id: doc.id,
            title: data.title,
            pairId: data.pairId,
            createdBy: data.createdBy,
            date: data.date?.toDate ? data.date.toDate().toISOString() : data.date
          });
          return {
            id: doc.id,
            ...data,
          } as DateNight;
        });

        // Update previous tracking
        previousDateNightIds = currentDateNightIds;
        previousDateNightsMap = new Map(nights.map(night => [night.id!, night]));

        // Sort manually by date (descending - newest first)
        nights.sort((a, b) => {
          try {
            const dateA = a.date?.toDate ? a.date.toDate().getTime() : (a.date ? new Date(a.date).getTime() : 0);
            const dateB = b.date?.toDate ? b.date.toDate().getTime() : (b.date ? new Date(b.date).getTime() : 0);
            return dateB - dateA; // Descending
          } catch (e) {
            console.warn('Error sorting dates:', e);
            return 0;
          }
        });

        console.log('✅ Date nights loaded:', nights.length);
        console.log('📋 Date nights titles:', nights.map(n => n.title));
        setDateNights(nights);

        // Separate upcoming and past
        const now = new Date();
        const upcoming = nights.filter(night => {
          if (!night.date) {
            console.warn('⚠️ Date night missing date field:', night.title);
            return false;
          }
          try {
            const date = night.date?.toDate ? night.date.toDate() : new Date(night.date);
            const isUpcoming = date > now && !night.completed;
            if (isUpcoming) {
              console.log('📅 Upcoming:', night.title, date.toISOString());
            }
            return isUpcoming;
          } catch (e) {
            console.warn('⚠️ Error parsing date for:', night.title, e);
            return false;
          }
        });
        // Filter past dates: date has passed OR marked as completed
        const pastFiltered = nights.filter(night => {
          if (!night.date) return false;
          try {
            const date = night.date?.toDate ? night.date.toDate() : new Date(night.date);
            // Past dates: date has passed OR marked as completed
            return date <= now || night.completed;
          } catch (e) {
            return false;
          }
        });

        // Sort past dates using dedicated function (newest first)
        const past = sortPastDates(pastFiltered);

        // Log sorted past dates for debugging
        if (past.length > 0) {
          console.log('📅 Past dates sorted (newest first):');
          past.forEach((night, index) => {
            const date = night.date?.toDate ? night.date.toDate() : new Date(night.date);
            console.log(`  ${index + 1}. ${night.title} - ${date.toLocaleDateString()}`);
          });
        }

        console.log('📊 Upcoming dates:', upcoming.length, 'Past dates:', past.length);
        setUpcomingNights(upcoming);
        setPastNights(past);

        // Load reviews for past dates and check review reminders (async, don't block)
        if (user && past.length > 0) {
          loadReviewsForPastDates(past, user.uid);

          // Check and schedule review reminders for unreviewed past dates
          if (userData?.partnerId && partnerData) {
            checkAndScheduleReviewReminders(
              past,
              user.uid,
              userData.partnerId,
              partnerData.pushToken
            ).catch(err => {
              console.warn('Failed to check review reminders:', err);
            });
          }
        }

        // Sync partner dates to calendar whenever dates are loaded/updated
        // This ensures partner's dates are always added to calendar
        if (user && pairId) {
          console.log('🔄 Triggering calendar sync for partner dates...');
          syncPartnerDatesToCalendar(pairId, user.uid).catch(err => {
            console.warn('Failed to sync partner dates:', err);
          });

          // Check for calendar deletions (if user deleted from calendar app)
          // Check every time dates are loaded (real-time listener updates)
          DateNightService.checkAndSyncCalendarDeletions(nights, user.uid)
            .then((result) => {
              if (result.updatedCount > 0) {
                console.log(`📅 Detected ${result.updatedCount} date(s) deleted from calendar - moved to past`);
                // The listener will automatically refresh with updated data
              }
            })
            .catch((err) => {
              console.warn('Failed to check calendar deletions:', err);
            });
        }

        // Load reviews for past dates (async, don't block)
        if (user && past.length > 0) {
          loadReviewsForPastDates(past, user.uid);
        }
      },
      (error) => {
        console.error('❌ Error listening to date nights:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        // Set empty arrays if query fails
        setDateNights([]);
        setUpcomingNights([]);
        setPastNights([]);
      }
    );
  }, [user]);

  // Sync partner-created dates to current user's calendar
  const syncPartnerDatesToCalendar = useCallback(async (pairId: string, currentUserId: string) => {
    try {
      console.log('📅 Syncing partner dates to calendar...');
      const nights = await DateNightService.getDateNights(pairId);
      console.log(`📋 Total date nights found: ${nights.length}`);

      // Filter dates created by partner (not current user) that don't have calendar event ID for current user
      const partnerDates = nights.filter(night => {
        const isPartnerDate = night.createdBy && night.createdBy !== currentUserId;
        const hasCalendarEvent = night.calendarEventIds && night.calendarEventIds[currentUserId];
        const isNotCompleted = !night.completed;

        if (isPartnerDate && !hasCalendarEvent && isNotCompleted) {
          console.log(`📝 Found partner date to sync: "${night.title}" (createdBy: ${night.createdBy})`);
        }

        return isPartnerDate && !hasCalendarEvent && isNotCompleted;
      });

      console.log(`✅ Found ${partnerDates.length} partner-created dates to sync`);

      if (partnerDates.length === 0) {
        console.log('ℹ️ No partner dates need syncing (all already in calendar or completed)');
        return;
      }

      // Add each partner date to calendar and store event ID
      let successCount = 0;
      let failCount = 0;

      for (const dateNight of partnerDates) {
        try {
          // Only add if date is in the future
          const date = dateNight.date?.toDate ? dateNight.date.toDate() : new Date(dateNight.date);
          if (date > new Date() && dateNight.id) {
            console.log(`📅 Adding "${dateNight.title}" to calendar...`);
            const eventId = await DateNightService.addDateToUserCalendar(
              dateNight.id,
              currentUserId,
              {
                date: date,
                title: dateNight.title,
                description: dateNight.description,
                location: dateNight.location,
                duration: dateNight.duration, // Include duration for partner calendar
                reminders: dateNight.reminders,
              }
            );

            if (eventId) {
              console.log(`✅ Added partner date "${dateNight.title}" to calendar (eventId: ${eventId})`);
              successCount++;
            } else {
              console.warn(`⚠️ Failed to add "${dateNight.title}" - eventId was null`);
              failCount++;
            }
          } else {
            console.log(`⏭️ Skipping "${dateNight.title}" - date is in the past or missing ID`);
          }
        } catch (err: any) {
          console.error(`❌ Failed to add partner date "${dateNight.title}" to calendar:`, err);
          failCount++;
          // Continue with next date
        }
      }

      console.log(`📊 Calendar sync complete: ${successCount} succeeded, ${failCount} failed`);
    } catch (error: any) {
      console.error('❌ Failed to sync partner dates to calendar:', error);
    }
  }, []);

  // Set up real-time listeners for reviews
  useEffect(() => {
    if (!user || sortedPastNights.length === 0) return;

    const unsubscribeFunctions: (() => void)[] = [];

    // Set up real-time listeners for each past date night's reviews
    sortedPastNights.forEach(night => {
      if (!night.id) return;

      try {
        const unsubscribe = DateReviewService.subscribeToReviews(night.id, (reviews) => {
          setReviews(prev => ({
            ...prev,
            [night.id!]: reviews,
          }));

          // Update user review
          const userReview = reviews.find(r => r.userId === user.uid) || null;
          setUserReviews(prev => ({
            ...prev,
            [night.id!]: userReview,
          }));

          console.log(`✅ Real-time review update for "${night.title}":`, reviews.length, 'reviews');
        });

        unsubscribeFunctions.push(unsubscribe);
      } catch (error) {
        console.warn(`Failed to set up review listener for ${night.id}:`, error);
      }
    });

    return () => {
      // Cleanup all listeners
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }, [user, sortedPastNights]);

  const loadReviewsForPastDates = async (pastNights: DateNight[], userId: string) => {
    // This is now handled by real-time listeners, but keeping for initial load
    const reviewsMap: { [key: string]: DateReview[] } = {};
    const userReviewsMap: { [key: string]: DateReview | null } = {};

    for (const night of pastNights) {
      if (night.id) {
        try {
          const nightReviews = await DateReviewService.getReviews(night.id);
          reviewsMap[night.id] = nightReviews;

          const userReview = await DateReviewService.getUserReview(night.id, userId);
          userReviewsMap[night.id] = userReview;
        } catch (error) {
          console.warn(`Failed to load reviews for date night ${night.id}:`, error);
        }
      }
    }

    setReviews(reviewsMap);
    setUserReviews(userReviewsMap);
  };

  // Periodically check for review reminders
  useEffect(() => {
    if (!user || !userData?.pairId || !partnerData) return;

    // Check immediately
    if (pastNights.length > 0) {
      checkAndScheduleReviewReminders(
        pastNights,
        user.uid,
        userData.partnerId,
        partnerData.pushToken
      ).catch(err => {
        console.warn('Failed to check review reminders on mount:', err);
      });
    }

    // Check every hour when app is active
    const interval = setInterval(() => {
      if (pastNights.length > 0 && userData?.partnerId) {
        checkAndScheduleReviewReminders(
          pastNights,
          user.uid,
          userData.partnerId,
          partnerData?.pushToken
        ).catch(err => {
          console.warn('Failed to check review reminders on interval:', err);
        });
      }
    }, 60 * 60 * 1000); // Every hour

    return () => clearInterval(interval);
  }, [user, userData?.partnerId, partnerData, pastNights.length]);

  // Check for calendar deletions when app comes to foreground
  useEffect(() => {
    if (!user || !userData?.pairId) return;

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('📱 App came to foreground - checking for calendar deletions...');

        // Check if any calendar events were deleted
        DateNightService.getDateNights(userData.pairId).then((nights) => {
          DateNightService.checkAndSyncCalendarDeletions(nights, user.uid)
            .then((result) => {
              if (result.updatedCount > 0) {
                console.log(`📅 ${result.updatedCount} date(s) deleted from calendar and moved to past`);
                Alert.alert(
                  'Calendar Updated',
                  `${result.updatedCount} date(s) were removed from your calendar and moved to past dates.`
                );
              }
            })
            .catch((err) => {
              console.warn('Failed to check calendar deletions:', err);
            });
        }).catch((err) => {
          console.warn('Failed to get date nights for deletion check:', err);
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [user, userData?.pairId]);

  // Refresh user data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        // Force refresh user data
        getDoc(doc(db, 'users', user.uid)).then((snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            console.log('Date Nights - Focus refresh, user data:', {
              hasPairId: !!data.pairId,
              hasPartnerId: !!data.partnerId
            });
            setUserData(data);

            // Sync partner dates to calendar when screen is focused
            const effectivePairId = data.pairId || (data.partnerId ? `pair_${[user.uid, data.partnerId].sort().join('_')}` : null);
            if (effectivePairId) {
              console.log('🔄 Screen focused - syncing partner dates to calendar...');
              syncPartnerDatesToCalendar(effectivePairId, user.uid).catch(err => {
                console.warn('Failed to sync partner dates on focus:', err);
              });

              // Check if any calendar events were deleted (user deleted from calendar app)
              DateNightService.getDateNights(effectivePairId).then((nights) => {
                DateNightService.checkAndSyncCalendarDeletions(nights, user.uid)
                  .then((result) => {
                    if (result.updatedCount > 0) {
                      console.log(`📅 ${result.updatedCount} date(s) moved to past (deleted from calendar)`);
                      // The listener will automatically update the UI
                    }
                  })
                  .catch((err) => {
                    console.warn('Failed to check calendar deletions on focus:', err);
                  });
              }).catch((err) => {
                console.warn('Failed to get date nights for deletion check:', err);
              });
            }
          }
        });
      }
    }, [user, syncPartnerDatesToCalendar])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Refresh user data first
    if (user) {
      try {
        const userSnapshot = await getDoc(doc(db, 'users', user.uid));
        if (userSnapshot.exists()) {
          const data = userSnapshot.data();
          setUserData(data);

          if (data.pairId) {
            const nights = await DateNightService.getDateNights(data.pairId);
            setDateNights(nights);
          }
        }
      } catch (error) {
        console.error('Error refreshing:', error);
      }
    }
    setRefreshing(false);
  }, [user]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedDate(new Date());
    setSelectedTime(new Date());
    setLocation('');
    setCategory('other');
    setOtherCategoryText('');
    setDuration(120); // Reset to default 2 hours
    setReminderEnabled(true);
    setReminderOffset(30);
    setEditingDateNight(null);
  };

  const openCreateModal = () => {
    console.log('Opening create modal');
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (dateNight: DateNight) => {
    setEditingDateNight(dateNight);
    setTitle(dateNight.title);
    setDescription(dateNight.description || '');
    if (dateNight.date) {
      const dateObj = dateNight.date.toDate ? dateNight.date.toDate() : new Date(dateNight.date);
      setSelectedDate(dateObj);
      setSelectedTime(dateObj);
    }
    setLocation(dateNight.location || '');
    setCategory(dateNight.category || 'other');
    setOtherCategoryText((dateNight as any).otherCategoryText || '');
    setDuration(dateNight.duration || 120);
    setReminderEnabled(dateNight.reminders?.enabled ?? true);
    setReminderOffset(dateNight.reminders?.offsetMinutes ?? 30);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    // Get effective pairId - use existing or generate from partnerId if users are already paired
    let effectivePairId = userData?.pairId;

    if (!effectivePairId && userData?.partnerId && user) {
      // Users are paired (have partnerId) but missing pairId - generate consistent one
      const userIds = [user.uid, userData.partnerId].sort();
      effectivePairId = `pair_${userIds[0]}_${userIds[1]}`;

      // Update user document with pairId
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          pairId: effectivePairId,
          updatedAt: serverTimestamp(),
        });
        // Update local state
        setUserData({ ...userData, pairId: effectivePairId });
        console.log('✅ Generated and saved pairId from partnerId:', effectivePairId);
      } catch (error) {
        console.warn('Failed to update pairId (non-critical):', error);
      }
    }

    if (!user || !effectivePairId) {
      console.error('❌ No pairId or partnerId found. User data:', userData);
      Alert.alert(
        'Connection Required',
        'Please ensure you are connected with your partner. Both users must be paired to share date nights.'
      );
      return;
    }

    console.log('Creating date night with pairId:', effectivePairId);

    setSubmitting(true);
    try {
      // Combine date and time
      const combinedDateTime = new Date(selectedDate);
      combinedDateTime.setHours(selectedTime.getHours());
      combinedDateTime.setMinutes(selectedTime.getMinutes());
      combinedDateTime.setSeconds(0);
      combinedDateTime.setMilliseconds(0);

      // Validate "other" category
      if (category === 'other' && !otherCategoryText.trim()) {
        Alert.alert('Error', 'Please specify the category details');
        return;
      }

      // Build dateNightData without undefined values (Firestore doesn't accept undefined)
      const dateNightData: any = {
        title: title.trim(),
        date: Timestamp.fromDate(combinedDateTime),
        category,
        duration: duration, // Duration in minutes
        reminders: {
          enabled: reminderEnabled,
          offsetMinutes: reminderOffset,
        },
        completed: false,
      };

      // Only add optional fields if they have values
      if (description.trim()) {
        dateNightData.description = description.trim();
      }
      if (location.trim()) {
        dateNightData.location = location.trim();
      }

      // Add other category text if needed
      if (category === 'other' && otherCategoryText.trim()) {
        dateNightData.otherCategoryText = otherCategoryText.trim();
      }

      let dateNightId: string;
      let calendarEventId: string | null = null;

      if (editingDateNight) {
        const updaterName = userData?.displayName || userData?.name || user?.email?.split('@')[0] || 'Your partner';
        await DateNightService.updateDateNight(
          editingDateNight.id!,
          {
            ...dateNightData,
            completed: editingDateNight.completed,
          },
          userData?.partnerId,
          partnerData?.pushToken,
          updaterName
        );
        dateNightId = editingDateNight.id!;

        Alert.alert('Success', 'Date night updated! Your partner has been notified.');
      } else {
        // Create the date night first (with partner info for notifications and calendar sync)
        const creatorName = userData?.displayName || userData?.name || user?.email?.split('@')[0] || 'Your partner';

        console.log('📝 Creating date night:');
        console.log('  - pairId:', effectivePairId);
        console.log('  - createdBy:', user.uid);
        console.log('  - title:', dateNightData.title);
        console.log('  - date:', combinedDateTime.toISOString());

        dateNightId = await DateNightService.createDateNight(
          effectivePairId,
          user.uid,
          dateNightData,
          userData?.partnerId, // Partner ID
          partnerData?.pushToken, // Partner push token
          creatorName // Creator name for notification
        );
        console.log('✅ Date night created with ID:', dateNightId);
        console.log('✅ This date should now be visible to both users with pairId:', effectivePairId);

        // Schedule reminder notification
        if (reminderEnabled && combinedDateTime > new Date()) {
          try {
            await scheduleReminderNotification(dateNightId, title, combinedDateTime, reminderOffset);
            console.log('✅ Reminder notification scheduled');
          } catch (notificationError) {
            console.warn('Failed to schedule notification:', notificationError);
          }
        }

        // Note: Calendar event is already added in createDateNight() service method
        // No need to call addToCalendar again here to prevent duplicates
        Alert.alert(
          '✅ Success!',
          'Date night created and added to your Apple Calendar! Check your Calendar app.',
          [{ text: 'OK' }]
        );
      }

      // Wait a bit for Firestore to sync, then refresh
      setTimeout(() => {
        if (userData?.pairId) {
          console.log('Refreshing date nights after creation...');
          // Force refresh by re-setting up the listener
          const unsubscribe = setupDateNightsListener(userData.pairId);
          // The listener will auto-cleanup when component unmounts or pairId changes
        }
      }, 500);

      setShowModal(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving date night:', error);
      Alert.alert('Error', error.message || 'Failed to save date night');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (dateNight: DateNight) => {
    const isUpcomingDate = isUpcoming(dateNight.date) && !dateNight.completed;

    Alert.alert(
      isUpcomingDate ? 'Remove from Upcoming?' : 'Delete Date Night',
      isUpcomingDate
        ? `Do you want to remove "${dateNight.title}" from upcoming dates? It will be moved to past dates.`
        : `Are you sure you want to permanently delete "${dateNight.title}"? This will remove it from both calendars.`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...(isUpcomingDate ? [
          {
            text: 'Move to Past',
            style: 'default' as const,
            onPress: async () => {
              // Just mark as completed to move to past (UI only, doesn't delete from Firestore)
              await handleMarkCompleted(dateNight);
            },
          },
        ] : []),
        {
          text: isUpcomingDate ? 'Delete Permanently' : 'Delete',
          style: 'destructive' as const,
          onPress: async () => {
            try {
              const deleterName = userData?.displayName || userData?.name || user?.email?.split('@')[0] || 'Your partner';
              console.log('🗑️ Deleting date night:', dateNight.id);
              await DateNightService.deleteDateNight(
                dateNight.id!,
                userData?.partnerId,
                partnerData?.pushToken,
                deleterName,
                user?.uid // Pass current user ID so it can delete from their calendar
              );
              Alert.alert('Success', 'Date night deleted from both calendars. Your partner has been notified.');
            } catch (error: any) {
              console.error('❌ Delete error:', error);
              Alert.alert('Error', error.message || 'Failed to delete date night');
            }
          },
        },
      ]
    );
  };

  const handleMarkCompleted = async (dateNight: DateNight) => {
    try {
      const updaterName = userData?.displayName || userData?.name || user?.email?.split('@')[0] || 'Your partner';
      const newCompletedStatus = !dateNight.completed;

      await DateNightService.updateDateNight(
        dateNight.id!,
        {
          completed: newCompletedStatus,
        },
        userData?.partnerId,
        partnerData?.pushToken,
        updaterName
      );

      // Show success message
      if (newCompletedStatus) {
        Alert.alert('✅ Date Completed', `"${dateNight.title}" has been marked as completed and moved to past dates.`);
      } else {
        Alert.alert('✅ Date Reopened', `"${dateNight.title}" has been moved back to upcoming dates.`);
      }
    } catch (error: any) {
      console.error('Mark completed error:', error);
      Alert.alert('Error', error.message || 'Failed to update date night');
    }
  };

  const handleLaunchFaceTime = async (dateNight: DateNight) => {
    if (!partnerData) {
      Alert.alert('Error', 'Partner information not available');
      return;
    }

    // Get FaceTime contact (prefer faceTimeContact, then faceTimeEmail, then email)
    const faceTimeContact = partnerData.faceTimeContact || partnerData.faceTimeEmail || partnerData.email;
    const phoneNumber = partnerData.phoneNumber || partnerData.phone;

    if (!faceTimeContact && !phoneNumber) {
      Alert.alert('Error', 'Partner contact information not available');
      return;
    }

    try {
      // Use SOS service's smart FaceTime launch (handles internet check, fallback to phone)
      if (faceTimeContact) {
        await SOSService.launchFaceTime(faceTimeContact);
      } else if (phoneNumber) {
        // Fallback to regular phone call if no FaceTime contact
        const telUrl = `tel:${phoneNumber.replace(/[\s\-\(\)]/g, '')}`;
        const canOpenTel = await Linking.canOpenURL(telUrl);
        if (canOpenTel) {
          await Linking.openURL(telUrl);
        } else {
          throw new Error('Could not launch phone call');
        }
      }
    } catch (error: any) {
      console.error('FaceTime launch error:', error);
      Alert.alert('Error', error.message || 'Failed to launch FaceTime or phone call');
    }
  };

  const handleOpenReview = (dateNight: DateNight) => {
    setSelectedDateNightForReview(dateNight);
    setShowReviewModal(true);
  };

  const handleSubmitReview = async (review: {
    rating: number;
    message: string;
    emoji?: string;
    images?: string[];
    videos?: string[];
  }) => {
    if (!user || !selectedDateNightForReview?.id) return;

    try {
      // Check if user already reviewed
      const existingReview = await DateReviewService.getUserReview(selectedDateNightForReview.id, user.uid);

      if (existingReview) {
        // Update existing review
        await DateReviewService.updateReview(existingReview.id!, {
          rating: review.rating,
          message: review.message,
          emoji: review.emoji,
          images: review.images,
          videos: review.videos,
        });
        Alert.alert('Success', 'Review updated!');
      } else {
        // Create new review
        await DateReviewService.createReview(
          selectedDateNightForReview.id,
          user.uid,
          {
            rating: review.rating,
            message: review.message,
            emoji: review.emoji,
            images: review.images,
            videos: review.videos,
            userName: userData?.displayName || userData?.name || user.email?.split('@')[0],
          }
        );
        Alert.alert('Success', 'Review submitted!');
      }

      // Reviews will be updated automatically by real-time listeners
      // The listeners will pick up the changes immediately via Firestore onSnapshot
      // Close modal immediately - real-time updates will handle the UI refresh
      setShowReviewModal(false);
      setSelectedDateNightForReview(null);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to submit review');
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

  // Check if user is paired - either has pairId or partnerId
  // If they have partnerId but no pairId, pairId will be auto-generated
  const hasPair = userData?.pairId || userData?.partnerId;

  if (!hasPair) {
    return (
      <SwipeableTabWrapper tabIndex={2} totalTabs={4}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.title}>Date Nights</Text>
          </View>
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={theme.colors.textLight} />
            <Text style={styles.emptyText}>No partner connected</Text>
            <Text style={styles.emptySubtext}>Connect with your partner to plan date nights</Text>
            <Button
              title="Connect Partner"
              onPress={() => router.push('/invite')}
              variant="primary"
              style={{ marginTop: theme.spacing.lg }}
            />
            <Text style={styles.debugText}>
              {userData ? `User ID: ${user?.uid?.substring(0, 8)}...\npairId: ${userData.pairId || 'Will be auto-generated'}\npartnerId: ${userData.partnerId || 'none'}` : 'Loading user data...'}
            </Text>
            {userData && !userData.pairId && userData.partnerId && (
              <Text style={[styles.debugText, { color: theme.colors.info, marginTop: theme.spacing.sm }]}>
                ℹ️ Note: pairId will be automatically generated from your partnerId when you create your first date.
              </Text>
            )}
          </View>
        </SafeAreaView>
      </SwipeableTabWrapper>
    );
  }

  return (
    <SwipeableTabWrapper tabIndex={2} totalTabs={4}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Date Nights</Text>
        </View>

        {/* Tabs for Upcoming and Past dates - Always visible */}
        <View style={styles.tabsContainer}>
          <SimpleTabs
            tabs={[
              { id: 'upcoming', label: `Upcoming (${upcomingNights.length})` },
              { id: 'past', label: `Past Moments (${sortedPastNights.length})` },
            ]}
            activeTab={activeDateTab}
            onTabChange={(tabId) => setActiveDateTab(tabId as 'upcoming' | 'past')}
          />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          directionalLockEnabled={true}
          horizontal={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          {viewMode === 'calendar' && (
            <View style={styles.calendarSection}>
              {/* Only show calendar for upcoming dates */}
              {activeDateTab === 'upcoming' && (
                <DateCalendar
                  dateNights={upcomingNights}
                  onDateSelect={(dateNight) => {
                    setSelectedCalendarDate(dateNight);
                    if (isUpcoming(dateNight.date)) {
                      openEditModal(dateNight);
                    }
                  }}
                  selectedDate={selectedCalendarDate ?? undefined}
                />
              )}

              {/* Upcoming Tab Content */}
              {activeDateTab === 'upcoming' && (
                <>
                  {upcomingNights.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="calendar-outline" size={64} color={theme.colors.textLight} />
                      <Text style={styles.emptyText}>No upcoming dates</Text>
                      <Text style={styles.emptySubtext}>Plan your next date night together</Text>
                      <Button
                        title="Create Date Night"
                        onPress={openCreateModal}
                        variant="primary"
                        style={{ marginTop: theme.spacing.lg }}
                      />
                    </View>
                  ) : (
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Upcoming Dates ({upcomingNights.length})</Text>
                        <Text style={styles.sectionSubtitle}>Your upcoming plans together</Text>
                      </View>
                      {upcomingNights.map((dateNight) => (
                        <DateNightCard
                          key={dateNight.id}
                          dateNight={dateNight}
                          partnerData={partnerData}
                          user={user}
                          userData={userData}
                          reviews={reviews[dateNight.id!] || []}
                          userReview={userReviews[dateNight.id!]}
                          onEdit={() => openEditModal(dateNight)}
                          onDelete={() => handleDelete(dateNight)}
                          onMarkCompleted={() => handleMarkCompleted(dateNight)}
                          onLaunchFaceTime={() => handleLaunchFaceTime(dateNight)}
                          onReview={() => { }}
                        />
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* Past Tab Content - Scrapbook Design */}
              {activeDateTab === 'past' && (
                <LinearGradient
                  colors={['#F5E6D3', '#F0D4C4', '#EBC5B8', '#E8BDB0']}
                  style={styles.scrapbookGradient}
                >
                  {sortedPastNights.length === 0 ? (
                    <View style={styles.scrapbookEmptyContainer}>
                      <Ionicons name="heart-outline" size={64} color="#C25068" />
                      <Text style={styles.scrapbookEmptyText}>No memories yet</Text>
                      <Text style={styles.scrapbookEmptySubtext}>Your date memories will appear here</Text>
                    </View>
                  ) : (
                    <>
                      {/* Scrapbook Header */}
                      <View style={styles.scrapbookHeader}>
                        <Text style={styles.scrapbookTitle}>Memories & Notes</Text>
                        <View style={styles.scrapbookLocationRow}>
                          <Ionicons name="location" size={14} color="#C25068" />
                          <Text style={styles.scrapbookSubtitle}>Our Journey</Text>
                        </View>
                      </View>

                      {/* Polaroid Memory Cards */}
                      {sortedPastNights.map((dateNight, index) => {
                        const date = dateNight.date?.toDate ? dateNight.date.toDate() : new Date(dateNight.date);
                        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

                        // Get review data for this date
                        const dateReviews = reviews[dateNight.id!] || [];
                        const avgRating = dateReviews.length > 0
                          ? dateReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / dateReviews.length
                          : 0;
                        const firstReview = dateReviews[0];

                        // Get first media from reviews
                        const firstMedia = firstReview?.images?.[0] || firstReview?.videos?.[0];
                        const mediaType = firstReview?.videos?.[0] ? 'video' : 'image';

                        // Collect ALL media from both partners' reviews for this date
                        const allMedia: Array<{ uri: string; type: 'image' | 'video' }> = [];
                        dateReviews.forEach(review => {
                          // Add images
                          review.images?.forEach(uri => allMedia.push({ uri, type: 'image' }));
                          // Add videos
                          review.videos?.forEach(uri => allMedia.push({ uri, type: 'video' }));
                        });

                        // Alternate rotation for visual interest
                        const rotation = index % 3 === 0 ? 'left' : index % 3 === 1 ? 'right' : 'none';

                        return (
                          <PolaroidMemoryCard
                            key={dateNight.id}
                            title={dateNight.title || 'Date Night'}
                            date={formattedDate}
                            location={dateNight.location}
                            rating={Math.round(avgRating)}
                            comment={firstReview?.message}
                            mediaUri={firstMedia}
                            mediaType={mediaType}
                            rotation={rotation}
                            hasTape={index % 2 === 0}
                            hasClip={index % 2 === 1}
                            onPress={() => {
                              console.log('Polaroid card tapped!', {
                                dateNightId: dateNight.id,
                                allMediaCount: allMedia.length,
                                allMedia: allMedia
                              });
                              if (allMedia.length > 0) {
                                // Open media preview with all images/videos
                                console.log('Opening media preview with', allMedia.length, 'items');
                                openMediaPreview(allMedia, 0);
                              } else {
                                // No media - open review modal
                                console.log('No media found, opening review modal');
                                handleOpenReview(dateNight);
                              }
                            }}
                            onEdit={() => handleOpenReview(dateNight)}
                          />
                        );
                      })}

                      {/* Memory Stats Section */}
                      <MemoryStats
                        averageRating={
                          Object.values(reviews).flat().length > 0
                            ? Object.values(reviews).flat().reduce((sum, r) => sum + (r.rating || 0), 0) / Object.values(reviews).flat().length
                            : 0
                        }
                        totalMemories={sortedPastNights.length}
                      />

                      {/* Footer prompt */}
                      <View style={styles.scrapbookFooter}>
                        <Text style={styles.scrapbookFooterText}>Where will we go next?</Text>
                        <Ionicons name="airplane" size={20} color="#C25068" />
                      </View>
                    </>
                  )}
                </LinearGradient>
              )}


            </View>
          )}

          {viewMode === 'list' && (
            <>
              {/* Debug Info - Remove in production */}
              {__DEV__ && (
                <View style={styles.debugSection}>
                  <Text style={styles.debugTitle}>Debug Info</Text>
                  <Text style={styles.debugText}>
                    Total dates: {dateNights.length}{'\n'}
                    Upcoming: {upcomingNights.length}{'\n'}
                    Past: {sortedPastNights.length}{'\n'}
                    pairId: {userData?.pairId || 'MISSING'}{'\n'}
                    Loading: {loading ? 'Yes' : 'No'}
                  </Text>
                </View>
              )}

              {/* Upcoming Tab Content */}
              {activeDateTab === 'upcoming' && (
                <>
                  {upcomingNights.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="calendar-outline" size={64} color={theme.colors.textLight} />
                      <Text style={styles.emptyText}>No upcoming dates</Text>
                      <Text style={styles.emptySubtext}>Plan your next date night together</Text>
                      <Button
                        title="Create Date Night"
                        onPress={openCreateModal}
                        variant="primary"
                        style={{ marginTop: theme.spacing.lg }}
                      />
                    </View>
                  ) : (
                    <View style={styles.section}>
                      {upcomingNights.map((dateNight) => (
                        <DateNightCard
                          key={dateNight.id}
                          dateNight={dateNight}
                          partnerData={partnerData}
                          user={user}
                          userData={userData}
                          onEdit={() => openEditModal(dateNight)}
                          onDelete={() => handleDelete(dateNight)}
                          onMarkCompleted={() => handleMarkCompleted(dateNight)}
                          onLaunchFaceTime={() => handleLaunchFaceTime(dateNight)}
                          onReview={() => { }}
                        />
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* Past Tab Content - Scrapbook Design */}
              {activeDateTab === 'past' && (
                <LinearGradient
                  colors={['#F5E6D3', '#F0D4C4', '#EBC5B8', '#E8BDB0']}
                  style={styles.scrapbookGradient}
                >
                  {sortedPastNights.length === 0 ? (
                    <View style={styles.scrapbookEmptyContainer}>
                      <Ionicons name="heart-outline" size={64} color="#C25068" />
                      <Text style={styles.scrapbookEmptyText}>No memories yet</Text>
                      <Text style={styles.scrapbookEmptySubtext}>Your date memories will appear here</Text>
                    </View>
                  ) : (
                    <>
                      {/* Scrapbook Header */}
                      <View style={styles.scrapbookHeader}>
                        <Text style={styles.scrapbookTitle}>Memories & Notes</Text>
                        <View style={styles.scrapbookLocationRow}>
                          <Ionicons name="location" size={14} color="#C25068" />
                          <Text style={styles.scrapbookSubtitle}>Our Journey</Text>
                        </View>
                      </View>

                      {/* Polaroid Memory Cards */}
                      {sortedPastNights.map((dateNight, index) => {
                        const date = dateNight.date?.toDate ? dateNight.date.toDate() : new Date(dateNight.date);
                        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

                        // Get review data for this date
                        const dateReviews = reviews[dateNight.id!] || [];
                        const avgRating = dateReviews.length > 0
                          ? dateReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / dateReviews.length
                          : 0;
                        const firstReview = dateReviews[0];

                        // Get first media from reviews
                        const firstMedia = firstReview?.images?.[0] || firstReview?.videos?.[0];
                        const mediaType = firstReview?.videos?.[0] ? 'video' : 'image';

                        // Alternate rotation for visual interest
                        const rotation = index % 3 === 0 ? 'left' : index % 3 === 1 ? 'right' : 'none';

                        return (
                          <PolaroidMemoryCard
                            key={dateNight.id}
                            title={dateNight.title || 'Date Night'}
                            date={formattedDate}
                            location={dateNight.location}
                            rating={Math.round(avgRating)}
                            comment={firstReview?.message}
                            mediaUri={firstMedia}
                            mediaType={mediaType}
                            rotation={rotation}
                            hasTape={index % 2 === 0}
                            hasClip={index % 2 === 1}
                            onPress={() => handleOpenReview(dateNight)}
                          />
                        );
                      })}

                      {/* Memory Stats Section */}
                      <MemoryStats
                        averageRating={
                          Object.values(reviews).flat().length > 0
                            ? Object.values(reviews).flat().reduce((sum, r) => sum + (r.rating || 0), 0) / Object.values(reviews).flat().length
                            : 0
                        }
                        totalMemories={sortedPastNights.length}
                      />

                      {/* Footer prompt */}
                      <View style={styles.scrapbookFooter}>
                        <Text style={styles.scrapbookFooterText}>Where will we go next?</Text>
                        <Ionicons name="airplane" size={20} color="#C25068" />
                      </View>
                    </>
                  )}
                </LinearGradient>
              )}

            </>

          )}
        </ScrollView>

        {/* Floating Action Button - Only visible on Upcoming tab */}
        {activeDateTab === 'upcoming' && (
          <TouchableOpacity
            style={styles.fab}
            onPress={openCreateModal}
            activeOpacity={0.8}
            accessibilityLabel="Create new date night"
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Create/Edit Modal - Simplified */}
        <Modal
          visible={showModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowModal(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              Keyboard.dismiss();
              setShowModal(false);
            }}
          >
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingDateNight ? 'Edit Date' : '✨ Plan a Date'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowModal(false);
                  }}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: theme.spacing.md }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Essential: Title */}
                <Input
                  label="What's the plan? *"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g., Movie Night, Dinner at Olive Garden..."
                />

                {/* Essential: Date & Time in one row */}
                <View style={styles.row}>
                  <View style={styles.halfWidth}>
                    <DateTimePicker
                      label="When?"
                      value={selectedDate}
                      onChange={(date) => setSelectedDate(date)}
                      mode="date"
                      minimumDate={new Date()}
                    />
                  </View>

                  <View style={styles.halfWidth}>
                    <DateTimePicker
                      label="Time"
                      value={selectedTime}
                      onChange={(time) => setSelectedTime(time)}
                      mode="time"
                    />
                  </View>
                </View>

                {/* Quick Category Selection - Icon buttons */}
                <Text style={styles.inputLabel}>Type</Text>
                <View style={styles.quickCategoryRow}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.quickCategoryButton,
                        category === cat.id && styles.quickCategoryButtonActive,
                        category === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '15' },
                      ]}
                      onPress={() => {
                        setCategory(cat.id as DateNight['category']);
                        if (cat.id !== 'other') setOtherCategoryText('');
                        Keyboard.dismiss();
                      }}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={24}
                        color={category === cat.id ? cat.color : theme.colors.textSecondary}
                      />
                      <Text style={[
                        styles.quickCategoryText,
                        category === cat.id && { color: cat.color, fontWeight: '600' },
                      ]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {category === 'other' && (
                  <Input
                    label="Specify type"
                    value={otherCategoryText}
                    onChangeText={setOtherCategoryText}
                    placeholder="e.g., Concert, Festival..."
                  />
                )}

                {/* Optional fields in collapsible style - always visible but compact */}
                <View style={styles.optionalSection}>
                  <Input
                    label="Location (optional)"
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Where will you go?"
                  />

                  <Input
                    label="Notes (optional)"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Any special plans or ideas..."
                    multiline
                    numberOfLines={2}
                  />

                  {/* Duration - Simplified */}
                  <Text style={styles.inputLabel}>Duration</Text>
                  <View style={styles.simpleDurationRow}>
                    {[
                      { label: '1h', value: 60 },
                      { label: '2h', value: 120 },
                      { label: '3h', value: 180 },
                      { label: '4h+', value: 240 },
                    ].map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.simpleDurationOption,
                          duration === option.value && styles.simpleDurationOptionActive,
                        ]}
                        onPress={() => setDuration(option.value)}
                      >
                        <Text
                          style={[
                            styles.simpleDurationText,
                            duration === option.value && styles.simpleDurationTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Reminder - Single toggle with auto 30min default */}
                  <View style={styles.simpleReminderRow}>
                    <View style={styles.reminderInfo}>
                      <Ionicons name="notifications-outline" size={20} color={theme.colors.textSecondary} />
                      <Text style={styles.reminderLabel}>
                        Remind me {reminderEnabled ? REMINDER_OPTIONS.find(o => o.value === reminderOffset)?.label || '30 min before' : ''}
                      </Text>
                    </View>
                    <Switch
                      value={reminderEnabled}
                      onValueChange={setReminderEnabled}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
              </ScrollView>

              {/* Action Button - Single prominent button */}
              <View style={styles.modalActions}>
                <Button
                  title={editingDateNight ? 'Save Changes' : '💕 Create Date'}
                  onPress={handleSubmit}
                  variant="primary"
                  loading={submitting}
                  disabled={submitting || !title.trim()}
                  style={{ flex: 1 }}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Review Modal */}
        {selectedDateNightForReview && (
          <DateReviewModal
            visible={showReviewModal}
            dateNightTitle={selectedDateNightForReview.title}
            dateNightId={selectedDateNightForReview.id!}
            userId={user?.uid || ''}
            userName={userData?.displayName || userData?.name || user?.email?.split('@')[0]}
            existingReview={userReviews[selectedDateNightForReview.id!] ? {
              rating: userReviews[selectedDateNightForReview.id!]!.rating,
              message: userReviews[selectedDateNightForReview.id!]!.message,
              emoji: userReviews[selectedDateNightForReview.id!]!.emoji,
              images: userReviews[selectedDateNightForReview.id!]!.images,
              videos: userReviews[selectedDateNightForReview.id!]!.videos,
            } : null}
            onClose={() => {
              setShowReviewModal(false);
              setSelectedDateNightForReview(null);
            }}
            onSubmit={handleSubmitReview}
          />
        )}

        {/* Media Preview Modal - Must be at main component level */}
        <MediaPreviewModal
          visible={previewVisible}
          mediaItems={previewItems}
          initialIndex={previewInitialIndex}
          onClose={() => setPreviewVisible(false)}
        />
      </SafeAreaView>
    </SwipeableTabWrapper>
  );
}

// Media Gallery Item Component (for memories gallery)
function MediaGalleryItem({
  item,
  index,
  allItems,
  onPress,
}: {
  item: { uri: string; type: 'image' | 'video' };
  index: number;
  allItems: Array<{ uri: string; type: 'image' | 'video' }>;
  onPress: (items: Array<{ uri: string; type: 'image' | 'video' }>, initialIndex: number) => void;
}) {
  const [imageError, setImageError] = useState(false);

  // Log image URL for debugging
  if (__DEV__ && item.type === 'image') {
    console.log(`🖼️ Loading image ${index + 1}/${allItems.length}:`, {
      uri: item.uri?.substring(0, 100),
      isFirebaseURL: item.uri?.includes('firebasestorage') || item.uri?.includes('googleapis'),
    });
  }

  return (
    <TouchableOpacity
      key={`media-${index}`}
      activeOpacity={0.9}
      style={styles.photoGalleryItem}
      onPress={() => onPress(allItems, index)}
    >
      {item.type === 'image' ? (
        imageError ? (
          <View style={[styles.photoGalleryImage, styles.imageErrorContainer]}>
            <Ionicons name="image-outline" size={24} color={theme.colors.textSecondary} />
            <Text style={styles.imageErrorText}>Failed to load</Text>
          </View>
        ) : (
          <Image
            source={{ uri: item.uri }}
            style={styles.photoGalleryImage}
            resizeMode="cover"
            onError={(error) => {
              console.error(`❌ Failed to load image ${index + 1}:`, {
                uri: item.uri?.substring(0, 100),
                error: error.nativeEvent?.error || 'Unknown error',
              });
              setImageError(true);
            }}
            onLoad={() => {
              if (__DEV__) {
                console.log(`✅ Successfully loaded image ${index + 1}`);
              }
            }}
          />
        )
      ) : (
        <View style={styles.photoGalleryVideoContainer}>
          <Ionicons name="play-circle" size={32} color="#fff" />
          <Text style={styles.videoBadge}>Video</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Review Media Item Component (for review images/videos)
function ReviewMediaItem({
  uri,
  type,
  index,
  reviewId,
  reviewMediaItems,
  onPress,
  isCurrentUser,
  user,
  reviewUserId,
}: {
  uri: string;
  type: 'image' | 'video';
  index: number;
  reviewId?: string;
  reviewMediaItems: Array<{ uri: string; type: 'image' | 'video' }>;
  onPress: (items: Array<{ uri: string; type: 'image' | 'video' }>, initialIndex: number) => void;
  isCurrentUser: boolean;
  user: any;
  reviewUserId?: string;
}) {
  const [imageError, setImageError] = useState(false);

  // Log image URL for debugging (only for partner's images)
  if (__DEV__ && !isCurrentUser && type === 'image') {
    console.log(`🖼️ Loading partner image ${index + 1} from review ${reviewId}:`, {
      uri: uri?.substring(0, 100),
      isFirebaseURL: uri?.includes('firebasestorage') || uri?.includes('googleapis'),
      reviewUserId: reviewUserId,
      currentUserId: user?.uid,
    });
  }

  if (type === 'image') {
    return (
      <TouchableOpacity
        key={`img-${reviewId}-${index}`}
        activeOpacity={0.9}
        style={styles.reviewMediaItemWrapper}
        onPress={() => onPress(reviewMediaItems, index)}
      >
        {imageError ? (
          <View style={[styles.reviewMediaItem, styles.imageErrorContainer]}>
            <Ionicons name="image-outline" size={20} color={theme.colors.textSecondary} />
          </View>
        ) : (
          <Image
            source={{ uri }}
            style={styles.reviewMediaItem}
            resizeMode="cover"
            onError={(error) => {
              console.error(`❌ Failed to load partner image ${index + 1} from review ${reviewId}:`, {
                uri: uri?.substring(0, 100),
                error: error.nativeEvent?.error || 'Unknown error',
                reviewUserId: reviewUserId,
                currentUserId: user?.uid,
              });
              setImageError(true);
            }}
            onLoad={() => {
              if (__DEV__ && !isCurrentUser) {
                console.log(`✅ Successfully loaded partner image ${index + 1} from review ${reviewId}`);
              }
            }}
          />
        )}
      </TouchableOpacity>
    );
  } else {
    return (
      <TouchableOpacity
        key={`vid-${reviewId}-${index}`}
        activeOpacity={0.9}
        style={styles.reviewMediaItemWrapper}
        onPress={() => onPress(reviewMediaItems, index)}
      >
        <View style={[styles.reviewMediaItem, styles.videoPlaceholder]}>
          <Ionicons name="play-circle" size={32} color={theme.colors.primary} />
          <Text style={styles.videoLabel}>Video</Text>
        </View>
      </TouchableOpacity>
    );
  }
}

// Date Night Card Component
function DateNightCard({
  dateNight,
  partnerData,
  user,
  userData,
  reviews,
  userReview,
  onEdit,
  onDelete,
  onMarkCompleted,
  onLaunchFaceTime,
  onReview,
}: {
  dateNight: DateNight;
  partnerData: any;
  user: any;
  userData: any;
  reviews?: DateReview[];
  userReview?: DateReview | null;
  onEdit: () => void;
  onDelete: () => void;
  onMarkCompleted: () => void;
  onLaunchFaceTime: () => void;
  onReview: () => void;
}) {
  const date = dateNight.date?.toDate ? dateNight.date.toDate() : new Date(dateNight.date);
  const categoryInfo = CATEGORIES.find(cat => cat.id === dateNight.category) || CATEGORIES[4];
  const isUpcomingDate = isUpcoming(dateNight.date) && !dateNight.completed;
  const isPastDate = !isUpcomingDate;
  const partnerReview = reviews?.find(r => r.userId !== user?.uid) || null;

  // Collect all photos and videos from both partners' reviews for Memories gallery
  const allMediaItems: Array<{ uri: string; type: 'image' | 'video' }> = [];
  if (isPastDate && reviews) {
    reviews.forEach(review => {
      if (review.images && Array.isArray(review.images) && review.images.length > 0) {
        review.images.forEach(uri => {
          allMediaItems.push({ uri, type: 'image' });
        });
      }
      if (review.videos && Array.isArray(review.videos) && review.videos.length > 0) {
        review.videos.forEach(uri => {
          allMediaItems.push({ uri, type: 'video' });
        });
      }
    });
  }

  // State for media preview modal
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewItems, setPreviewItems] = useState<Array<{ uri: string; type: 'image' | 'video' }>>([]);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);

  const openMediaPreview = (items: Array<{ uri: string; type: 'image' | 'video' }>, initialIndex: number = 0) => {
    setPreviewItems(items);
    setPreviewInitialIndex(initialIndex);
    setPreviewVisible(true);
  };

  return (
    <View style={[styles.dateCard, dateNight.completed && styles.dateCardCompleted]}>
      <View style={styles.dateCardHeader}>
        <View style={styles.dateCardTitleRow}>
          <Ionicons name={categoryInfo.icon as any} size={24} color={categoryInfo.color} />
          <View style={styles.dateCardTitleContainer}>
            <Text style={styles.dateCardTitle}>{dateNight.title}</Text>
            {dateNight.completed && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                <Text style={styles.completedText}>Completed</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.dateCardActions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
            <Ionicons name="create-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {dateNight.description && (
        <Text style={styles.dateCardDescription}>{dateNight.description}</Text>
      )}

      <View style={styles.dateCardInfo}>
        <View style={styles.dateCardInfoRow}>
          <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.dateCardInfoText}>
            {formatDate(date)} • {formatTimeRange(date, dateNight.duration || 120)}
          </Text>
        </View>
        {dateNight.location && (
          <View style={styles.dateCardInfoRow}>
            <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.dateCardInfoText}>{dateNight.location}</Text>
          </View>
        )}
        {dateNight.reminders?.enabled && (
          <View style={styles.dateCardInfoRow}>
            <Ionicons name="notifications-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.dateCardInfoText}>
              Reminder: {REMINDER_OPTIONS.find(opt => opt.value === dateNight.reminders?.offsetMinutes)?.label || 'Enabled'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.dateCardFooter}>
        {isUpcomingDate && (
          <TouchableOpacity
            style={styles.faceTimeButton}
            onPress={onLaunchFaceTime}
          >
            <Ionicons name="videocam" size={18} color="#fff" />
            <Text style={styles.faceTimeButtonText}>FaceTime</Text>
          </TouchableOpacity>
        )}
        {isPastDate && (
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={onReview}
          >
            <Ionicons name={userReview ? "star" : "star-outline"} size={18} color="#fff" />
            <Text style={styles.reviewButtonText}>
              {userReview ? 'Edit Review' : 'Leave Review'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.completeButton,
            dateNight.completed && styles.completeButtonActive,
          ]}
          onPress={isPastDate && dateNight.completed ? undefined : onMarkCompleted}
          disabled={isPastDate && dateNight.completed}
          activeOpacity={isPastDate && dateNight.completed ? 1 : 0.7}
        >
          <Ionicons
            name={dateNight.completed ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={
              dateNight.completed
                ? theme.colors.success
                : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.completeButtonText,
              dateNight.completed && styles.completeButtonTextActive,
            ]}
          >
            {dateNight.completed ? 'Completed' : 'Mark Complete'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Memories Gallery Section for Past Dates - All photos and videos from both partners */}
      {isPastDate && allMediaItems.length > 0 && (
        <View style={styles.photosGallerySection}>
          <View style={styles.photosGalleryHeader}>
            <Ionicons name="images" size={20} color={theme.colors.primary} />
            <Text style={styles.photosGalleryTitle}>
              Memories ({allMediaItems.length})
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photosGalleryScroll}
            contentContainerStyle={styles.photosGalleryContent}
          >
            {allMediaItems.map((item, index) => (
              <MediaGalleryItem
                key={`media-${index}`}
                item={item}
                index={index}
                allItems={allMediaItems}
                onPress={openMediaPreview}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Reviews Section for Past Dates */}
      {isPastDate && reviews && reviews.length > 0 && (
        <View style={styles.reviewsSection}>
          <Text style={styles.reviewsTitle}>Reviews</Text>
          {reviews.map((review) => {
            const isCurrentUser = review.userId === user?.uid;
            // Debug: Log review data to check images/videos
            if (__DEV__ && (review.images || review.videos)) {
              console.log('📸 Review media data:', {
                reviewId: review.id,
                userId: review.userId,
                images: review.images,
                videos: review.videos,
                imagesLength: review.images?.length || 0,
                videosLength: review.videos?.length || 0,
              });
            }
            return (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewUserInfo}>
                    <Text style={styles.reviewUserName}>
                      {isCurrentUser ? 'You' : (review.userName || partnerData?.displayName || partnerData?.name || 'Partner')}
                    </Text>
                    {review.emoji && <Text style={styles.reviewEmoji}>{review.emoji}</Text>}
                  </View>
                  <View style={styles.reviewRating}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= review.rating ? 'star' : 'star-outline'}
                        size={16}
                        color={star <= review.rating ? '#FFD700' : theme.colors.border}
                      />
                    ))}
                  </View>
                </View>
                {review.message && (
                  <Text style={styles.reviewMessage}>{review.message}</Text>
                )}
                {((review.images && Array.isArray(review.images) && review.images.length > 0) ||
                  (review.videos && Array.isArray(review.videos) && review.videos.length > 0)) && (
                    <View style={styles.reviewMediaContainer}>
                      {/* Combine images and videos into one scrollable list */}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.reviewMedia}
                        contentContainerStyle={styles.reviewMediaContent}
                      >
                        {/* Images */}
                        {review.images && Array.isArray(review.images) && review.images.map((uri, index) => {
                          // Build all media items from this review for preview
                          const reviewMediaItems: Array<{ uri: string; type: 'image' | 'video' }> = [
                            ...(review.images?.map((u: string) => ({ uri: u, type: 'image' as const })) || []),
                            ...(review.videos?.map((u: string) => ({ uri: u, type: 'video' as const })) || []),
                          ];
                          const mediaIndex = index;

                          return (
                            <ReviewMediaItem
                              key={`img-${review.id}-${index}`}
                              uri={uri}
                              type="image"
                              index={mediaIndex}
                              reviewId={review.id}
                              reviewMediaItems={reviewMediaItems}
                              onPress={openMediaPreview}
                              isCurrentUser={isCurrentUser}
                              user={user}
                              reviewUserId={review.userId}
                            />
                          );
                        })}
                        {/* Videos */}
                        {review.videos && Array.isArray(review.videos) && review.videos.map((uri, index) => {
                          // Build all media items from this review for preview
                          const reviewMediaItems: Array<{ uri: string; type: 'image' | 'video' }> = [
                            ...(review.images?.map((u: string) => ({ uri: u, type: 'image' as const })) || []),
                            ...(review.videos?.map((u: string) => ({ uri: u, type: 'video' as const })) || []),
                          ];
                          const mediaIndex = (review.images?.length || 0) + index;

                          return (
                            <ReviewMediaItem
                              key={`vid-${review.id}-${index}`}
                              uri={uri}
                              type="video"
                              index={mediaIndex}
                              reviewId={review.id}
                              reviewMediaItems={reviewMediaItems}
                              onPress={openMediaPreview}
                              isCurrentUser={isCurrentUser}
                              user={user}
                              reviewUserId={review.userId}
                            />
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
              </View>
            );
          })}
        </View>
      )}
    </View>
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
    paddingHorizontal: theme.spacing.md,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  viewToggle: {
    padding: theme.spacing.xs,
  },
  addButton: {
    padding: theme.spacing.xs,
  },
  calendarSection: {
    marginBottom: theme.spacing.lg,
  },
  viewMoreButton: {
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  viewMoreText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
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
  debugSection: {
    backgroundColor: theme.colors.divider,
    padding: theme.spacing.md,
    margin: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  debugTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  debugText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textLight,
    marginTop: theme.spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  tabsContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    backgroundColor: theme.colors.background,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  sectionSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  monthHeader: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.divider,
    borderRadius: theme.borderRadius.sm,
  },
  monthHeaderText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  dateCardCompleted: {
    backgroundColor: theme.colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.success,
  },
  dateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  dateCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateCardTitleContainer: {
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  dateCardTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  completedText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.success,
    marginLeft: theme.spacing.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
  dateCardActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
  },
  dateCardDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  dateCardInfo: {
    marginBottom: theme.spacing.sm,
  },
  dateCardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  dateCardInfoText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  dateCardFooter: {
    flexDirection: 'row',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  faceTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    flex: 1,
    justifyContent: 'center',
  },
  faceTimeButtonText: {
    color: '#fff',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    marginLeft: theme.spacing.xs,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.divider,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    flex: 1,
    justifyContent: 'center',
  },
  completeButtonActive: {
    backgroundColor: theme.colors.success + '20',
  },
  completeButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    marginLeft: theme.spacing.xs,
  },
  completeButtonTextActive: {
    color: theme.colors.success,
  },
  completeButtonDisabled: {
    backgroundColor: theme.colors.divider,
    opacity: 0.6,
  },
  completeButtonTextDisabled: {
    color: theme.colors.textLight,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '90%',
    flex: 1,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
  },
  modalScroll: {
    flex: 1,
    padding: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  inputLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.xs,
  },
  dateTimeText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text,
  },
  durationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  durationOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.divider,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  durationOptionActive: {
    backgroundColor: theme.colors.primary + '20',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  durationOptionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.medium,
  },
  durationOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.xs,
    minWidth: 100,
  },
  categoryButtonActive: {
    borderWidth: 2,
    backgroundColor: theme.colors.background,
  },
  categoryText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  // Simplified form styles
  quickCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  quickCategoryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    minHeight: 60,
  },
  quickCategoryButtonActive: {
    borderWidth: 2,
  },
  quickCategoryText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs / 2,
    textAlign: 'center',
  },
  optionalSection: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  simpleDurationRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  simpleDurationOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.divider,
    alignItems: 'center',
  },
  simpleDurationOptionActive: {
    backgroundColor: theme.colors.primary,
  },
  simpleDurationText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeight.medium,
  },
  simpleDurationTextActive: {
    color: '#fff',
    fontWeight: theme.typography.fontWeight.bold,
  },
  simpleReminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.divider,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  reminderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  reminderLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text,
  },
  reminderSection: {
    marginBottom: theme.spacing.md,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  reminderOptions: {
    marginTop: theme.spacing.sm,
  },
  reminderOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.divider,
    marginBottom: theme.spacing.xs,
  },
  reminderOptionActive: {
    backgroundColor: theme.colors.primary + '20',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  reminderOptionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text,
  },
  reminderOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  modalActions: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  fab: {
    position: 'absolute',
    right: theme.spacing.md,
    bottom: theme.spacing.xl + 60, // Above tab bar
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.lg,
    elevation: 8,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    flex: 1,
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    marginLeft: theme.spacing.xs,
  },
  photosGallerySection: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  photosGalleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  photosGalleryTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
  },
  photosGalleryScroll: {
    marginHorizontal: -theme.spacing.md,
  },
  photosGalleryContent: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  photoGalleryItem: {
    width: 120,
    height: 120,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.divider,
    ...theme.shadows.sm,
  },
  photoGalleryImage: {
    width: '100%',
    height: '100%',
  },
  photoGalleryVideoContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.primary + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBadge: {
    marginTop: theme.spacing.xs / 2,
    fontSize: theme.typography.fontSize.xs,
    color: '#fff',
    fontWeight: theme.typography.fontWeight.medium,
  },
  imageErrorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.divider,
  },
  imageErrorText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs / 2,
  },
  reviewsSection: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  reviewsTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  reviewCard: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  reviewUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  reviewUserName: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
  },
  reviewEmoji: {
    fontSize: theme.typography.fontSize.base,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewMessage: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    lineHeight: 20,
  },
  reviewMediaContainer: {
    marginTop: theme.spacing.sm,
  },
  reviewMedia: {
    marginTop: theme.spacing.xs,
  },
  reviewMediaContent: {
    paddingRight: theme.spacing.sm,
  },
  reviewMediaItemWrapper: {
    marginRight: theme.spacing.sm,
  },
  reviewMediaItem: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.divider,
    overflow: 'hidden',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '20',
  },
  videoLabel: {
    marginTop: theme.spacing.xs / 2,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.medium,
  },

  // ═══════════════════════════════════════════
  // SCRAPBOOK STYLES - Past Dates Memory View
  // ═══════════════════════════════════════════
  scrapbookGradient: {
    flex: 1,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing['2xl'],
    minHeight: 500,
  },
  scrapbookEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing['3xl'],
  },
  scrapbookEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B4F5A',
    marginTop: theme.spacing.md,
  },
  scrapbookEmptySubtext: {
    fontSize: 14,
    color: '#8B6B75',
    marginTop: theme.spacing.sm,
  },
  scrapbookHeader: {
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  scrapbookTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3D2530',
    marginBottom: theme.spacing.xs,
  },
  scrapbookLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrapbookSubtitle: {
    fontSize: 14,
    color: '#C25068',
    marginLeft: 4,
    fontWeight: '500',
  },
  scrapbookFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    gap: 8,
  },
  scrapbookFooterText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#6B4F5A',
  },
});
