import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PlanDateStep3Props {
    duration: number;
    setDuration: (m: number) => void;
    notes: string;
    setNotes: (t: string) => void;
    reminderEnabled: boolean;
    setReminderEnabled: (b: boolean) => void;
    onCreate: () => void;
    onBack: () => void;
    submitting?: boolean;
}

const DURATION_OPTIONS = [
    { label: '1h', value: 60 },
    { label: '2h', value: 120 },
    { label: '3h', value: 180 },
    { label: '4h+', value: 240 },
];

export const PlanDateStep3: React.FC<PlanDateStep3Props> = ({
    duration,
    setDuration,
    notes,
    setNotes,
    reminderEnabled,
    setReminderEnabled,
    onCreate,
    onBack,
    submitting
}) => {
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} disabled={submitting}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                {/* Progress Indicators */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressDot} />
                    <View style={styles.progressDot} />
                    <View style={[styles.progressDot, styles.activeProgress]} />
                </View>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.screenTitle}>Final Touches</Text>

                {/* Duration */}
                <View style={styles.section}>
                    <Text style={styles.label}>How long?</Text>
                    <View style={styles.durationRow}>
                        {DURATION_OPTIONS.map((opt) => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[styles.durationChip, duration === opt.value && styles.activeDurationChip]}
                                onPress={() => setDuration(opt.value)}
                            >
                                <Text style={[styles.durationText, duration === opt.value && styles.activeDurationText]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Notes */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Any extra notes?</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Don't forget..."
                        placeholderTextColor="#ccc"
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                    />
                    <View style={styles.underline} />
                </View>

                {/* Reminder */}
                <View style={styles.row}>
                    <Text style={styles.label}>Remind me 30m before?</Text>
                    <Switch
                        value={reminderEnabled}
                        onValueChange={setReminderEnabled}
                        trackColor={{ false: '#ccc', true: '#A020F0' }}
                    />
                </View>

                {/* Create Button */}
                <TouchableOpacity
                    style={[styles.createButton, submitting && styles.disabledButton]}
                    onPress={onCreate}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.createButtonText}>CREATE DATE</Text>
                    )}
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        marginBottom: 40,
    },
    progressContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E0E0E0',
    },
    activeProgress: {
        width: 24,
        backgroundColor: '#A020F0',
    },
    content: {
        paddingHorizontal: 30,
        paddingBottom: 60,
    },
    screenTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 40,
        textAlign: 'center',
    },
    section: {
        marginBottom: 40,
    },
    label: {
        fontSize: 16,
        color: '#666',
        marginBottom: 10,
        fontWeight: '600',
    },
    durationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    durationChip: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: '#F9F9F9',
    },
    activeDurationChip: {
        borderColor: '#A020F0',
        backgroundColor: '#F3E5F5',
    },
    durationText: {
        color: '#666',
        fontWeight: '600',
    },
    activeDurationText: {
        color: '#A020F0',
        fontWeight: 'bold',
    },
    inputContainer: {
        marginBottom: 40,
    },
    input: {
        fontSize: 20,
        color: '#000',
        marginBottom: 10,
        minHeight: 40,
    },
    underline: {
        height: 1,
        backgroundColor: '#ccc',
        width: '100%',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 40,
    },
    createButton: {
        backgroundColor: '#A020F0', // Purple
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        shadowColor: '#A020F0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    disabledButton: {
        opacity: 0.7,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
});
