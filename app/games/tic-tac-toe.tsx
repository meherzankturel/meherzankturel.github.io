import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { TicTacToeService, TicTacToeGame, CellValue } from '../../src/services/ticTacToe.service';
import { theme } from '../../src/config/theme';
import * as Haptics from 'expo-haptics';

export default function TicTacToeScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [userData, setUserData] = useState<any>(null);
    const [partnerData, setPartnerData] = useState<any>(null);
    const [game, setGame] = useState<TicTacToeGame | null>(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    // Load user data
    useEffect(() => {
        if (!user) return;

        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setUserData(data);

                // Load partner data
                if (data.partnerId) {
                    const partnerDoc = await onSnapshot(doc(db, 'users', data.partnerId), (snap) => {
                        if (snap.exists()) {
                            setPartnerData(snap.data());
                        }
                    });
                }
            }
        });

        return unsubscribe;
    }, [user]);

    // Load or create game
    useEffect(() => {
        if (!userData?.pairId || !user) return;

        const gameId = `game_${userData.pairId}`;

        const unsubscribe = TicTacToeService.listenToGame(gameId, (gameData) => {
            setGame(gameData);
            setLoading(false);
        });

        return unsubscribe;
    }, [userData?.pairId, user]);

    const handleNewGame = async () => {
        if (!userData?.pairId || !user || !userData.partnerId) return;

        setCreating(true);
        try {
            const gameId = `game_${userData.pairId}`;

            if (game) {
                // Reset existing game
                await TicTacToeService.resetGame(gameId);
            } else {
                // Create new game
                await TicTacToeService.createGame(
                    userData.pairId,
                    user.uid,
                    userData.partnerId
                );
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Failed to create game:', error);
            Alert.alert('Error', 'Failed to start new game');
        } finally {
            setCreating(false);
        }
    };

    const handleCellPress = async (row: number, col: number) => {
        if (!game || !user) return;

        if (game.status !== 'active') {
            Alert.alert('Game Over', 'Start a new game to play again!');
            return;
        }

        if (game.currentTurn !== user.uid) {
            Alert.alert("Not Your Turn", "Wait for your partner's move!");
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const success = await TicTacToeService.makeMove(game.id, user.uid, row, col);

        if (!success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const getCellValue = (row: number, col: number): CellValue => {
        if (!game) return '';
        const index = row * 3 + col; // Convert to flat index
        return game.board[index] || '';
    };

    const isMyTurn = game?.currentTurn === user?.uid;
    const mySymbol = game?.player1Id === user?.uid ? 'X' : 'O';
    const partnerSymbol = mySymbol === 'X' ? 'O' : 'X';

    const getStatusText = () => {
        if (!game) return 'Start a new game!';
        if (game.status === 'finished') {
            if (game.winner === 'draw') return "It's a draw!";
            if (game.winner === user?.uid) return 'You won! 🎉';
            return partnerData?.name ? `${partnerData.name} won!` : 'Partner won!';
        }
        if (isMyTurn) return 'Your turn';
        return "Partner's turn";
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <LinearGradient colors={[theme.colors.background, theme.colors.surface]} style={styles.gradient}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </LinearGradient>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={[theme.colors.background, theme.colors.surface]} style={styles.gradient}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Tic-Tac-Toe</Text>
                    <View style={styles.backButton} />
                </View>

                {/* Game Status */}
                <View style={styles.statusContainer}>
                    <Text style={styles.statusText}>{getStatusText()}</Text>
                    {game?.status === 'active' && (
                        <View style={styles.turnIndicator}>
                            <Text style={styles.turnText}>
                                You are: {mySymbol}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Game Board */}
                <View style={styles.boardContainer}>
                    {[0, 1, 2].map((row) => (
                        <View key={row} style={styles.row}>
                            {[0, 1, 2].map((col) => {
                                const value = getCellValue(row, col);
                                const isX = value === 'X';
                                const isO = value === 'O';

                                return (
                                    <TouchableOpacity
                                        key={col}
                                        style={styles.cell}
                                        onPress={() => handleCellPress(row, col)}
                                        disabled={!!value || game?.status !== 'active' || !isMyTurn}
                                        activeOpacity={0.7}
                                    >
                                        <LinearGradient
                                            colors={
                                                value
                                                    ? isX
                                                        ? [theme.colors.primary, theme.colors.primaryDark]
                                                        : ['#FF6B9D', '#C9184A']
                                                    : ['#1a1a2e', '#16213e']
                                            }
                                            style={styles.cellGradient}
                                        >
                                            {value && (
                                                <Text
                                                    style={[
                                                        styles.cellText,
                                                        isX && styles.cellTextX,
                                                        isO && styles.cellTextO,
                                                    ]}
                                                >
                                                    {value}
                                                </Text>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}
                </View>

                {/* New Game Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.newGameButton}
                        onPress={handleNewGame}
                        disabled={creating}
                    >
                        <LinearGradient
                            colors={[theme.colors.primary, theme.colors.primaryDark]}
                            style={styles.newGameGradient}
                        >
                            {creating ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="refresh" size={20} color="#fff" />
                                    <Text style={styles.newGameText}>
                                        {game ? 'New Game' : 'Start Game'}
                                    </Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    gradient: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.colors.text,
    },
    statusContainer: {
        alignItems: 'center',
        paddingVertical: theme.spacing.xl,
    },
    statusText: {
        fontSize: 28,
        fontWeight: '800',
        color: theme.colors.text,
        textAlign: 'center',
    },
    turnIndicator: {
        marginTop: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
    },
    turnText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontWeight: '600',
    },
    boardContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.lg,
    },
    row: {
        flexDirection: 'row',
    },
    cell: {
        width: 100,
        height: 100,
        margin: 4,
    },
    cellGradient: {
        flex: 1,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        ...theme.shadows.md,
    },
    cellText: {
        fontSize: 56,
        fontWeight: '900',
        color: '#fff',
    },
    cellTextX: {
        // Cyan for X
    },
    cellTextO: {
        // Pink for O
    },
    footer: {
        padding: theme.spacing.lg,
    },
    newGameButton: {
        borderRadius: theme.borderRadius.xl,
        overflow: 'hidden',
    },
    newGameGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: theme.spacing.xl,
        gap: theme.spacing.sm,
    },
    newGameText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
});
