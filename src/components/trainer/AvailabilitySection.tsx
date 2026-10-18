import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  DAY_NAMES,
  DAY_SHORT,
  addAvailabilitySlot,
  fetchAvailabilitySlots,
  formatSlotTime,
  removeAvailabilitySlot,
} from '../../lib/sessions';
import { colors, fontSize, radius, spacing } from '../../theme';
import type { AvailabilitySlot, TrainerAffiliation } from '../../types/database';

// Half-hour start times from 5:00 AM to 10:00 PM.
const TIME_OPTIONS: string[] = Array.from({ length: 35 }, (_, i) => {
  const minutes = 5 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

// Monday-first, which reads more naturally for a weekly schedule.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// The trainer's own weekly session times, per gym they're an active trainer
// at. RLS only lets them add/remove slots at those gyms; slots at a gym they've
// since left aren't shown to anyone else, so they're not listed here either.
export function AvailabilitySection({
  trainerId,
  gyms,
}: {
  trainerId: string;
  gyms: TrainerAffiliation[];
}) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [gymId, setGymId] = useState<number | null>(gyms[0]?.gymId ?? null);
  const [day, setDay] = useState<number>(1);
  const [time, setTime] = useState<string>('07:00');
  const [error, setError] = useState<string | null>(null);

  const activeGymIds = new Set(gyms.map((g) => g.gymId));

  const load = useCallback(async () => {
    try {
      setSlots(await fetchAvailabilitySlots(trainerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your availability.');
    }
    setIsLoading(false);
  }, [trainerId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (gymId === null || !gyms.some((g) => g.gymId === gymId)) {
      setGymId(gyms[0]?.gymId ?? null);
    }
  }, [gyms, gymId]);

  async function handleAdd() {
    if (gymId === null) return;
    setIsSaving(true);
    setError(null);
    const result = await addAvailabilitySlot({ trainerId, gymId, dayOfWeek: day, startTime: time });
    setIsSaving(false);
    if (result.kind === 'error') {
      setError(result.message);
      return;
    }
    setIsAdding(false);
    await load();
  }

  function handleRemove(slot: AvailabilitySlot, gymName: string) {
    Alert.alert(
      'Remove slot',
      `Remove ${DAY_NAMES[slot.dayOfWeek]} ${formatSlotTime(slot.startTime)} at ${gymName}? Sessions already requested or confirmed aren't affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeAvailabilitySlot(slot.id);
            if (result.kind === 'error') {
              Alert.alert("Couldn't remove", result.message);
              return;
            }
            setSlots((prev) => prev.filter((s) => s.id !== slot.id));
          },
        },
      ]
    );
  }

  const visibleSlots = slots.filter((slot) => activeGymIds.has(slot.gymId));

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Weekly availability</Text>
        {gyms.length > 0 && !isAdding ? (
          <Pressable style={styles.addButton} onPress={() => setIsAdding(true)} hitSlop={8}>
            <Feather name="plus" size={14} color={colors.emerald} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        ) : null}
      </View>

      {gyms.length === 0 ? (
        <Text style={styles.empty}>
          Once a gym accepts you as a trainer, you can set weekly session times here so members can
          book you.
        </Text>
      ) : isLoading ? (
        <ActivityIndicator color={colors.emerald} />
      ) : (
        <>
          {isAdding ? (
            <View style={styles.form}>
              {gyms.length > 1 ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Gym</Text>
                  <View style={styles.wrapRow}>
                    {gyms.map((g) => (
                      <Pressable
                        key={g.gymId}
                        style={[styles.chip, gymId === g.gymId && styles.chipSelected]}
                        onPress={() => setGymId(g.gymId)}
                      >
                        <Text style={[styles.chipText, gymId === g.gymId && styles.chipTextSelected]}>
                          {g.gymName}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.label}>Day</Text>
                <View style={styles.wrapRow}>
                  {DAY_ORDER.map((d) => (
                    <Pressable
                      key={d}
                      style={[styles.chip, day === d && styles.chipSelected]}
                      onPress={() => setDay(d)}
                    >
                      <Text style={[styles.chipText, day === d && styles.chipTextSelected]}>
                        {DAY_SHORT[d]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Start time</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.scrollRow}
                >
                  {TIME_OPTIONS.map((t) => (
                    <Pressable
                      key={t}
                      style={[styles.chip, time === t && styles.chipSelected]}
                      onPress={() => setTime(t)}
                    >
                      <Text style={[styles.chipText, time === t && styles.chipTextSelected]}>
                        {formatSlotTime(t)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.formButtons}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    setIsAdding(false);
                    setError(null);
                  }}
                  disabled={isSaving}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={handleAdd} disabled={isSaving}>
                  {isSaving ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Add slot</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {gyms.map((g) => {
            const gymSlots = visibleSlots
              .filter((slot) => slot.gymId === g.gymId)
              .sort(
                (a, b) =>
                  DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek) ||
                  a.startTime.localeCompare(b.startTime)
              );
            return (
              <View key={g.gymId} style={styles.gymBlock}>
                {gyms.length > 1 ? <Text style={styles.gymName}>{g.gymName}</Text> : null}
                {gymSlots.length === 0 ? (
                  <Text style={styles.empty}>
                    No session times yet{gyms.length > 1 ? '' : ` at ${g.gymName}`}. Add some so
                    members can book you.
                  </Text>
                ) : (
                  gymSlots.map((slot) => (
                    <View key={slot.id} style={styles.slotRow}>
                      <Feather name="clock" size={14} color={colors.emeraldLight} />
                      <Text style={styles.slotText}>
                        {DAY_NAMES[slot.dayOfWeek]} · {formatSlotTime(slot.startTime)}
                      </Text>
                      <Pressable
                        onPress={() => handleRemove(slot, g.gymName)}
                        hitSlop={10}
                        accessibilityLabel={`Remove ${DAY_NAMES[slot.dayOfWeek]} ${formatSlotTime(slot.startTime)}`}
                      >
                        <Feather name="trash-2" size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  addButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  empty: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    lineHeight: 18,
  },
  error: {
    fontSize: fontSize.base,
    color: colors.danger,
  },
  form: {
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textMuted,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  scrollRow: {
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
  formButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  secondaryButton: {
    flex: 1,
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
  gymBlock: {
    gap: spacing.sm,
  },
  gymName: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  slotText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
