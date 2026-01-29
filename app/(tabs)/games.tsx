import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NoPartnerState } from '../../src/components/doodle';
import { useAuth } from '../../src/contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, collection, query, where, onSnapshot as onSnapshotQuery, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { GameService, GameSession } from '../../src/services/game.service';
import QuestionGame from '../../src/components/QuestionGame';
import TriviaGame from '../../src/components/TriviaGame';
import ChoiceGame from '../../src/components/ChoiceGame';
import { theme } from '../../src/config/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const GAME_TYPES = [
  { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', icon: 'grid', color: '#00D4FF' },
  { id: 'question', name: 'Question Game', icon: 'chatbubbles', color: theme.colors.primary },
  { id: 'trivia', name: 'Trivia', icon: 'trophy', color: theme.colors.accent },
  { id: 'would-you-rather', name: 'Would You Rather', icon: 'swap-horizontal', color: theme.colors.secondary },
  { id: 'this-or-that', name: 'This or That', icon: 'shuffle', color: theme.colors.primary },
];

export default function GamesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [partnerData, setPartnerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeGames, setActiveGames] = useState<GameSession[]>([]);
  const [completedGames, setCompletedGames] = useState<GameSession[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameSession | null>(null);
  const [showQuestionGame, setShowQuestionGame] = useState(false);
  const [showTriviaGame, setShowTriviaGame] = useState(false);
  const [showWouldYouRatherGame, setShowWouldYouRatherGame] = useState(false);
  const [showThisOrThatGame, setShowThisOrThatGame] = useState(false);
  const [creatingGame, setCreatingGame] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gameStats, setGameStats] = useState({ totalPlayed: 0, totalQuestions: 0 });

  // Load user data and pair info
  useEffect(() => {
    if (!user) return;

    let partnerUnsubscribe: (() => void) | null = null;
    let activeGamesUnsubscribe: (() => void) | null = null;
    let completedGamesUnsubscribe: (() => void) | null = null;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserData(data);

        // Load partner data
        if (data.partnerId) {
          partnerUnsubscribe = onSnapshot(doc(db, 'users', data.partnerId), (partnerSnap) => {
            if (partnerSnap.exists()) {
              setPartnerData(partnerSnap.data());
            }
          });
        }

        // Load active games with real-time listener
        const pairId = data.pairId;
        if (pairId) {
          // Active games query
          const activeGamesQuery = query(
            collection(db, 'games'),
            where('pairId', '==', pairId),
            where('status', 'in', ['active', 'pending'])
          );

          activeGamesUnsubscribe = onSnapshotQuery(
            activeGamesQuery,
            (snapshot) => {
              const games = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
              })) as GameSession[];

              // Filter to show only unique games (deduplicate by gameType)
              // Keep the most recently created game for each gameType
              const uniqueGames = games.reduce((acc, game) => {
                const existing = acc.find(g => g.gameType === game.gameType);
                if (!existing) {
                  acc.push(game);
                } else {
                  // Keep the one with the most recent timestamp
                  const existingTime = existing.createdAt?.toMillis ? existing.createdAt.toMillis() : (existing.createdAt?.seconds * 1000 || 0);
                  const gameTime = game.createdAt?.toMillis ? game.createdAt.toMillis() : (game.createdAt?.seconds * 1000 || 0);
                  if (gameTime > existingTime) {
                    // Replace with newer game
                    const index = acc.indexOf(existing);
                    acc[index] = game;
                  }
                }
                return acc;
              }, [] as GameSession[]);

              // Additional filter: explicitly exclude completed games (double-check)
              const filteredGames = uniqueGames.filter(g => g.status !== 'completed');

              console.log('🎮 Active games:', {
                total: games.length,
                unique: uniqueGames.length,
                filtered: filteredGames.length,
                games: filteredGames.map(g => ({ id: g.id, type: g.gameType, status: g.status }))
              });

              setActiveGames(filteredGames);
            },
            (error) => {
              console.error('Error listening to active games:', error);
            }
          );

          // Completed games query (last 10) - try with orderBy first, fallback without if index missing
          let completedGamesQuery;
          try {
            completedGamesQuery = query(
              collection(db, 'games'),
              where('pairId', '==', pairId),
              where('status', '==', 'completed'),
              orderBy('updatedAt', 'desc'),
              limit(10)
            );
          } catch (error) {
            // Fallback without orderBy if index missing
            console.warn('Completed games query with orderBy failed, using fallback:', error);
            completedGamesQuery = query(
              collection(db, 'games'),
              where('pairId', '==', pairId),
              where('status', '==', 'completed'),
              limit(10)
            );
          }

          completedGamesUnsubscribe = onSnapshotQuery(
            completedGamesQuery,
            (snapshot) => {
              let games = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
              })) as GameSession[];

              // Sort manually if orderBy didn't work
              games.sort((a, b) => {
                const aTime = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt?.seconds * 1000 || 0);
                const bTime = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt?.seconds * 1000 || 0);
                return bTime - aTime;
              });

              setCompletedGames(games.slice(0, 10));

              // Calculate stats
              const totalPlayed = games.length;
              const totalQuestions = games.reduce((sum, game) => {
                return sum + (game.questions?.length || 0);
              }, 0);
              setGameStats({ totalPlayed, totalQuestions });
            },
            (error: any) => {
              // If query fails due to missing index, use fallback without orderBy
              if (error.code === 'failed-precondition' || error.message?.includes('index')) {
                console.warn('Completed games query requires index. Using fallback query without orderBy.');
                const fallbackQuery = query(
                  collection(db, 'games'),
                  where('pairId', '==', pairId),
                  where('status', '==', 'completed'),
                  limit(10)
                );

                const fallbackUnsubscribe = onSnapshotQuery(
                  fallbackQuery,
                  (snapshot) => {
                    let games = snapshot.docs.map(doc => ({
                      id: doc.id,
                      ...doc.data(),
                    })) as GameSession[];

                    // Sort manually by updatedAt
                    games.sort((a, b) => {
                      const aTime = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt?.seconds * 1000 || 0);
                      const bTime = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt?.seconds * 1000 || 0);
                      return bTime - aTime;
                    });

                    setCompletedGames(games.slice(0, 10));
                    const totalPlayed = games.length;
                    const totalQuestions = games.reduce((sum, game) => {
                      return sum + (game.questions?.length || 0);
                    }, 0);
                    setGameStats({ totalPlayed, totalQuestions });
                  },
                  (fallbackError) => {
                    console.error('Fallback completed games query also failed:', fallbackError);
                  }
                );

                // Replace unsubscribe with fallback unsubscribe
                completedGamesUnsubscribe = fallbackUnsubscribe;
              } else {
                console.error('Error listening to completed games:', error);
              }
            }
          );
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (partnerUnsubscribe) partnerUnsubscribe();
      if (activeGamesUnsubscribe) activeGamesUnsubscribe();
      if (completedGamesUnsubscribe) completedGamesUnsubscribe();
    };
  }, [user]);

  const onRefresh = useCallback(async () => {
    if (!user || !userData?.pairId) {
      setRefreshing(false);
      return;
    }

    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Force refresh by manually fetching latest data
      // The real-time listeners will continue to work, but this ensures
      // we get the latest state immediately on refresh

      // Fetch active games directly to ensure we have latest data
      const activeGamesData = await GameService.getActiveGames(userData.pairId);

      // Deduplicate and filter active games
      const uniqueGames = activeGamesData.reduce((acc, game) => {
        const existing = acc.find(g => g.gameType === game.gameType);
        if (!existing) {
          acc.push(game);
        } else {
          const existingTime = existing.createdAt?.toMillis ? existing.createdAt.toMillis() : (existing.createdAt?.seconds * 1000 || 0);
          const gameTime = game.createdAt?.toMillis ? game.createdAt.toMillis() : (game.createdAt?.seconds * 1000 || 0);
          if (gameTime > existingTime) {
            const index = acc.indexOf(existing);
            acc[index] = game;
          }
        }
        return acc;
      }, [] as GameSession[]);

      const filteredActiveGames = uniqueGames.filter(game => game.status !== 'completed');
      setActiveGames(filteredActiveGames);

      // Fetch completed games manually (using same logic as listener)
      let completedGamesQuery;
      try {
        completedGamesQuery = query(
          collection(db, 'games'),
          where('pairId', '==', userData.pairId),
          where('status', '==', 'completed'),
          orderBy('updatedAt', 'desc'),
          limit(10)
        );
      } catch (error) {
        // Fallback without orderBy
        completedGamesQuery = query(
          collection(db, 'games'),
          where('pairId', '==', userData.pairId),
          where('status', '==', 'completed'),
          limit(10)
        );
      }

      const completedSnapshot = await getDocs(completedGamesQuery);
      let completedGamesData = completedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as GameSession[];

      // Sort manually if orderBy didn't work
      completedGamesData.sort((a, b) => {
        const aTime = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt?.seconds * 1000 || 0);
        const bTime = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt?.seconds * 1000 || 0);
        return bTime - aTime;
      });

      setCompletedGames(completedGamesData.slice(0, 10));

      // Update stats
      const totalPlayed = completedGamesData.length;
      const totalQuestions = completedGamesData.reduce((sum, game) => {
        return sum + (game.questions?.length || 0);
      }, 0);
      setGameStats({ totalPlayed, totalQuestions });

      console.log('🔄 Games refreshed:', {
        active: filteredActiveGames.length,
        completed: completedGamesData.length,
      });
    } catch (error: any) {
      console.error('❌ Error refreshing games:', error);
      // Don't show error to user - real-time listeners will handle updates
    } finally {
      // Real-time listeners are still active and will continue updating
      await new Promise(resolve => setTimeout(resolve, 300));
      setRefreshing(false);
    }
  }, [user, userData?.pairId]);

  const handleStartGame = async (gameType: string) => {
    if (!user || !userData?.pairId || !userData?.partnerId) {
      Alert.alert('Error', 'Please ensure you are connected with your partner');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Prevent multiple simultaneous game creations
    if (creatingGame) {
      console.log('⏳ Game creation already in progress, please wait...');
      return;
    }

    if (gameType === 'tic-tac-toe') {
      // Navigate to Tic-Tac-Toe screen
      router.push('/games/tic-tac-toe');
    } else if (gameType === 'question') {
      await startQuestionGame();
    } else if (gameType === 'trivia') {
      await startTriviaGame();
    } else if (gameType === 'would-you-rather') {
      await startWouldYouRatherGame();
    } else if (gameType === 'this-or-that') {
      await startThisOrThatGame();
    } else {
      Alert.alert('Coming Soon', `${GAME_TYPES.find(g => g.id === gameType)?.name || gameType} game will be available soon!`);
    }
  };

  const formatTimeAgo = (timestamp: any): string => {
    if (!timestamp) return 'just now';

    let timestampMs: number;
    if (timestamp.toMillis) {
      timestampMs = timestamp.toMillis();
    } else if (timestamp.seconds) {
      timestampMs = timestamp.seconds * 1000;
    } else if (typeof timestamp === 'number') {
      timestampMs = timestamp;
    } else {
      return 'just now';
    }

    const now = Date.now();
    const diffMs = now - timestampMs;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;

    const date = new Date(timestampMs);
    return date.toLocaleDateString();
  };

  const startQuestionGame = async () => {
    if (!user || !userData?.pairId || !userData?.partnerId) return;

    // Check if there's already an active game of this type
    const existingActiveGame = activeGames.find(
      g => g.gameType === 'question' && (g.status === 'active' || g.status === 'pending')
    );

    if (existingActiveGame) {
      // If there's an active game, just open it
      console.log('📂 Found existing active game, opening it:', existingActiveGame.id);
      setSelectedGame(existingActiveGame);
      setShowQuestionGame(true);
      return;
    }

    setCreatingGame(true);
    try {
      // Double-check for active games before creating (race condition prevention)
      const activeGamesCheck = await GameService.getActiveGames(userData.pairId);
      const existingGame = activeGamesCheck.find(
        g => g.gameType === 'question' && (g.status === 'active' || g.status === 'pending')
      );

      if (existingGame) {
        console.log('📂 Found existing active game in database, opening it:', existingGame.id);
        setSelectedGame(existingGame);
        setShowQuestionGame(true);
        setCreatingGame(false);
        return;
      }

      console.log('🎮 Creating new question game...');

      // Generate questions (will use AI or fallback)
      const questions = await GameService.generateQuestions(
        userData.pairId,
        'question',
        5 // 5 questions
      );

      if (!questions || questions.length === 0) {
        throw new Error('Failed to generate questions. Please try again.');
      }

      console.log('✅ Generated', questions.length, 'questions');

      // Create game session
      const gameId = await GameService.createGameSession(
        userData.pairId,
        'question',
        questions,
        user.uid,
        userData.partnerId
      );

      console.log('✅ Created game session:', gameId);

      // Get the created game
      const game = await GameService.getGameSession(gameId);
      if (game) {
        console.log('✅ Game loaded successfully:', {
          id: game.id,
          questionsCount: game.questions?.length,
          status: game.status,
        });

        // Validate game has questions
        if (!game.questions || game.questions.length === 0) {
          throw new Error('Game was created but has no questions. Please try again.');
        }

        setSelectedGame(game);
        setShowQuestionGame(true);
      } else {
        throw new Error('Failed to load the created game. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Error starting game:', error);
      Alert.alert('Error', error.message || 'Failed to start game. Please try again.');
    } finally {
      setCreatingGame(false);
    }
  };

  const startTriviaGame = async () => {
    if (!user || !userData?.pairId || !userData?.partnerId) return;

    // Check if there's already an active game of this type
    const existingActiveGame = activeGames.find(
      g => g.gameType === 'trivia' && (g.status === 'active' || g.status === 'pending')
    );

    if (existingActiveGame) {
      // If there's an active game, just open it
      console.log('📂 Found existing active trivia game, opening it:', existingActiveGame.id);
      setSelectedGame(existingActiveGame);
      setShowTriviaGame(true);
      return;
    }

    setCreatingGame(true);
    try {
      // Double-check for active games before creating (race condition prevention)
      const activeGamesCheck = await GameService.getActiveGames(userData.pairId);
      const existingGame = activeGamesCheck.find(
        g => g.gameType === 'trivia' && (g.status === 'active' || g.status === 'pending')
      );

      if (existingGame) {
        console.log('📂 Found existing active trivia game in database, opening it:', existingGame.id);
        setSelectedGame(existingGame);
        setShowTriviaGame(true);
        setCreatingGame(false);
        return;
      }

      console.log('🎮 Creating new trivia game...');

      // Generate trivia questions (will use AI or fallback)
      const questions = await GameService.generateQuestions(
        userData.pairId,
        'trivia',
        10 // 10 trivia questions
      );

      if (!questions || questions.length === 0) {
        throw new Error('Failed to generate questions. Please try again.');
      }

      console.log('✅ Generated', questions.length, 'trivia questions');

      // Create game session
      const gameId = await GameService.createGameSession(
        userData.pairId,
        'trivia',
        questions,
        user.uid,
        userData.partnerId
      );

      console.log('✅ Created trivia game session:', gameId);

      // Get the created game
      const game = await GameService.getGameSession(gameId);
      if (game) {
        console.log('✅ Trivia game loaded successfully:', {
          id: game.id,
          questionsCount: game.questions?.length,
          status: game.status,
        });

        // Validate game has questions
        if (!game.questions || game.questions.length === 0) {
          throw new Error('Game was created but has no questions. Please try again.');
        }

        setSelectedGame(game);
        setShowTriviaGame(true);
      } else {
        throw new Error('Failed to load the created game. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Error starting trivia game:', error);
      Alert.alert('Error', error.message || 'Failed to start game. Please try again.');
    } finally {
      setCreatingGame(false);
    }
  };

  const startWouldYouRatherGame = async () => {
    if (!user || !userData?.pairId || !userData?.partnerId) return;

    // Check if there's already an active game of this type
    const existingActiveGame = activeGames.find(
      g => g.gameType === 'would-you-rather' && (g.status === 'active' || g.status === 'pending')
    );

    if (existingActiveGame) {
      console.log('📂 Found existing active Would You Rather game, opening it:', existingActiveGame.id);
      setSelectedGame(existingActiveGame);
      setShowWouldYouRatherGame(true);
      return;
    }

    setCreatingGame(true);
    try {
      // Double-check for active games before creating
      const activeGamesCheck = await GameService.getActiveGames(userData.pairId);
      const existingGame = activeGamesCheck.find(
        g => g.gameType === 'would-you-rather' && (g.status === 'active' || g.status === 'pending')
      );

      if (existingGame) {
        console.log('📂 Found existing active Would You Rather game in database, opening it:', existingGame.id);
        setSelectedGame(existingGame);
        setShowWouldYouRatherGame(true);
        setCreatingGame(false);
        return;
      }

      console.log('🎮 Creating new Would You Rather game...');

      const questions = await GameService.generateQuestions(
        userData.pairId,
        'would-you-rather',
        10
      );

      if (!questions || questions.length === 0) {
        throw new Error('Failed to generate questions. Please try again.');
      }

      console.log('✅ Generated', questions.length, 'Would You Rather questions');

      const gameId = await GameService.createGameSession(
        userData.pairId,
        'would-you-rather',
        questions,
        user.uid,
        userData.partnerId
      );

      console.log('✅ Created Would You Rather game session:', gameId);

      const game = await GameService.getGameSession(gameId);
      if (game) {
        if (!game.questions || game.questions.length === 0) {
          throw new Error('Game was created but has no questions. Please try again.');
        }

        setSelectedGame(game);
        setShowWouldYouRatherGame(true);
      } else {
        throw new Error('Failed to load the created game. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Error starting Would You Rather game:', error);
      Alert.alert('Error', error.message || 'Failed to start game. Please try again.');
    } finally {
      setCreatingGame(false);
    }
  };

  const startThisOrThatGame = async () => {
    if (!user || !userData?.pairId || !userData?.partnerId) return;

    // Check if there's already an active game of this type
    const existingActiveGame = activeGames.find(
      g => g.gameType === 'this-or-that' && (g.status === 'active' || g.status === 'pending')
    );

    if (existingActiveGame) {
      console.log('📂 Found existing active This or That game, opening it:', existingActiveGame.id);
      setSelectedGame(existingActiveGame);
      setShowThisOrThatGame(true);
      return;
    }

    setCreatingGame(true);
    try {
      // Double-check for active games before creating
      const activeGamesCheck = await GameService.getActiveGames(userData.pairId);
      const existingGame = activeGamesCheck.find(
        g => g.gameType === 'this-or-that' && (g.status === 'active' || g.status === 'pending')
      );

      if (existingGame) {
        console.log('📂 Found existing active This or That game in database, opening it:', existingGame.id);
        setSelectedGame(existingGame);
        setShowThisOrThatGame(true);
        setCreatingGame(false);
        return;
      }

      console.log('🎮 Creating new This or That game...');

      const questions = await GameService.generateQuestions(
        userData.pairId,
        'this-or-that',
        15 // This or That games can have more questions since they're quicker
      );

      if (!questions || questions.length === 0) {
        throw new Error('Failed to generate questions. Please try again.');
      }

      console.log('✅ Generated', questions.length, 'This or That questions');

      const gameId = await GameService.createGameSession(
        userData.pairId,
        'this-or-that',
        questions,
        user.uid,
        userData.partnerId
      );

      console.log('✅ Created This or That game session:', gameId);

      const game = await GameService.getGameSession(gameId);
      if (game) {
        if (!game.questions || game.questions.length === 0) {
          throw new Error('Game was created but has no questions. Please try again.');
        }

        setSelectedGame(game);
        setShowThisOrThatGame(true);
      } else {
        throw new Error('Failed to load the created game. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Error starting This or That game:', error);
      Alert.alert('Error', error.message || 'Failed to start game. Please try again.');
    } finally {
      setCreatingGame(false);
    }
  };

  const handleGameComplete = () => {
    setShowQuestionGame(false);
    setShowTriviaGame(false);
    setShowWouldYouRatherGame(false);
    setShowThisOrThatGame(false);
    setSelectedGame(null);
    Alert.alert('Game Complete!', 'Thanks for playing! Check your results above.');
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

  // Show content if partnerId exists - partner connection is determined by partnerId
  if (!userData?.partnerId) {
    return (
      <NoPartnerState
        title="Games"
        subtitle="Connect with your partner to play games and grow closer together!"
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Games</Text>
            <Text style={styles.subtitle}>Play together, grow closer</Text>
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
          {/* Game Statistics */}
          {gameStats.totalPlayed > 0 && (
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Ionicons name="trophy" size={24} color={theme.colors.accent} />
                <View style={styles.statContent}>
                  <Text style={styles.statValue}>{gameStats.totalPlayed}</Text>
                  <Text style={styles.statLabel}>Games Played</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="chatbubbles" size={24} color={theme.colors.primary} />
                <View style={styles.statContent}>
                  <Text style={styles.statValue}>{gameStats.totalQuestions}</Text>
                  <Text style={styles.statLabel}>Questions</Text>
                </View>
              </View>
            </View>
          )}

          {/* Active Games Section */}
          {activeGames.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Games</Text>
              {activeGames.map((game) => {
                const gameTypeInfo = GAME_TYPES.find(g => g.id === game.gameType);
                const progress = game.questions?.length ? ((game.currentQuestionIndex + 1) / game.questions.length) * 100 : 0;

                const handleDeleteGame = async () => {
                  if (!game.id) return;

                  Alert.alert(
                    'Delete Game',
                    'Are you sure you want to delete this game? This action cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            await GameService.deleteGameSession(game.id!);
                            console.log('✅ Game deleted successfully');
                          } catch (error: any) {
                            console.error('❌ Error deleting game:', error);
                            Alert.alert('Error', 'Failed to delete game. Please try again.');
                          }
                        },
                      },
                    ]
                  );
                };

                return (
                  <View key={game.id} style={styles.activeGameCardWrapper}>
                    <TouchableOpacity
                      style={styles.activeGameCard}
                      onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        console.log(`🎮 Opening ${game.gameType} Game:`, game.id);

                        try {
                          const latestGame = await GameService.getGameSession(game.id!);
                          if (latestGame) {
                            console.log(`📂 Opening ${game.gameType} game with latest state:`, {
                              id: latestGame.id,
                              questionsCount: latestGame.questions?.length,
                              currentIndex: latestGame.currentQuestionIndex,
                              status: latestGame.status
                            });

                            if (!latestGame.questions || latestGame.questions.length === 0) {
                              console.error(`❌ ${game.gameType} game has no questions:`, latestGame.id);
                              Alert.alert('Error', 'This game has no questions. Please start a new game.');
                              return;
                            }

                            setSelectedGame(latestGame);

                            if (game.gameType === 'question') {
                              setShowQuestionGame(true);
                            } else if (game.gameType === 'trivia') {
                              setShowTriviaGame(true);
                            } else if (game.gameType === 'would-you-rather') {
                              setShowWouldYouRatherGame(true);
                            } else if (game.gameType === 'this-or-that') {
                              setShowThisOrThatGame(true);
                            }
                          } else {
                            console.error(`❌ ${game.gameType} game not found:`, game.id);
                            Alert.alert('Error', 'Game not found. Please try again.');
                          }
                        } catch (error: any) {
                          console.error(`❌ Error fetching ${game.gameType} game:`, error);
                          if (game.questions && game.questions.length > 0) {
                            console.log(`⚠️ Using fallback ${game.gameType} game from state`);
                            setSelectedGame(game);

                            if (game.gameType === 'question') {
                              setShowQuestionGame(true);
                            } else if (game.gameType === 'trivia') {
                              setShowTriviaGame(true);
                            } else if (game.gameType === 'would-you-rather') {
                              setShowWouldYouRatherGame(true);
                            } else if (game.gameType === 'this-or-that') {
                              setShowThisOrThatGame(true);
                            }
                          } else {
                            Alert.alert('Error', 'Unable to load game. Please try again.');
                          }
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.activeGameHeader}>
                        <View style={[styles.activeGameIconContainer, { backgroundColor: (gameTypeInfo?.color || theme.colors.primary) + '20' }]}>
                          <Ionicons
                            name={gameTypeInfo?.icon as any || 'game-controller'}
                            size={24}
                            color={gameTypeInfo?.color || theme.colors.primary}
                          />
                        </View>
                        <View style={styles.activeGameInfo}>
                          <Text style={styles.activeGameTitle}>
                            {gameTypeInfo?.name || game.gameType}
                          </Text>
                          <Text style={styles.activeGameStatus}>
                            {game.status === 'active' ? 'In Progress' : 'Pending'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                      </View>

                      {game.questions && game.questions.length > 0 ? (
                        <View style={styles.progressContainer}>
                          <View style={styles.progressBar}>
                            <View style={[styles.progressFill, {
                              width: `${Math.min(100, Math.max(0, progress))}%`,
                              backgroundColor: gameTypeInfo?.color || theme.colors.primary
                            }]} />
                          </View>
                          <Text style={styles.progressText}>
                            {Math.max(0, Math.min(game.currentQuestionIndex + 1, game.questions.length))} / {game.questions.length} questions
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.progressText}>No questions yet</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteGameButton}
                      onPress={handleDeleteGame}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* Start a Game Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Start a Game</Text>
            <View style={styles.gameGrid}>
              {GAME_TYPES.map((game) => {
                // All games are now available!
                const isAvailable = true;
                return (
                  <TouchableOpacity
                    key={game.id}
                    style={[
                      styles.gameCard,
                      { borderColor: game.color },
                      !isAvailable && styles.gameCardDisabled
                    ]}
                    onPress={() => handleStartGame(game.id)}
                    disabled={creatingGame || !isAvailable}
                    activeOpacity={0.7}
                  >
                    {creatingGame ? (
                      <ActivityIndicator size="small" color={game.color} />
                    ) : (
                      <>
                        <View style={[styles.gameIconContainer, { backgroundColor: game.color + '15' }]}>
                          <Ionicons name={game.icon as any} size={32} color={game.color} />
                        </View>
                        <Text style={styles.gameName}>{game.name}</Text>
                        {!isAvailable && (
                          <View style={styles.comingSoonBadge}>
                            <Text style={styles.comingSoonText}>Soon</Text>
                          </View>
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Completed Games Section */}
          {completedGames.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Games</Text>
              {completedGames.map((game) => {
                const gameTypeInfo = GAME_TYPES.find(g => g.id === game.gameType);
                return (
                  <TouchableOpacity
                    key={game.id}
                    style={styles.completedGameCard}
                    onPress={async () => {
                      try {
                        const latestGame = await GameService.getGameSession(game.id!);
                        if (latestGame) {
                          console.log(`📂 Opening completed ${game.gameType} game for review:`, latestGame.id);
                          setSelectedGame(latestGame);

                          if (game.gameType === 'question') {
                            setShowQuestionGame(true);
                          } else if (game.gameType === 'trivia') {
                            setShowTriviaGame(true);
                          } else if (game.gameType === 'would-you-rather') {
                            setShowWouldYouRatherGame(true);
                          } else if (game.gameType === 'this-or-that') {
                            setShowThisOrThatGame(true);
                          }
                        }
                      } catch (error: any) {
                        console.error(`❌ Error fetching completed ${game.gameType} game:`, error);
                        Alert.alert('Error', 'Unable to load game. Please try again.');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.activeGameHeader}>
                      <View style={[styles.activeGameIconContainer, { backgroundColor: (gameTypeInfo?.color || theme.colors.primary) + '15' }]}>
                        <Ionicons
                          name={gameTypeInfo?.icon as any || 'game-controller'}
                          size={20}
                          color={gameTypeInfo?.color || theme.colors.primary}
                        />
                      </View>
                      <View style={styles.activeGameInfo}>
                        <Text style={styles.completedGameTitle}>
                          {gameTypeInfo?.name || game.gameType}
                        </Text>
                        <Text style={styles.completedGameTime}>
                          {formatTimeAgo(game.updatedAt || game.createdAt)}
                        </Text>
                      </View>
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                        <Text style={styles.completedBadgeText}>Done</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} style={{ marginLeft: theme.spacing.sm }} />
                    </View>
                    {game.questions?.length > 0 && (
                      <Text style={styles.completedGameQuestions}>
                        {game.questions.length} questions completed • Tap to review
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Question Game Modal */}
        <QuestionGame
          visible={showQuestionGame && !!selectedGame && selectedGame.gameType === 'question'}
          gameSession={selectedGame?.gameType === 'question' ? selectedGame : null}
          currentUserId={user?.uid || ''}
          partnerName={partnerData?.displayName || partnerData?.name || 'Your Partner'}
          userName={userData?.displayName || userData?.name || 'You'}
          onClose={() => {
            console.log('🔼 Closing Question Game modal');
            setShowQuestionGame(false);
            setTimeout(() => {
              if (selectedGame?.gameType === 'question') {
                setSelectedGame(null);
              }
            }, 300);
          }}
          onGameComplete={handleGameComplete}
        />

        {/* Trivia Game Modal */}
        <TriviaGame
          visible={showTriviaGame && !!selectedGame && selectedGame.gameType === 'trivia'}
          gameSession={selectedGame?.gameType === 'trivia' ? selectedGame : null}
          currentUserId={user?.uid || ''}
          partnerName={partnerData?.displayName || partnerData?.name || 'Your Partner'}
          userName={userData?.displayName || userData?.name || 'You'}
          onClose={() => {
            console.log('🔼 Closing Trivia Game modal');
            setShowTriviaGame(false);
            setTimeout(() => {
              if (selectedGame?.gameType === 'trivia') {
                setSelectedGame(null);
              }
            }, 300);
          }}
          onGameComplete={handleGameComplete}
        />

        {/* Would You Rather Game Modal */}
        <ChoiceGame
          visible={showWouldYouRatherGame && !!selectedGame && selectedGame.gameType === 'would-you-rather'}
          gameSession={selectedGame?.gameType === 'would-you-rather' ? selectedGame : null}
          currentUserId={user?.uid || ''}
          partnerName={partnerData?.displayName || partnerData?.name || 'Your Partner'}
          userName={userData?.displayName || userData?.name || 'You'}
          onClose={() => {
            console.log('🔼 Closing Would You Rather Game modal');
            setShowWouldYouRatherGame(false);
            setTimeout(() => {
              if (selectedGame?.gameType === 'would-you-rather') {
                setSelectedGame(null);
              }
            }, 300);
          }}
          onGameComplete={handleGameComplete}
          gameType="would-you-rather"
        />

        {/* This or That Game Modal */}
        <ChoiceGame
          visible={showThisOrThatGame && !!selectedGame && selectedGame.gameType === 'this-or-that'}
          gameSession={selectedGame?.gameType === 'this-or-that' ? selectedGame : null}
          currentUserId={user?.uid || ''}
          partnerName={partnerData?.displayName || partnerData?.name || 'Your Partner'}
          userName={userData?.displayName || userData?.name || 'You'}
          onClose={() => {
            console.log('🔼 Closing This or That Game modal');
            setShowThisOrThatGame(false);
            setTimeout(() => {
              if (selectedGame?.gameType === 'this-or-that') {
                setSelectedGame(null);
              }
            }, 300);
          }}
          onGameComplete={handleGameComplete}
          gameType="this-or-that"
        />
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
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
    gap: theme.spacing.sm,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  gameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  gameCard: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    ...theme.shadows.md,
    position: 'relative',
    minHeight: 140,
    justifyContent: 'center',
  },
  gameCardDisabled: {
    opacity: 0.6,
  },
  gameIconContainer: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  gameName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  comingSoonBadge: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    backgroundColor: theme.colors.textLight + '20',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  comingSoonText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  activeGameCardWrapper: {
    position: 'relative',
    marginBottom: theme.spacing.md,
  },
  activeGameCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  deleteGameButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    padding: theme.spacing.xs,
    zIndex: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
  },
  activeGameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  activeGameIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeGameInfo: {
    flex: 1,
  },
  activeGameTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  activeGameStatus: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  progressContainer: {
    marginTop: theme.spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.divider,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  completedGameCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  completedGameTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  completedGameTime: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  completedGameQuestions: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textLight,
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.success + '15',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  completedBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.success,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});

