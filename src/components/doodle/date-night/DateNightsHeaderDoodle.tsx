import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../config/theme';

interface DateNightsHeaderDoodleProps {
    onAddPress: () => void;
}

export const DateNightsHeaderDoodle: React.FC<DateNightsHeaderDoodleProps> = ({ onAddPress }) => {
    const handwritingFont = Platform.OS === 'ios' ? 'Noteworthy-Bold' : 'sans-serif-medium';

    return (
        <View style={styles.header}>
            <View>
                <Text style={[styles.title, { fontFamily: handwritingFont }]}>Doodle Date Nights</Text>
                <Text style={styles.subtitle}>Plan your next adventure</Text>
            </View>

            <TouchableOpacity onPress={onAddPress} activeOpacity={0.8} style={styles.addButton}>
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.xl,
        paddingBottom: theme.spacing.lg,
    },
    title: {
        fontSize: 28,
        color: theme.colors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontStyle: 'italic',
    },
    addButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '-5deg' }],
        ...theme.shadows.md,
        borderWidth: 2,
        borderColor: '#fff',
    }
});
