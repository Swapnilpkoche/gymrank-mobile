import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  buildBookableDays,
  fetchAvailabilitySlots,
  fetchBookedSlots,
  formatSessionDate,
  formatSlotTime,
  requestTrainerSession,
  type BookableDay,
} from '../../lib/sessions';
import { colors, fontSize, radius, spacing } from '../../theme';
import type { TrainerAffiliation } from '../../types/database';

const MAX_NOTE_LENGTH = 500;

// Book a session with a trainer: pick the gym (only asked when they train at
// more than one), then a date and one of their open times, plus an optional
// note. Sends a pending request - the trainer confirms or declines. Every rule
// (adult, active trainer, real slot, 4-week window, not already booked) is
// re-checked by request_trainer_session; this only avoids offering dead ends.
export function BookSessionModal({
  visible,
  trainerId,
  trainerName,
  gyms,
  onClose,
}: {
  visible: boolean;
  trainerId: string;
  trainerName: string;
  gyms: TrainerAffiliation[];
  onClose: () => void;
}) {
  const [gymId, setGymId] = useState<number | null>(null);
  const [days, setDays] = useState<BookableDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const gym = gyms.find((g) => g.gymId === gymId) ?? null;

  useEffect(() => {
    if (!visible) return;
    setGymId(gyms.length === 1 ? gyms[0].gymId : null);
    setNote('');
    setErrorMessage(null);
  }, [visible, gyms]);

  const loadSlots = useCallback(
    async (forGymId: number) => {
      setIsLoadingSlots(true);
      setErrorMessage(null);
      setSelectedDate(null);
      setSelectedTime(null);
      try {
        const [slots, booked] = await Promise.all([
          fetchAvailabilitySlots(trainerId, forGymId),
          fetchBookedSlots(trainerId, forGymId),
        ]);
        const bookable = buildBookableDays(slots, booked);
        setDays(bookable);
        setSelectedDate(bookable[0]?.date ?? null);
      } catch (err) {
        setDays([]);
        setErrorMessage(err instanceof Error ? err.message : 'Could not load available times.');
      }
      setIsLoadingSlots(false);
    },
    [trainerId]
  );

  useEffect(() => {
    if (visible && gymId !== null) loadSlots(gymId);
  }, [visible, gymId, loadSlots]);

  const timesForDate = useMemo(
    () => days.find((day) => day.date === selectedDate)?.times ?? [],
    [days, selectedDate]
  );

  async function handleSubmit() {
    if (!gym || !selectedDate || !selectedTime) {
      setErrorMessage('Pick a date and time first.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await requestTrainerSession({
      trainerId,
      gymId: gym.gymId,
      sessionDate: selectedDate,
      startTime: selectedTime,
      note,
    });
    setIsSubmitting(false);

    if (result.kind === 'success') {
      onClose();
      Alert.alert(
        'Request sent',
        `${trainerName} will confirm or decline your session on ${formatSessionDate(selectedDate)} at ${formatSlotTime(selectedTime)}. You'll get a notification, and you can track it under Sessions on your Profile.`
      );
    } else if (result.kind === 'ineligible') {
      onClose();
      Alert.alert("Can't book", result.message);
    } else {
      setErrorMessage(result.message);
      // The slot may have just been taken - refresh what's offered.
      loadSlots(gym.gymId);
    }
  }

  const showGymPicker = gyms.length > 1 && gymId === null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Book a Session</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {gyms.length === 0 ? (
              <Text style={styles.emptyText}>
                {trainerName} isn&apos;t an active trainer at any gym right now, so there are no
                session times to book. You can still message them.
              </Text>
            ) : showGymPicker ? (
              <View style={styles.field}>
                <Text style={styles.label}>Which gym?</Text>
                {gyms.map((g) => (
                  <Pressable key={g.gymId} style={styles.gymOption} onPress={() => setGymId(g.gymId)}>
                    <Feather name="map-pin" size={16} color={colors.emerald} />
                    <View style={styles.gymOptionInfo}>
                      <Text style={styles.gymOptionName}>{g.gymName}</Text>
                      {g.location ?? g.city ? (
                        <Text style={styles.gymOptionPlace} numberOfLines={1}>
                          {g.location ?? g.city}
                        </Text>
                      ) : null}
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            ) : gym ? (
              <>
                <View style={styles.gymSummary}>
                  <Feather name="map-pin" size={14} color={colors.emeraldLight} />
                  <Text style={styles.gymSummaryText}>{gym.gymName}</Text>
                  {gyms.length > 1 ? (
                    <Pressable onPress={() => setGymId(null)} hitSlop={8}>
                      <Text style={styles.changeText}>Change</Text>
                    </Pressable>
                  ) : null}
                </View>

                {isLoadingSlots ? (
                  <ActivityIndicator color={colors.emerald} style={styles.loader} />
                ) : days.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No open session times at {gym.gymName} in the next 4 weeks. You can message{' '}
                    {trainerName} to ask about other times.
                  </Text>
                ) : (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>Date</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipRow}
                      >
                        {days.map((day) => {
                          const isSelected = day.date === selectedDate;
                          return (
                            <Pressable
                              key={day.date}
                              style={[styles.chip, isSelected && styles.chipSelected]}
                              onPress={() => {
                                setSelectedDate(day.date);
                                setSelectedTime(null);
                              }}
                            >
                              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                {formatSessionDate(day.date)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Time</Text>
                      <View style={styles.timeGrid}>
                        {timesForDate.map((time) => {
                          const isSelected = time === selectedTime;
                          return (
                            <Pressable
                              key={time}
                              style={[styles.chip, isSelected && styles.chipSelected]}
                              onPress={() => setSelectedTime(time)}
                            >
                              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                {formatSlotTime(time)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Note (optional)</Text>
                      <TextInput
                        style={[styles.input, styles.noteInput]}
                        value={note}
                        onChangeText={setNote}
                        placeholder="Goals, injuries, anything the trainer should know"
                        placeholderTextColor={colors.textMuted}
                        maxLength={MAX_NOTE_LENGTH}
                        multiline
                      />
                    </View>
                  </>
                )}
              </>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Feather name="alert-triangle" size={14} color={colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryButton} onPress={onClose} disabled={isSubmitting}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryButton,
                (!selectedDate || !selectedTime) && styles.primaryButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || !selectedDate || !selectedTime}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Send request</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '88%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xs,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textMuted,
  },
  loader: {
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    lineHeight: 19,
  },
  gymOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  gymOptionInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  gymOptionName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  gymOptionPlace: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  gymSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gymSummaryText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  changeText: {
    color: colors.emeraldLight,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  chipRow: {
    gap: spacing.sm,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipSelected: {
    backgroundColor: colors.emeraldTint,
    borderColor: colors.emerald,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.emeraldLight,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
  },
  noteInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerTint,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.danger,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
});
