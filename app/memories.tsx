import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/config/theme';
import { useAuth } from '../src/contexts/AuthContext';
import { API_ENDPOINTS, apiRequest } from '../src/config/mongodb';
import { MomentService } from '../src/services/moment.service';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../src/config/firebase';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 48) / 2; // 2 columns with padding

interface MemoryItem {
    id: string;
    date: string;
    userId: string;
    url: string;
    caption?: string;
    uploadedAt: string;
}

interface GroupedMemory {
    date: string;
    memories: MemoryItem[];
}

export default function MemoriesScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [memories, setMemories] = useState<GroupedMemory[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userData, setUserData] = useState<any>(null);
    const [partnerData, setPartnerData] = useState<any>(null);

    const fetchUserData = useCallback(async () => {
        if (!user?.uid) return;

        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserData(data);

                if (data.partnerId) {
                    const partnerDoc = await getDoc(doc(db, 'users', data.partnerId));
                    if (partnerDoc.exists()) {
                        setPartnerData(partnerDoc.data());
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }, [user?.uid]);

    const fetchMemories = useCallback(async () => {
        if (!user?.uid || !userData?.partnerId) return;

        try {
            const pairId = MomentService.getMomentPairId(user.uid, userData.partnerId);
            const data = await apiRequest<any>(
                API_ENDPOINTS.MOMENTS.GET_HISTORY(pairId) + '?limit=90'
            );

            if (data.success && data.moments) {
                // Group memories by date
                const grouped: { [key: string]: MemoryItem[] } = {};
                data.moments.forEach((memory: MemoryItem) => {
                    const date = memory.date;
                    if (!grouped[date]) {
                        grouped[date] = [];
                    }
                    grouped[date].push(memory);
                });

                // Convert to array and sort by date descending
                const groupedArray: GroupedMemory[] = Object.entries(grouped)
                    .map(([date, memories]) => ({ date, memories }))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                setMemories(groupedArray);
            }
        } catch (error) {
            console.error('Error fetching memories:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.uid, userData?.partnerId]);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    useEffect(() => {
        if (userData?.partnerId) {
            fetchMemories();
        }
    }, [userData?.partnerId, fetchMemories]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchMemories();
    }, [fetchMemories]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (dateString === today.toISOString().split('T')[0]) {
            return 'Today';
        } else if (dateString === yesterday.toISOString().split('T')[0]) {
            return 'Yesterday';
        }

        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
        });
    };

    const getUserName = (userId: string) => {
        if (userId === user?.uid) {
            return userData?.displayName || userData?.name || 'You';
        }
        return partnerData?.displayName || partnerData?.name || 'Partner';
    };

    const renderMemoryItem = ({ item }: { item: MemoryItem }) => (
        <TouchableOpacity style={styles.memoryItem} activeOpacity={0.8}>
            <Image source={{ uri: item.url }} style={styles.memoryImage} />
            <View style={styles.memoryOverlay}>
                <Text style={styles.memoryOwner}>{getUserName(item.userId)}</Text>
                {item.caption && (
                    <Text style={styles.memoryCaption} numberOfLines={2}>
                        {item.caption}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );

    const renderDateSection = ({ item }: { item: GroupedMemory }) => (
        <View style={styles.dateSection}>
            <Text style={styles.dateHeader}>{formatDate(item.date)}</Text>
            <View style={styles.memoriesGrid}>
                {item.memories.map((memory) => (
                    <View key={memory.id} style={styles.gridItem}>
                        {renderMemoryItem({ item: memory })}
                    </View>
                ))}
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading memories...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Our Memories</Text>
                <View style={styles.headerRight} />
            </View>

            {memories.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="images-outline" size={64} color={theme.colors.textMuted} />
                    <Text style={styles.emptyTitle}>No memories yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Start capturing moments together to build your memory collection
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={memories}
                    renderItem={renderDateSection}
                    keyExtractor={(item) => item.date}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={theme.colors.primary}
                        />
                    }
                />
            )}
        </SafeAreaView>
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
        backgroundColor: theme.colors.background,
    },
    loadingText: {
        marginTop: theme.spacing.md,
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.textMuted,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: 2,
        borderBottomColor: '#000',
        backgroundColor: '#fff',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.background,
        borderWidth: 2,
        borderColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: theme.typography.fontSize.xl,
        fontWeight: 'bold',
        color: '#000',
    },
    headerRight: {
        width: 40,
    },
    listContent: {
        padding: theme.spacing.md,
    },
    dateSection: {
        marginBottom: theme.spacing.xl,
    },
    dateHeader: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: '600',
        color: '#000',
        marginBottom: theme.spacing.sm,
        paddingBottom: theme.spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    memoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
    },
    gridItem: {
        width: ITEM_SIZE,
    },
    memoryItem: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#000',
    },
    memoryImage: {
        width: '100%',
        height: '100%',
    },
    memoryOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: theme.spacing.xs,
    },
    memoryOwner: {
        color: '#fff',
        fontSize: theme.typography.fontSize.xs,
        fontWeight: '600',
    },
    memoryCaption: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: theme.typography.fontSize.xs,
        marginTop: 2,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
    },
    emptyTitle: {
        fontSize: theme.typography.fontSize.xl,
        fontWeight: 'bold',
        color: '#000',
        marginTop: theme.spacing.md,
    },
    emptySubtitle: {
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.textMuted,
        textAlign: 'center',
        marginTop: theme.spacing.sm,
    },
});
