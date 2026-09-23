import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { DateOfBirthPicker } from './DateOfBirthPicker';
import { calculateAge, dateToIsoDateString, MIN_SIGNUP_AGE } from '../../lib/dateOfBirth';
import { updateDateOfBirth } from '../../lib/profile';
import { colors, fontSize, radius, spacing } from '../../theme';

// Shown once per app session (tracked by the caller's in-memory state, not
// persisted) to existing users who signed up before date_of_birth existed.
// Skipping is allowed - it isn't a hard account block - but the prompt comes
// back every fresh session until they fill it in.
export function DobBackfillModal({
  visible,
  userId,
  onSkip,
  onSaved,
}: {
  visible: boolean;
  userId: string;
  onSkip: () => void;
  onSaved: () => void;
}) {
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (!dateOfBirth) return;

    if (calculateAge(dateOfBirth) < MIN_SIGNUP_AGE) {
      setErrorMessage(`You must be at least ${MIN_SIGNUP_AGE} years old.`);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await updateDateOfBirth(userId, dateToIsoDateString(dateOfBirth));
      if (result.kind === 'success') {
        onSaved();
      } else {
        setErrorMessage(result.message);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Feather name="calendar" size={28} color={colors.emerald} />
          <Text style={styles.title}>When's your birthday?</Text>
          <Text style={styles.body}>
            We're adding age-based features like Face of the Gym/City, so we need every member's
            date of birth. You can skip for now, but we'll ask again next time.
          </Text>

          <DateOfBirthPicker value={dateOfBirth} onChange={setDateOfBirth} disabled={isSaving} />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryButton} onPress={onSkip} disabled={isSaving}>
              <Text style={styles.secondaryButtonText}>Skip for now</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={handleSave}
              disabled={isSaving || !dateOfBirth}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    lineHeight: 19,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.base,
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
