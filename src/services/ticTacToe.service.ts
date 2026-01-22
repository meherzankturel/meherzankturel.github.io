import { db } from '../config/firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';

export type Player = 'X' | 'O';
export type CellValue = Player | '';
export type Board = CellValue[]; // Flat array of 9 cells (Firestore doesn't support nested arrays)
export type GameStatus = 'waiting' | 'active' | 'finished';

export interface TicTacToeGame {
    id: string;
    pairId: string;
    player1Id: string;  // X player
    player2Id: string;  // O player  
    currentTurn: string; // userId whose turn it is
    board: Board;  // Flat array [0-8] representing 3x3 grid
    status: GameStatus;
    winner: string | 'draw' | null;
    startedAt: Timestamp;
    finishedAt?: Timestamp;
    moveHistory: {
        playerId: string;
        position: number; // 0-8
        timestamp: Timestamp;
    }[];
}

// Helper functions to convert between flat index and row/col
export const toFlatIndex = (row: number, col: number): number => row * 3 + col;
export const fromFlatIndex = (index: number): [number, number] => [Math.floor(index / 3), index % 3];

export class TicTacToeService {
    /**
   * Create a new Tic-Tac-Toe game
   */
    static async createGame(
        pairId: string,
        player1Id: string,
        player2Id: string
    ): Promise<string> {
        // Use fixed game ID based on pairId
        const gameId = `game_${pairId}`;
        const gameRef = doc(db, 'ticTacToeGames', gameId);

        // Flat board [0-8] representing 3x3 grid
        const initialBoard: Board = ['', '', '', '', '', '', '', '', ''];

        const game: Omit<TicTacToeGame, 'id'> = {
            pairId,
            player1Id, // Always X
            player2Id, // Always O
            currentTurn: player1Id, // X goes first
            board: initialBoard,
            status: 'active',
            winner: null,
            startedAt: Timestamp.now(),
            moveHistory: [],
        };

        await setDoc(gameRef, game);
        console.log('✅ Created Tic-Tac-Toe game:', gameId);

        return gameId;
    }

    /**
     * Make a move
     */
    static async makeMove(
        gameId: string,
        playerId: string,
        row: number,
        col: number
    ): Promise<boolean> {
        const gameRef = doc(db, 'ticTacToeGames', gameId);
        const gameDoc = await getDoc(gameRef);

        if (!gameDoc.exists()) {
            console.error('Game not found');
            return false;
        }

        const game = { id: gameDoc.id, ...gameDoc.data() } as TicTacToeGame;

        // Validate move
        if (game.status !== 'active') {
            console.error('Game is not active');
            return false;
        }

        if (game.currentTurn !== playerId) {
            console.error('Not your turn');
            return false;
        }

        const flatIndex = toFlatIndex(row, col);
        if (game.board[flatIndex] !== '') {
            console.error('Cell already occupied');
            return false;
        }

        // Determine player's symbol
        const playerSymbol: Player = game.player1Id === playerId ? 'X' : 'O';

        // Update board
        const newBoard = [...game.board];
        newBoard[flatIndex] = playerSymbol;

        // Check for winner
        const winner = this.checkWinner(newBoard);
        const isDraw = !winner && this.isBoardFull(newBoard);

        // Determine next turn
        const nextTurn = game.player1Id === playerId ? game.player2Id : game.player1Id;

        // Update game
        const updates: Partial<TicTacToeGame> = {
            board: newBoard,
            currentTurn: winner || isDraw ? game.currentTurn : nextTurn,
            moveHistory: [
                ...game.moveHistory,
                {
                    playerId,
                    position: flatIndex,
                    timestamp: Timestamp.now(),
                }
            ],
        };

        if (winner) {
            updates.status = 'finished';
            updates.winner = playerId;
            updates.finishedAt = Timestamp.now();
        } else if (isDraw) {
            updates.status = 'finished';
            updates.winner = 'draw';
            updates.finishedAt = Timestamp.now();
        }

        await updateDoc(gameRef, updates);
        console.log('✅ Move made:', { playerId, row, col, winner, isDraw });

        return true;
    }

    /**
   * Check for winner (works with flat board array)
   */
    static checkWinner(board: Board): Player | null {
        // Winning combinations (indices in flat array)
        const winPatterns = [
            [0, 1, 2], // Top row
            [3, 4, 5], // Middle row
            [6, 7, 8], // Bottom row
            [0, 3, 6], // Left column
            [1, 4, 7], // Middle column
            [2, 5, 8], // Right column
            [0, 4, 8], // Diagonal \
            [2, 4, 6], // Diagonal /
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a] as Player;
            }
        }

        return null;
    }

    /**
     * Check if board is full (draw)
     */
    static isBoardFull(board: Board): boolean {
        return board.every(cell => cell !== '');
    }

    /**
     * Listen to game updates
     */
    static listenToGame(
        gameId: string,
        callback: (game: TicTacToeGame | null) => void
    ): () => void {
        const gameRef = doc(db, 'ticTacToeGames', gameId);

        return onSnapshot(gameRef, (snapshot) => {
            if (snapshot.exists()) {
                const game = { id: snapshot.id, ...snapshot.data() } as TicTacToeGame;
                callback(game);
            } else {
                callback(null);
            }
        });
    }

    /**
     * Get active game for a pair
     */
    static async getActiveGame(pairId: string): Promise<TicTacToeGame | null> {
        // For simplicity, we'll just use the pairId to create a consistent game ID
        // In production, you might want to query for active games
        const gameId = `game_${pairId}`;
        const gameRef = doc(db, 'ticTacToeGames', gameId);
        const gameDoc = await getDoc(gameRef);

        if (gameDoc.exists() && gameDoc.data().status === 'active') {
            return { id: gameDoc.id, ...gameDoc.data() } as TicTacToeGame;
        }

        return null;
    }

    /**
     * Reset game for new round
     */
    static async resetGame(gameId: string): Promise<void> {
        const gameRef = doc(db, 'ticTacToeGames', gameId);
        const gameDoc = await getDoc(gameRef);

        if (!gameDoc.exists()) return;

        const game = gameDoc.data() as TicTacToeGame;

        const initialBoard: Board = ['', '', '', '', '', '', '', '', ''];

        await updateDoc(gameRef, {
            board: initialBoard,
            status: 'active',
            winner: null,
            currentTurn: game.player1Id, // X always starts
            startedAt: Timestamp.now(),
            finishedAt: null,
            moveHistory: [],
        });

        console.log('✅ Game reset:', gameId);
    }
}
