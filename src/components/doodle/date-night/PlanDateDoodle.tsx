import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../config/theme';
import { WobblyCard } from '../index';

export interface VibeOption {
    id: string;
    label: string;
    icon: string;
}

interface PlanDateDoodleProps {
    title: string;
    setTitle: (text: string) => void;
    selectedVibe: string;
    setVibe: (id: string) => void;
    vibes: VibeOption[];
    onNext: () => void;
    onBack: () => void;
    children?: React.ReactNode;
}

export const PlanDateDoodle: React.FC<PlanDateDoodleProps> = ({
    title,
    setTitle,
    selectedVibe,
    setVibe,
    vibes,
    onNext,
    onBack,
    children
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
                    <View style={[styles.progressDot, styles.activeProgress]} />
                    <View style={styles.progressDot} />
                    <View style={styles.progressDot} />
                </View>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.screenTitle}>What's the plan?</Text>

                {/* Input */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type your idea..."
                        placeholderTextColor="#ccc"
                        value={title}
                        onChangeText={setTitle}
                        multiline
                    />
                    <View style={styles.underline} />
                </View>

                {/* Vibe Selection */}
                <Text style={styles.sectionLabel}>CHOOSE A VIBE</Text>

                <View style={styles.vibesGrid}>
                    {vibes.map((vibe) => {
                        const isSelected = selectedVibe === vibe.id;
                        return (
                            <TouchableOpacity
                                key={vibe.id}
                                style={[
                                    styles.vibeBox,
                                    isSelected && styles.selectedVibeBox
                                ]}
                                onPress={() => setVibe(vibe.id)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={vibe.icon as any}
                                    size={32}
                                    color={isSelected ? '#A020F0' : '#000'}
                                />
                                <Text style={[
                                    styles.vibeLabel,
                                    isSelected && styles.selectedVibeLabel
                                ]}>{vibe.label.toUpperCase()}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Extra Content (Date Pickers etc) */}
                {children}

                {/* Next Button */}
                <TouchableOpacity
                    style={[styles.nextButton, !title.trim() && styles.disabledButton]}
                    onPress={onNext}
                    disabled={!title.trim()}
                >
                    {/* Simulated stripes with simple transparency */}
                    <View style={styles.stripeOverlay} />
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
        width: 24, // Dash
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
        marginBottom: 60,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 60,
    },
    input: {
        fontSize: 24,
        color: '#000',
        marginBottom: 10,
        textAlign: 'center',
    },
    underline: {
        height: 1,
        backgroundColor: '#ccc',
        width: '100%',
    },
    sectionLabel: {
        fontSize: 14,
        color: '#999',
        letterSpacing: 1,
        marginBottom: 20,
        textAlign: 'center',
    },
    vibesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 40,
        gap: 12
    },
    vibeBox: {
        width: '22%',
        aspectRatio: 1,
        borderWidth: 2,
        borderColor: '#000',
        borderRadius: 12, // Slight rounded (sketchy look?) Ref seems straight lines with maybe slight wobble
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    selectedVibeBox: {
        borderColor: '#A020F0', // Purple border
        backgroundColor: '#F3E5F5', // Light purple bg
    },
    vibeLabel: {
        marginTop: 8,
        fontSize: 10,
        fontWeight: 'bold',
        color: '#000',
    },
    selectedVibeLabel: {
        color: '#A020F0',
    },
    nextButton: {
        backgroundColor: '#A020F0',
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginTop: 20,
    },
    disabledButton: {
        opacity: 0.5,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    stripeOverlay: {
        // Advanced stripe pattern not implemented without SVG
        // For now, solid purple
    }
});
