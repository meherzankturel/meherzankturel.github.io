import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../config/theme';

interface PlanDateStep2Props {
    date: Date;
    setDate: (d: Date) => void;
    time: Date;
    setTime: (d: Date) => void;
    location: string;
    setLocation: (s: string) => void;
    onNext: () => void;
    onBack: () => void;
    children?: React.ReactNode; // For DateTimePickers injection if needed, or we implement basic UI here
}

export const PlanDateStep2: React.FC<PlanDateStep2Props> = ({
    date,
    setDate,
    time,
    setTime,
    location,
    setLocation,
    onNext,
    onBack,
    children // Expecting DateTimePickers passed as children for simplicity with main app logic
}) => {
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                {/* Progress Indicators */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressDot} />
                    <View style={[styles.progressDot, styles.activeProgress]} />
                    <View style={styles.progressDot} />
                </View>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.screenTitle}>When & Where?</Text>

                {/* Date & Time Rendered via Children usually, or we style them here */}
                <View style={styles.section}>
                    {children}
                </View>

                {/* Location Input */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Where are we going?</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Italian Restaurant"
                        placeholderTextColor="#ccc"
                        value={location}
                        onChangeText={setLocation}
                    />
                    <View style={styles.underline} />
                </View>

                {/* Next Button */}
                <TouchableOpacity
                    style={styles.nextButton}
                    onPress={onNext}
                >
                    <Text style={styles.nextButtonText}>NEXT</Text>
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
    inputContainer: {
        marginBottom: 60,
    },
    label: {
        fontSize: 16,
        color: '#666',
        marginBottom: 10,
    },
    input: {
        fontSize: 24,
        color: '#000',
        marginBottom: 10,
    },
    underline: {
        height: 1,
        backgroundColor: '#ccc',
        width: '100%',
    },
    nextButton: {
        backgroundColor: '#A020F0',
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
});
