import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import {
  ManifestationService,
  Manifestation,
} from '../../src/services/manifestation.service';
import { SimpleTabs } from '../../src/components/SimpleTabs';
import ManifestationModal from '../../src/components/ManifestationModal';
import { AnimatedStars } from '../../src/components/AnimatedStars';
import { CelebrationAnimation } from '../../src/components/CelebrationAnimation';
import { theme } from '../../src/config/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Timestamp } from 'firebase/firestore';

const categoryConfig = {
  travel: { icon: 'airplane', emoji: '✈️', color: '#4A90E2', gradient: ['#4A90E2', '#357ABD'] },
  relationship: { icon: 'heart', emoji: '💕', color: '#FF6B9D', gradient: ['#FF6B9D', '#E85A8A'] },
  personal: { icon: 'star', emoji: '⭐', color: '#FFD700', gradient: ['#FFD700', '#FFC700'] },
  financial: { icon: 'cash', emoji: '💰', color: '#4CAF50', gradient: ['#4CAF50', '#45A049'] },
  home: { icon: 'home', emoji: '🏠', color: '#FF9800', gradient: ['#FF9800', '#F57C00'] },
  career: { icon: 'briefcase', emoji: '💼', color: '#9C27B0', gradient: ['#9C27B0', '#7B1FA2'] },
  health: { icon: 'fitness', emoji: '💪', color: '#F44336', gradient: ['#F44336', '#D32F2F'] },
  other: { icon: 'ellipse', emoji: '✨', color: theme.colors.primary, gradient: [theme.colors.primary, theme.colors.primaryDark] },
};

type FilterType = 'all' | 'shared' | 'individual';

function formatDate(date: any): string {
  if (!date) return '';
  const dateObj = date.toDate ? date.toDate() : new Date(date);
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isPastDate(date: any): boolean {
  if (!date) return false;
  const dateObj = date.toDate ? date.toDate() : new Date(date);
  return dateObj < new Date();
}

export default function ManifestationsScreen() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [partnerData, setPartnerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [manifestations, setManifestations] = useState<Manifestation[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingManifestation, setEditingManifestation] = useState<Manifestation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState<string | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const cardAnimations = useRef<{ [key: string]: Animated.Value }>({});

  // Helper function to create consistent pairId
  const getPairId = useCallback((uid1: string, uid2: string, storedPairId?: string): string => {
    if (storedPairId) return storedPairId;
    const [id1, id2] = [uid1, uid2].sort();
    return `${id1}_${id2}`;
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

  // Set up real-time listeners for manifestations
  useEffect(() => {
    if (!user || !userData?.partnerId) return;

    const pairId = getPairId(user.uid, userData.partnerId, userData.pairId);
    if (!pairId) return;

    // Real-time listener for manifestations
    let manifestationsQuery;
    try {
      manifestationsQuery = query(
        collection(db, 'manifestations'),
        where('pairId', '==', pairId),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
    } catch (error) {
      // If orderBy fails (missing index), try without orderBy
      console.warn('Manifestations query with orderBy failed, trying without:', error);
      manifestationsQuery = query(
        collection(db, 'manifestations'),
        where('pairId', '==', pairId),
        limit(100)
      );
    }

    const unsubscribe = onSnapshot(
      manifestationsQuery,
      (snapshot) => {
        const manifests = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Manifestation[];

        // Sort manually if orderBy didn't work
        manifests.sort((a, b) => {
          const aTime = a.createdAt?.toMillis
            ? a.createdAt.toMillis()
            : a.createdAt?.seconds * 1000 || 0;
          const bTime = b.createdAt?.toMillis
            ? b.createdAt.toMillis()
            : b.createdAt?.seconds * 1000 || 0;
          return bTime - aTime;
        });

        setManifestations(manifests);
      },
      (error: any) => {
        console.error('Error loading manifestations:', error);
        // Try fallback query without orderBy
        if (error.code === 'failed-precondition' || error.code === 9) {
          const fallbackQuery = query(
            collection(db, 'manifestations'),
            where('pairId', '==', pairId),
            limit(100)
          );
          onSnapshot(
            fallbackQuery,
            (snapshot) => {
              const manifests = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as Manifestation[];

              manifests.sort((a, b) => {
                const aTime = a.createdAt?.toMillis
                  ? a.createdAt.toMillis()
                  : a.createdAt?.seconds * 1000 || 0;
                const bTime = b.createdAt?.toMillis
                  ? b.createdAt.toMillis()
                  : b.createdAt?.seconds * 1000 || 0;
                return bTime - aTime;
              });

              setManifestations(manifests);
            },
            (fallbackError) => {
              console.error('Fallback manifestations query also failed:', fallbackError);
            }
          );
        }
      }
    );

    return unsubscribe;
  }, [user, userData?.pairId, userData?.partnerId, getPairId]);

  // Filter manifestations by type
  const filteredManifestations = useMemo(() => {
    if (filterType === 'all') return manifestations;
    return manifestations.filter((m) => m.type === filterType);
  }, [manifestations, filterType]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Real-time listeners will automatically update
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const openCreateModal = () => {
    setEditingManifestation(null);
    setShowModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openEditModal = (manifestation: Manifestation) => {
    setEditingManifestation(manifestation);
    setShowModal(true);
    setActionMenuVisible(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async (data: {
    title: string;
    description?: string;
    type: 'shared' | 'individual';
    category?: 'travel' | 'relationship' | 'personal' | 'financial' | 'home' | 'career' | 'health' | 'other';
    targetDate?: Date;
    milestones?: string[];
    reminderEnabled: boolean;
    reminderTime?: string;
  }) => {
    if (!user || !userData?.partnerId) return;

    setSubmitting(true);
    try {
      const pairId = getPairId(user.uid, userData.partnerId, userData.pairId);
      if (!pairId) return;

      if (editingManifestation) {
        // Update existing manifestation
        await ManifestationService.updateManifestation(editingManifestation.id!, {
          title: data.title,
          description: data.description,
          type: data.type,
          category: data.category || 'other',
          targetDate: data.targetDate ? Timestamp.fromDate(data.targetDate) : null,
          milestones: data.milestones,
          reminderEnabled: data.reminderEnabled,
          reminderTime: data.reminderTime,
        });
      } else {
        // Create new manifestation
        await ManifestationService.createManifestation(pairId, user.uid, {
          title: data.title,
          description: data.description,
          type: data.type,
          category: data.category || 'other',
          targetDate: data.targetDate ? Timestamp.fromDate(data.targetDate) : null,
          milestones: data.milestones,
          reminderEnabled: data.reminderEnabled,
          reminderTime: data.reminderTime,
        });
        
        // Show celebration for new manifestation
        setCelebrationVisible(true);
        setTimeout(() => setCelebrationVisible(false), 3000);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowModal(false);
    } catch (error: any) {
      console.error('Error saving manifestation:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to save manifestation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (manifestation: Manifestation) => {
    Alert.alert(
      'Delete Manifestation',
      `Are you sure you want to delete "${manifestation.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ManifestationService.deleteManifestation(manifestation.id!);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error: any) {
              console.error('Error deleting manifestation:', error);
              Alert.alert('Error', error.message || 'Failed to delete manifestation');
            }
          },
        },
      ]
    );
    setActionMenuVisible(null);
  };

  const handleToggleMilestone = async (
    manifestation: Manifestation,
    milestone: string
  ) => {
    try {
      const completed = manifestation.completedMilestones || [];
      const isCompleted = completed.includes(milestone);

      if (isCompleted) {
        // Remove milestone
        const updatedCompleted = completed.filter((m) => m !== milestone);
        await ManifestationService.updateManifestation(manifestation.id!, {
          completedMilestones: updatedCompleted,
        });
      } else {
        // Add milestone
        await ManifestationService.updateProgress(manifestation.id!, manifestation.progress, milestone);
        
        // Show celebration if this is a new completion
        if (!isCompleted) {
          setCelebrationVisible(true);
          setTimeout(() => setCelebrationVisible(false), 3000);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error: any) {
      console.error('Error toggling milestone:', error);
      Alert.alert('Error', error.message || 'Failed to update milestone');
    }
  };

  const handleProgressChange = async (manifestation: Manifestation, progress: number) => {
    try {
      await ManifestationService.updateProgress(manifestation.id!, progress);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error: any) {
      console.error('Error updating progress:', error);
      Alert.alert('Error', error.message || 'Failed to update progress');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Show content if partnerId exists
  if (!userData?.partnerId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="star-outline" size={64} color={theme.colors.textLight} />
          <Text style={styles.emptyText}>No partner connected</Text>
          <Text style={styles.emptySubtext}>
            Connect with your partner to set shared goals
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const sharedCount = manifestations.filter((m) => m.type === 'shared').length;
  const individualCount = manifestations.filter((m) => m.type === 'individual').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
        {/* Animated Star Background */}
        <AnimatedStars count={25} />
        
        {/* Gradient Overlay */}
        <View style={styles.gradientOverlay} />
        
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Manifestations</Text>
            <Text style={styles.subtitle}>Your shared goals and dreams</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabsContainer}>
          <SimpleTabs
            tabs={[
              { id: 'all', label: `All (${manifestations.length})` },
              { id: 'shared', label: `Shared (${sharedCount})` },
              { id: 'individual', label: `Individual (${individualCount})` },
            ]}
            activeTab={filterType}
            onTabChange={(tabId) => {
              setFilterType(tabId as FilterType);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
        >
          {filteredManifestations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="star-outline" size={64} color={theme.colors.textLight} />
              <Text style={styles.emptyText}>
                {filterType === 'all' ? 'No manifestations yet' : `No ${filterType} manifestations`}
              </Text>
              <Text style={styles.emptySubtext}>
                {filterType === 'all'
                  ? 'Set your first shared goal together'
                  : `Create your first ${filterType} manifestation`}
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={openCreateModal}
              >
                <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
                <Text style={styles.createButtonText}>Create Manifestation</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredManifestations.map((manifestation, index) => {
              // Initialize card animation if not exists
              if (!cardAnimations.current[manifestation.id!]) {
                cardAnimations.current[manifestation.id!] = new Animated.Value(0);
                Animated.timing(cardAnimations.current[manifestation.id!], {
                  toValue: 1,
                  duration: 500 + index * 100,
                  useNativeDriver: true,
                }).start();
              }
              
              const cardAnim = cardAnimations.current[manifestation.id!];
              const categoryInfo = categoryConfig[manifestation.category || 'other'];
              const translateY = cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              });
              const opacity = cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              });
              const scale = cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1],
              });
              
              return (
              <Animated.View
                key={manifestation.id}
                style={[
                  styles.manifestCard,
                  {
                    transform: [{ translateY }, { scale }],
                    opacity,
                  },
                ]}
              >
                {/* Category Badge with Gradient */}
                {manifestation.category && (
                  <View style={[styles.categoryBadgeContainer, { backgroundColor: categoryInfo.color + '20' }]}>
                    <Text style={styles.categoryEmoji}>{categoryInfo.emoji}</Text>
                    <Text style={[styles.categoryBadgeText, { color: categoryInfo.color }]}>
                      {manifestation.category.charAt(0).toUpperCase() + manifestation.category.slice(1)}
                    </Text>
                  </View>
                )}
                
                {/* Header with Actions */}
                <View style={styles.manifestHeader}>
                  <View style={styles.manifestHeaderLeft}>
                    <Text style={styles.manifestTitle}>{manifestation.title}</Text>
                    <View style={styles.manifestMeta}>
                      <View
                        style={[
                          styles.manifestTypeBadge,
                          manifestation.type === 'shared' && styles.manifestTypeBadgeShared,
                        ]}
                      >
                        <Ionicons
                          name={manifestation.type === 'shared' ? 'people' : 'person'}
                          size={12}
                          color={
                            manifestation.type === 'shared' ? theme.colors.primary : theme.colors.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.manifestTypeText,
                            manifestation.type === 'shared' && styles.manifestTypeTextShared,
                          ]}
                        >
                          {manifestation.type === 'shared' ? 'Shared' : 'Individual'}
                        </Text>
                      </View>
                      {manifestation.targetDate && (
                        <View style={styles.targetDateBadge}>
                          <Ionicons
                            name={isPastDate(manifestation.targetDate) ? 'time-outline' : 'calendar-outline'}
                            size={12}
                            color={isPastDate(manifestation.targetDate) ? theme.colors.error : theme.colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.targetDateText,
                              isPastDate(manifestation.targetDate) && styles.targetDateTextPast,
                            ]}
                          >
                            {formatDate(manifestation.targetDate)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        setActionMenuVisible(
                          actionMenuVisible === manifestation.id ? null : manifestation.id || null
                        );
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    {actionMenuVisible === manifestation.id && (
                      <View style={styles.actionMenu}>
                        <TouchableOpacity
                          style={styles.actionMenuItem}
                          onPress={() => openEditModal(manifestation)}
                        >
                          <Ionicons name="create-outline" size={18} color={theme.colors.text} />
                          <Text style={styles.actionMenuText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionMenuItem, styles.actionMenuItemDanger]}
                          onPress={() => handleDelete(manifestation)}
                        >
                          <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                          <Text style={[styles.actionMenuText, styles.actionMenuTextDanger]}>
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>

                {manifestation.description && (
                  <Text style={styles.manifestDescription}>{manifestation.description}</Text>
                )}

                {/* Progress Bar with Animation */}
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <Text style={styles.progressText}>{manifestation.progress}%</Text>
                    {manifestation.progress === 100 && (
                      <View style={styles.completeBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                        <Text style={styles.completeText}>Complete!</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBar}>
                      <Animated.View
                        style={[
                          styles.progressFill,
                          { 
                            width: `${manifestation.progress}%`,
                            backgroundColor: categoryInfo.color,
                          },
                          manifestation.progress === 100 && styles.progressFillComplete,
                        ]}
                      />
                    </View>
                    <View style={styles.progressButtons}>
                      {[0, 25, 50, 75, 100].map((value) => (
                        <TouchableOpacity
                          key={value}
                          style={[
                            styles.progressButton,
                            manifestation.progress === value && styles.progressButtonActive,
                          ]}
                          onPress={() => handleProgressChange(manifestation, value)}
                        >
                          <Text
                            style={[
                              styles.progressButtonText,
                              manifestation.progress === value && styles.progressButtonTextActive,
                            ]}
                          >
                            {value}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Milestones */}
                {manifestation.milestones && manifestation.milestones.length > 0 && (
                  <View style={styles.milestonesContainer}>
                    <Text style={styles.milestonesTitle}>Milestones</Text>
                    {manifestation.milestones.map((milestone, index) => {
                      const isCompleted =
                        manifestation.completedMilestones?.includes(milestone) || false;
                      return (
                        <TouchableOpacity
                          key={index}
                          style={styles.milestone}
                          onPress={() => handleToggleMilestone(manifestation, milestone)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                            size={20}
                            color={isCompleted ? theme.colors.success : theme.colors.textLight}
                          />
                          <Text
                            style={[
                              styles.milestoneText,
                              isCompleted && styles.milestoneCompleted,
                            ]}
                          >
                            {milestone}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </Animated.View>
            );
            })
          )}
        </ScrollView>

        <ManifestationModal
          visible={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingManifestation(null);
          }}
          onSubmit={handleSubmit}
          editingManifestation={editingManifestation}
          loading={submitting}
        />

        {/* Overlay to close action menu */}
        {actionMenuVisible && (
          <Pressable
            style={styles.overlay}
            onPress={() => setActionMenuVisible(null)}
          />
        )}

        {/* Celebration Animation */}
        <CelebrationAnimation
          visible={celebrationVisible}
          onComplete={() => setCelebrationVisible(false)}
        />
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 0,
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 1,
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
  addButton: {
    padding: theme.spacing.xs,
  },
  tabsContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing['2xl'],
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.primary + '15',
    borderRadius: theme.borderRadius.md,
  },
  createButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary,
  },
  manifestCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 157, 0.1)',
    overflow: 'hidden',
    position: 'relative',
  },
  categoryBadgeContainer: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    zIndex: 10,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
  },
  manifestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  manifestHeaderLeft: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  manifestTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  manifestMeta: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  manifestTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.divider,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  manifestTypeBadgeShared: {
    backgroundColor: theme.colors.primary + '20',
  },
  manifestTypeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textSecondary,
  },
  manifestTypeTextShared: {
    color: theme.colors.primary,
  },
  targetDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.divider,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  targetDateText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textSecondary,
  },
  targetDateTextPast: {
    color: theme.colors.error,
  },
  actionsContainer: {
    position: 'relative',
  },
  actionButton: {
    padding: theme.spacing.xs,
  },
  actionMenu: {
    position: 'absolute',
    top: 32,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.xs,
    minWidth: 120,
    ...theme.shadows.lg,
    zIndex: 1000,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  actionMenuItemDanger: {},
  actionMenuText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text,
  },
  actionMenuTextDanger: {
    color: theme.colors.error,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  manifestDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  progressSection: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.success + '20',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  completeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.success,
  },
  progressLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
  },
  progressText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary,
  },
  progressBarContainer: {
    marginTop: theme.spacing.xs,
  },
  progressBar: {
    height: 10,
    backgroundColor: theme.colors.divider,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.sm,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  progressFillComplete: {
    backgroundColor: theme.colors.success,
  },
  progressButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  progressButton: {
    flex: 1,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.divider,
    alignItems: 'center',
  },
  progressButtonActive: {
    backgroundColor: theme.colors.primary + '20',
  },
  progressButtonText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textSecondary,
  },
  progressButtonTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.bold,
  },
  milestonesContainer: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  milestonesTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  milestoneText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  milestoneCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
});
