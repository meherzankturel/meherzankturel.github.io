import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Animated, Pressable, Keyboard, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EmojiSelector from 'react-native-emoji-selector';
import { theme } from '../config/theme';
import { MoodType, MoodCause, MOOD_CAUSES } from '../services/mood.service';
import * as Haptics from 'expo-haptics';

// Map to MoodType from service - Using harmonized Cozy Cloud Love palette
const MOODS: Array<{ type: MoodType; emoji: string; label: string; color: string }> = [
  { type: 'loved', emoji: '💕', label: 'Loved', color: theme.colors.accentPink },
  { type: 'happy', emoji: '😊', label: 'Happy', color: theme.colors.moodHappy },
  { type: 'excited', emoji: '🤩', label: 'Excited', color: theme.colors.moodExcited },
  { type: 'grateful', emoji: '🙏', label: 'Grateful', color: theme.colors.moodGrateful },
  { type: 'calm', emoji: '😌', label: 'Calm', color: theme.colors.moodCalm },
  { type: 'neutral', emoji: '😐', label: 'Meh', color: theme.colors.moodNeutral },
  { type: 'sad', emoji: '😢', label: 'Sad', color: theme.colors.moodSad },
  { type: 'anxious', emoji: '😰', label: 'Anxious', color: theme.colors.moodAnxious },
];

interface MoodSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (mood: MoodType, note?: string, cause?: MoodCause, customEmoji?: string) => void;
  loading?: boolean;
  partnerName?: string;
}

export default function MoodSelector({ visible, onClose, onSubmit, loading = false, partnerName = 'your partner' }: MoodSelectorProps) {
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [selectedCause, setSelectedCause] = useState<MoodCause | null>(null);
  const [note, setNote] = useState('');
  const [scaleAnim] = useState(new Animated.Value(0));
  const [step, setStep] = useState<'mood' | 'cause' | 'emoji'>('mood');
  const [customEmoji, setCustomEmoji] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setSelectedMood(null);
      setSelectedCause(null);
      setNote('');
      setCustomEmoji(null);
      setShowEmojiPicker(false);
      setStep('mood');
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  const handleMoodSelect = (mood: MoodType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMood(mood);
    // Auto-advance to cause selection
    setTimeout(() => setStep('cause'), 200);
  };

  const handleCauseSelect = (cause: MoodCause) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCause(selectedCause === cause ? null : cause);
  };

  const handleSubmit = () => {
    if (!selectedMood) return;

    Keyboard.dismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit(selectedMood, note.trim() || undefined, selectedCause || undefined, customEmoji || undefined);
  };

  const handleEmojiSelect = (emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomEmoji(emoji);
    setShowEmojiPicker(false);
  };

  const handleOverlayPress = () => {
    Keyboard.dismiss();
    onClose();
  };

  const getMoodColor = () => {
    if (!selectedMood) return theme.colors.primary;
    return MOODS.find(m => m.type === selectedMood)?.color || theme.colors.primary;
  };

  const getMoodEmoji = () => {
    if (!selectedMood) return '💭';
    return MOODS.find(m => m.type === selectedMood)?.emoji || '💭';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        Keyboard.dismiss();
        onClose();
      }}
    >
      <Pressable style={styles.overlay} onPress={handleOverlayPress}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ scale: scaleAnim }],
                opacity: scaleAnim,
              },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {/* Header with mood indicator */}
                <View style={styles.header}>
                  <View style={styles.headerLeft}>
                    {selectedMood && step === 'cause' && (
                      <TouchableOpacity
                        onPress={() => setStep('mood')}
                        style={styles.backButton}
                      >
                        <Ionicons name="chevron-back" size={24} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <Text style={styles.title}>
                      {step === 'mood' ? 'How are you feeling?' : 'Share your mood'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      onClose();
                    }}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Selected mood indicator */}
                {selectedMood && step === 'cause' && (
                  <View style={[styles.selectedMoodBanner, { backgroundColor: getMoodColor() + '15' }]}>
                    <Text style={styles.selectedMoodEmoji}>{getMoodEmoji()}</Text>
                    <Text style={[styles.selectedMoodText, { color: getMoodColor() }]}>
                      Feeling {MOODS.find(m => m.type === selectedMood)?.label}
                    </Text>
                  </View>
                )}

                <View style={styles.content}>
                  {step === 'mood' ? (
                    /* Mood Selection Grid */
                    <View style={styles.grid}>
                      {MOODS.map((mood) => {
                        const isSelected = selectedMood === mood.type;
                        return (
                          <TouchableOpacity
                            key={mood.type}
                            style={[
                              styles.moodButton,
                              isSelected && { backgroundColor: mood.color + '20', borderColor: mood.color },
                              loading && styles.disabledButton,
                            ]}
                            onPress={() => handleMoodSelect(mood.type)}
                            disabled={loading}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.emoji, isSelected && styles.emojiSelected]}>{mood.emoji}</Text>
                            <Text style={[styles.label, isSelected && { color: mood.color, fontWeight: '700' }]}>
                              {mood.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    /* Optional details */
                    <View style={styles.causeSection}>
                      {/* Note input only */}
                      <View style={styles.noteSection}>
                        <Text style={styles.noteLabel}>💭 Want to share more?</Text>
                        <TextInput
                          style={styles.noteInput}
                          placeholder={`Tell ${partnerName} what's on your mind...`}
                          placeholderTextColor={theme.colors.textLight}
                          value={note}
                          onChangeText={setNote}
                          multiline
                          numberOfLines={3}
                          maxLength={200}
                        />
                        {note.length > 0 && (
                          <Text style={styles.charCount}>{note.length}/200</Text>
                        )}
                      </View>

                      {/* Custom Emoji Picker Button */}
                      <TouchableOpacity
                        style={styles.customEmojiButton}
                        onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                      >
                        <Ionicons
                          name={customEmoji ? "happy" : "happy-outline"}
                          size={20}
                          color={theme.colors.primary}
                        />
                        <Text style={styles.customEmojiText}>
                          {customEmoji ? `Custom: ${customEmoji}` : 'Pick Custom Emoji'}
                        </Text>
                      </TouchableOpacity>

                      {/* Emoji Picker */}
                      {showEmojiPicker && (
                        <View style={styles.emojiPickerContainer}>
                          <EmojiSelector
                            onEmojiSelected={handleEmojiSelect}
                            showSearchBar={false}
                            showTabs={true}
                            showHistory={false}
                            columns={8}
                          />
                        </View>
                      )}

                      {/* Submit button */}
                      <TouchableOpacity
                        style={[
                          styles.submitButton,
                          { backgroundColor: getMoodColor() },
                          loading && styles.submitButtonDisabled,
                        ]}
                        onPress={handleSubmit}
                        disabled={loading}
                      >
                        <Text style={styles.submitButtonText}>
                          {loading ? 'Sharing with love...' : '💕 Share with Partner'}
                        </Text>
                      </TouchableOpacity>

                    </View>
                  )}
                </View>
              </ScrollView>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Overlay - Softer, dreamier
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  keyboardAvoid: {
    width: '100%',
    maxWidth: 420,
  },
  scrollContent: {
    flexGrow: 1,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius['2xl'],
    width: '100%',
    maxWidth: 420,
    ...theme.shadows.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: theme.spacing.xs,
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  selectedMoodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  selectedMoodEmoji: {
    fontSize: 24,
  },
  selectedMoodText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    paddingBottom: theme.spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    gap: 8,
  },
  moodButton: {
    width: '23%',
    aspectRatio: 0.85,
    backgroundColor: theme.colors.surfaceSoft,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm,
  },
  disabledButton: {
    opacity: 0.5,
  },
  emoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  emojiSelected: {
    fontSize: 32,
  },
  label: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  causeSection: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  causeHint: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  causeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  causeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    gap: 4,
  },
  causeEmoji: {
    fontSize: 16,
  },
  causeLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  noteSection: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  noteInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.text,
    minHeight: 70,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  charCount: {
    fontSize: 11,
    color: theme.colors.textLight,
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    borderRadius: theme.borderRadius.xl,
    paddingVertical: 16,
    paddingHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.lifted,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  customEmojiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary + '40',
    backgroundColor: theme.colors.primary + '10',
  },
  customEmojiText: {
    marginLeft: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  emojiPickerContainer: {
    height: 300,
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
});
