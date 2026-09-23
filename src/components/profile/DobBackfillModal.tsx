import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { DateOfBirthPicker } from './DateOfBirthPicker';
import { calculateAge, dateToIsoDateString, MIN_SIGNUP_AGE } from '../../lib/dateOfBirth';
import { updateDateOfBirth } from '../../lib/profile';
import { colors } from '../../theme/colors';

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
                <ActivityIndicator color="#fff" size="small" />
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
    backgroundColor: '#000000b3',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
});
