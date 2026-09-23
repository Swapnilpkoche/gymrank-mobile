import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../context/auth-context';
import { performCheckIn, type CheckInOutcome, type CheckInPhase } from '../../lib/checkin';
import { fetchCheckInSummary } from '../../lib/gymDetail';
import { formatDistanceMeters } from '../../lib/location';
import { colors, fontSize, radius, spacing } from '../../theme';

type State =
  | { step: 'running'; phase: CheckInPhase }
  | { step: 'done'; outcome: CheckInOutcome; streakDays: number | null };

export function CheckInModal({
  visible,
  gymId,
  gymName,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  gymId: number | null;
  gymName: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { session } = useAuth();
  const [state, setState] = useState<State>({ step: 'running', phase: 'permission' });

  useEffect(() => {
    if (!visible || gymId === null) return;
    run(gymId);
    // Only re-run when the modal is (re)opened for a gym, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, gymId]);

  async function run(id: number) {
    setState({ step: 'running', phase: 'permission' });
    const outcome = await performCheckIn(id, (phase) => setState({ step: 'running', phase }));

    let streakDays: number | null = null;
    if (outcome.kind === 'success') {
      if (session) {
        try {
          streakDays = (await fetchCheckInSummary(id, session.user.id)).streakDays;
        } catch {
          streakDays = null;
        }
      }
      onSuccess?.();
    }

    setState({ step: 'done', outcome, streakDays });
  }

  function handleRetry() {
    if (gymId !== null) run(gymId);
  }

  const phaseLabel: Record<CheckInPhase, string> = {
    permission: 'Requesting location access…',
    locating: 'Getting your location…',
    submitting: 'Checking in…',
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {state.step === 'running' ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.emerald} size="large" />
              <Text style={styles.statusText}>{phaseLabel[state.phase]}</Text>
            </View>
          ) : (
            <ResultContent
              outcome={state.outcome}
              streakDays={state.streakDays}
              gymName={gymName}
              onClose={onClose}
              onRetry={handleRetry}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function ResultContent({
  outcome,
  streakDays,
  gymName,
  onClose,
  onRetry,
}: {
  outcome: CheckInOutcome;
  streakDays: number | null;
  gymName: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  if (outcome.kind === 'success') {
    return (
      <View style={styles.center}>
        <View style={styles.successIcon}>
          <Feather name="check" size={28} color={colors.white} />
        </View>
        <Text style={styles.title}>Checked in!</Text>
        <Text style={styles.gymName}>{gymName}</Text>
        <Text style={styles.message}>{outcome.message}</Text>
        <View style={styles.metaRow}>
          {outcome.distanceMeters !== null ? (
            <Text style={styles.metaText}>{formatDistanceMeters(outcome.distanceMeters)} away</Text>
          ) : null}
          {streakDays !== null ? <Text style={styles.metaText}>{streakDays} day streak</Text> : null}
        </View>
        <Pressable style={styles.primaryButton} onPress={onClose}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  if (outcome.kind === 'rejected') {
    return (
      <View style={styles.center}>
        <Feather name="x-circle" size={32} color={colors.danger} />
        <Text style={styles.title}>Check-in didn&apos;t go through</Text>
        <Text style={styles.message}>{outcome.message}</Text>
        {outcome.distanceMeters !== null ? (
          <Text style={styles.metaText}>{formatDistanceMeters(outcome.distanceMeters)} away</Text>
        ) : null}
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Close</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onRetry}>
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (outcome.kind === 'permission-denied') {
    return (
      <View style={styles.center}>
        <Feather name="map-pin" size={32} color={colors.textMuted} />
        <Text style={styles.title}>Location access needed</Text>
        <Text style={styles.message}>
          Checking in verifies you&apos;re actually at the gym, so GymTrust needs access to your
          location. Enable it in Settings to check in.
        </Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Close</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.primaryButtonText}>Open Settings</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (outcome.kind === 'location-error') {
    return (
      <View style={styles.center}>
        <Feather name="alert-triangle" size={32} color={colors.danger} />
        <Text style={styles.title}>Couldn&apos;t get your location</Text>
        <Text style={styles.message}>Make sure GPS/location services are on, then try again.</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Close</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onRetry}>
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Feather name="alert-triangle" size={32} color={colors.danger} />
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{outcome.message}</Text>
      <View style={styles.buttonRow}>
        <Pressable style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryButtonText}>Close</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={onRetry}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    </View>
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
    padding: spacing.xxl,
  },
  center: {
    alignItems: 'center',
    gap: spacing.md,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  gymName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.emeraldLight,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
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
    marginTop: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
});
