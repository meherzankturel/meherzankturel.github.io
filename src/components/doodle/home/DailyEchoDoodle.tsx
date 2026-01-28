import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../config/theme';
import { WobblyCard } from '../index';

interface DailyEchoDoodleProps {
    question: string;
    hasAnswered: boolean;
    onAnswer: () => void;
    onReveal?: () => void;
    canReveal?: boolean;
    countdown?: string;
    waitingForPartner?: boolean;
}

export const DailyEchoDoodle: React.FC<DailyEchoDoodleProps> = ({
    question,
    hasAnswered,
    onAnswer,
    onReveal,
    canReveal,
    countdown,
    waitingForPartner
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.line} /> {/* Separation line */}

            <WobblyCard
                style={styles.card}
                borderColor="#D0B4F8" // Light purple
                backgroundColor="#F9F5FF"
                onPress={!hasAnswered ? onAnswer : (canReveal && onReveal ? onReveal : undefined)}
            >
                {/* Dotted Background - Simulated with opacity pattern if possible, or just plain color */}
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={styles.curveIcon}>
                            {/* Decorative curve */}
                            <View style={styles.curve} />
                        </View>
                        <Text style={styles.headerTitle}>DAILY ECHO</Text>
                    </View>

                    <Text style={styles.question}>
                        {question}
                    </Text>

                    {/* Status/Action */}
                    <View style={styles.footer}>
                        {!hasAnswered ? (
                            <Text style={styles.actionText}>Tap to answer...</Text>
                        ) : canReveal ? (
                            <View style={styles.statusRow}>
                                <Ionicons name="eye-outline" size={16} color="#8A5AAB" />
                                <Text style={styles.statusText}>Reveal Answers</Text>
                            </View>
                        ) : waitingForPartner ? (
                            <View style={styles.statusRow}>
                                <Ionicons name="hourglass-outline" size={16} color="#8A5AAB" />
                                <Text style={styles.statusText}>Waiting for partner...</Text>
                            </View>
                        ) : (
                            <View style={styles.statusRow}>
                                <Ionicons name="time-outline" size={16} color="#8A5AAB" />
                                <Text style={styles.statusText}>Reveals in {countdown}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </WobblyCard>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: theme.spacing.md,
        marginVertical: theme.spacing.lg,
        alignItems: 'center',
    },
    line: {
        width: 40,
        height: 2,
        backgroundColor: '#E0E0E0',
        marginBottom: 20,
    },
    card: {
        width: '100%',
        minHeight: 140,
        borderWidth: 1,
    },
    content: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 12,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#A880E8', // Purple
        letterSpacing: 2,
    },
    curveIcon: {
        position: 'absolute',
        left: 0,
    },
    curve: {
        width: 20,
        height: 10,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: '#D0B4F8',
        borderRadius: 10,
    },
    question: {
        fontSize: 18,
        textAlign: 'center',
        color: '#000',
        fontFamily: 'Itim_400Regular', // Handwritten feel
        marginBottom: 20,
        lineHeight: 26,
    },
    footer: {
        alignItems: 'center',
    },
    actionText: {
        fontSize: 14,
        color: '#A880E8',
        fontStyle: 'italic',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F0E6FA',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        color: '#8A5AAB',
        fontWeight: '600',
    }
});
