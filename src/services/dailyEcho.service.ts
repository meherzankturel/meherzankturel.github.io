import { db } from '../config/firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';

export interface DailyEchoQuestion {
    id: string;
    question: string;
    category: string;
}

export interface DailyEchoAnswer {
    userId: string;
    answer: string;
    answeredAt: Date;
}

export interface DailyEcho {
    id: string;
    pairId: string;
    date: string; // YYYY-MM-DD format
    question: string;
    user1Answer?: DailyEchoAnswer;
    user2Answer?: DailyEchoAnswer;
    revealTime: Date; // 10 PM local time
    isRevealed: boolean;
    createdAt: Date;
}

// Question bank - rotating daily questions
const QUESTION_BANK: DailyEchoQuestion[] = [
    { id: '1', question: "What's one thing that made you think of me today?", category: 'connection' },
    { id: '2', question: "What made you smile today?", category: 'happiness' },
    { id: '3', question: "What's something you're looking forward to?", category: 'future' },
    { id: '4', question: "What's a small victory you had today?", category: 'achievement' },
    { id: '5', question: "What's something you're grateful for right now?", category: 'gratitude' },
    { id: '6', question: "If you could tell me one thing right now, what would it be?", category: 'communication' },
    { id: '7', question: "What's been on your mind lately?", category: 'thoughts' },
    { id: '8', question: "What's something that challenged you today?", category: 'growth' },
    { id: '9', question: "What's a memory of us that made you happy recently?", category: 'nostalgia' },
    { id: '10', question: "What do you need most right now?", category: 'needs' },
    { id: '11', question: "What's something you want to learn together?", category: 'growth' },
    { id: '12', question: "What's a dream you still want to chase?", category: 'future' },
    { id: '13', question: "What made you feel loved today?", category: 'love' },
    { id: '14', question: "What's something silly that made you laugh?", category: 'fun' },
    { id: '15', question: "What would your perfect day with me look like?", category: 'romance' },
    { id: '16', question: "What's something you appreciate about yourself?", category: 'self-love' },
    { id: '17', question: "What's a song that reminds you of us?", category: 'music' },
    { id: '18', question: "What's something you want to tell me but haven't yet?", category: 'communication' },
    { id: '19', question: "What's making you feel energized or drained right now?", category: 'energy' },
    { id: '20', question: "What's a tradition you'd love for us to start?", category: 'future' },
    { id: '21', question: "What's something that surprised you today?", category: 'surprise' },
    { id: '22', question: "What do you miss most when we're apart?", category: 'connection' },
    { id: '23', question: "What's a compliment you wish I'd give you more?", category: 'affirmation' },
    { id: '24', question: "What's your favorite way I show you love?", category: 'love' },
    { id: '25', question: "What's something you're proud of me for?", category: 'pride' },
    { id: '26', question: "What's a place you'd love to visit together?", category: 'adventure' },
    { id: '27', question: "What's something that made you feel peaceful today?", category: 'peace' },
    { id: '28', question: "What's a hobby you'd like us to try together?", category: 'fun' },
    { id: '29', question: "What's your favorite quality about us as a couple?", category: 'relationship' },
    { id: '30', question: "What's something you want more of in your life?", category: 'desires' },
];

export class DailyEchoService {
    /**
     * Get today's date in YYYY-MM-DD format
     * Note: "Today" starts at 6am, not midnight
     * If current time is before 6am, we're still on "yesterday"
     */
    private static getTodayDate(): string {
        const now = new Date();
        const hour = now.getHours();

        // If it's before 6am, treat it as yesterday
        if (hour < 6) {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            return yesterday.toISOString().split('T')[0];
        }

        return now.toISOString().split('T')[0];
    }

    /**
     * Get question for today based on date
     */
    private static getTodayQuestion(): DailyEchoQuestion {
        const today = new Date();
        // Use day of year to cycle through questions
        const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
        const questionIndex = dayOfYear % QUESTION_BANK.length;
        return QUESTION_BANK[questionIndex];
    }

    /**
     * Get reveal time for today (10 PM local time)
     */
    private static getTodayRevealTime(): Date {
        const now = new Date();
        const revealTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0); // 10 PM

        // If it's already past 10 PM, the reveal time is now
        if (now > revealTime) {
            return now;
        }

        return revealTime;
    }

    /**
     * Check if current time is past reveal time
     */
    static canReveal(dailyEcho: DailyEcho): boolean {
        const now = new Date();
        return now >= dailyEcho.revealTime;
    }

    /**
     * Get or create today's Daily Echo for a pair
     */
    static async getTodayEcho(pairId: string): Promise<DailyEcho | null> {
        try {
            const todayDate = this.getTodayDate();
            const docRef = doc(db, 'dailyEchos', `${pairId}_${todayDate}`);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    pairId: data.pairId,
                    date: data.date,
                    question: data.question,
                    user1Answer: data.user1Answer,
                    user2Answer: data.user2Answer,
                    revealTime: data.revealTime.toDate(),
                    isRevealed: data.isRevealed || false,
                    createdAt: data.createdAt.toDate(),
                };
            }

            // Create new daily echo for today
            const todayQuestion = this.getTodayQuestion();
            const newEcho: DailyEcho = {
                id: `${pairId}_${todayDate}`,
                pairId,
                date: todayDate,
                question: todayQuestion.question,
                revealTime: this.getTodayRevealTime(),
                isRevealed: false,
                createdAt: new Date(),
            };

            await setDoc(docRef, {
                pairId: newEcho.pairId,
                date: newEcho.date,
                question: newEcho.question,
                revealTime: Timestamp.fromDate(newEcho.revealTime),
                isRevealed: false,
                createdAt: Timestamp.fromDate(newEcho.createdAt),
            });

            return newEcho;
        } catch (error) {
            console.error('Error getting today\'s echo:', error);
            return null;
        }
    }

    /**
     * Submit answer for today's Daily Echo
     */
    static async submitAnswer(pairId: string, userId: string, answer: string): Promise<boolean> {
        try {
            const todayDate = this.getTodayDate();
            const docRef = doc(db, 'dailyEchos', `${pairId}_${todayDate}`);

            // Determine which user field to update
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                console.error('Daily echo does not exist');
                return false;
            }

            const data = docSnap.data();

            // Check if user already answered
            if (data.user1Answer?.userId === userId || data.user2Answer?.userId === userId) {
                console.warn('User already answered today');
                return false;
            }

            const answerData: DailyEchoAnswer = {
                userId,
                answer,
                answeredAt: new Date(),
            };

            // Update the appropriate user answer field
            const updateField = data.user1Answer ? 'user2Answer' : 'user1Answer';

            await setDoc(docRef, {
                [updateField]: {
                    userId: answerData.userId,
                    answer: answerData.answer,
                    answeredAt: Timestamp.fromDate(answerData.answeredAt),
                },
            }, { merge: true });

            return true;
        } catch (error) {
            console.error('Error submitting answer:', error);
            return false;
        }
    }

    /**
     * Check if user has answered today
     */
    static hasUserAnswered(dailyEcho: DailyEcho | null, userId: string): boolean {
        if (!dailyEcho) return false;
        return dailyEcho.user1Answer?.userId === userId || dailyEcho.user2Answer?.userId === userId;
    }

    /**
     * Check if both users have answered
     */
    static haveBothAnswered(dailyEcho: DailyEcho | null): boolean {
        if (!dailyEcho) return false;
        return !!dailyEcho.user1Answer && !!dailyEcho.user2Answer;
    }

    /**
     * Get user's answer
     */
    static getUserAnswer(dailyEcho: DailyEcho | null, userId: string): string | null {
        if (!dailyEcho) return null;
        if (dailyEcho.user1Answer?.userId === userId) return dailyEcho.user1Answer.answer;
        if (dailyEcho.user2Answer?.userId === userId) return dailyEcho.user2Answer.answer;
        return null;
    }

    /**
     * Get partner's answer (only if revealed)
     */
    static getPartnerAnswer(dailyEcho: DailyEcho | null, userId: string): string | null {
        if (!dailyEcho || !dailyEcho.isRevealed) return null;
        if (dailyEcho.user1Answer?.userId !== userId) return dailyEcho.user1Answer?.answer || null;
        if (dailyEcho.user2Answer?.userId !== userId) return dailyEcho.user2Answer?.answer || null;
        return null;
    }

    /**
     * Mark as revealed (called when user clicks reveal button)
     */
    static async markRevealed(pairId: string): Promise<boolean> {
        try {
            const todayDate = this.getTodayDate();
            const docRef = doc(db, 'dailyEchos', `${pairId}_${todayDate}`);

            await setDoc(docRef, {
                isRevealed: true,
            }, { merge: true });

            return true;
        } catch (error) {
            console.error('Error marking revealed:', error);
            return false;
        }
    }

    /**
     * Listen to today's Daily Echo in real-time
     */
    static listenToTodayEcho(pairId: string, callback: (echo: DailyEcho | null) => void): () => void {
        const todayDate = this.getTodayDate();
        const docRef = doc(db, 'dailyEchos', `${pairId}_${todayDate}`);

        const unsubscribe = onSnapshot(
            docRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    callback({
                        id: snapshot.id,
                        pairId: data.pairId,
                        date: data.date,
                        question: data.question,
                        user1Answer: data.user1Answer,
                        user2Answer: data.user2Answer,
                        revealTime: data.revealTime.toDate(),
                        isRevealed: data.isRevealed || false,
                        createdAt: data.createdAt.toDate(),
                    });
                } else {
                    callback(null);
                }
            },
            (error) => {
                console.error('Error listening to daily echo:', error);
                callback(null);
            }
        );

        return unsubscribe;
    }

    /**
     * Get countdown time until reveal (in seconds)
     */
    static getCountdownSeconds(dailyEcho: DailyEcho | null): number {
        if (!dailyEcho) return 0;
        const now = new Date();
        const diff = dailyEcho.revealTime.getTime() - now.getTime();
        return Math.max(0, Math.floor(diff / 1000));
    }

    /**
     * Format countdown time as HH:MM:SS
     */
    static formatCountdown(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}
