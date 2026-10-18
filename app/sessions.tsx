import { Feather } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GuestAuthButtons } from '../src/components/auth/GuestAuthButtons';
import { useAuth } from '../src/context/auth-context';
import {
  cancelTrainerSession,
  fetchMySessions,
  formatSessionDate,
  formatSlotTime,
  isUpcoming,
  respondTrainerSession,
} from '../src/lib/sessions';
import { fetchTrainerAffiliations } from '../src/lib/trainer';
import { colors, fontSize, radius, spacing } from '../src/theme';
import type { SessionBooking, SessionBookingStatus } from '../src/types/database';

const STATUS_LABEL: Record<SessionBookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

// Both sides of trainer session booking in one place:
//   - as a trainer: pending requests (Confirm / Decline) and upcoming
//     confirmed sessions;
//   - as a member: your own requests and bookings, cancellable while open.
// The RPCs enforce who can do what; this screen only offers the valid actions.
export default function SessionsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<SessionBooking[]>([]);
  const [isTrainerAnywhere, setIsTrainerAnywhere] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!session) {
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const [sessionData, affiliations] = await Promise.all([
        fetchMySessions(),
        fetchTrainerAffiliations(session.user.id).catch(() => []),
      ]);
      setBookings(sessionData);
      setIsTrainerAnywhere(affiliations.length > 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your sessions.');
    }
    setIsLoading(false);
    hasLoadedRef.current = true;
  }, [session]);

  // A request can be answered from another device (or arrive) while this
  // screen is in the background, so re-read on every focus.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  async function runAction(
    booking: SessionBooking,
    action: () => Promise<{ kind: string; message?: string }>
  ) {
    setBusyId(booking.id);
    const result = await action();
    setBusyId(null);
    if (result.kind !== 'success') {
      Alert.alert('Something went wrong', result.message ?? 'Please try again.');
    }
    await load();
  }

  function handleConfirm(booking: SessionBooking) {
    runAction(booking, () => respondTrainerSession(booking.id, 'confirmed'));
  }

  function handleDecline(booking: SessionBooking) {
    Alert.alert(
      'Decline request',
      `Decline ${booking.otherName}'s session on ${formatSessionDate(booking.sessionDate)} at ${formatSlotTime(booking.startTime)}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => runAction(booking, () => respondTrainerSession(booking.id, 'declined')),
        },
      ]
    );
  }

  function handleCancel(booking: SessionBooking) {
    const what = booking.status === 'pending' ? 'this session request' : 'this session';
    Alert.alert(
      booking.status === 'pending' ? 'Cancel request' : 'Cancel session',
      `Cancel ${what} on ${formatSessionDate(booking.sessionDate)} at ${formatSlotTime(booking.startTime)}? ${booking.otherName} will be notified.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel it',
          style: 'destructive',
          onPress: () => runAction(booking, () => cancelTrainerSession(booking.id)),
        },
      ]
    );
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Sessions' }} />
        <Text style={styles.emptyText}>Sign in to see your trainer sessions.</Text>
        <GuestAuthButtons style={styles.authButtons} />
      </View>
    );
  }

  if (isLoading && !hasLoadedRef.current) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Sessions' }} />
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  const upcoming = bookings.filter((b) => isUpcoming(b.sessionDate, b.startTime));
  const trainerRequests = upcoming.filter((b) => b.isTrainer && b.status === 'pending');
  const trainerUpcoming = upcoming.filter((b) => b.isTrainer && b.status === 'confirmed');
  const myOpen = upcoming.filter(
    (b) => !b.isTrainer && (b.status === 'pending' || b.status === 'confirmed')
  );
  // Closed or already-happened bookings you made, most recent first.
  const myPast = bookings
    .filter((b) => !b.isTrainer && !myOpen.includes(b))
    .slice()
    .reverse();
  const showTrainerSections = isTrainerAnywhere || bookings.some((b) => b.isTrainer);

  function renderRow(booking: SessionBooking, actions: ReactNode) {
    const isBusy = busyId === booking.id;
    return (
      <View key={booking.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.when}>
            <Text style={styles.whenDate}>{formatSessionDate(booking.sessionDate)}</Text>
            <Text style={styles.whenTime}>{formatSlotTime(booking.startTime)}</Text>
          </View>
          <View style={[styles.statusPill, statusPillStyle(booking.status)]}>
            <Text style={[styles.statusText, statusTextStyle(booking.status)]}>
              {STATUS_LABEL[booking.status]}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.personRow}
          onPress={() =>
            booking.isTrainer
              ? router.push({ pathname: '/user/[id]', params: { id: booking.otherUserId } })
              : router.push({ pathname: '/trainer/[id]', params: { id: booking.otherUserId } })
          }
        >
          <Feather name={booking.isTrainer ? 'user' : 'award'} size={14} color={colors.textMuted} />
          <Text style={styles.personText} numberOfLines={1}>
            {booking.isTrainer ? booking.otherName : `with ${booking.otherName}`}
          </Text>
        </Pressable>
        <Pressable
          style={styles.personRow}
          onPress={() => router.push({ pathname: '/gym/[id]', params: { id: String(booking.gymId) } })}
        >
          <Feather name="map-pin" size={14} color={colors.textMuted} />
          <Text style={styles.personText} numberOfLines={1}>
            {booking.gymName}
          </Text>
        </Pressable>

        {booking.note ? <Text style={styles.note}>“{booking.note}”</Text> : null}

        {actions ? (
          <View style={styles.actions}>
            {isBusy ? <ActivityIndicator color={colors.emerald} /> : actions}
          </View>
        ) : null}
      </View>
    );
  }

  const cancelButton = (booking: SessionBooking) => (
    <Pressable style={styles.dangerButton} onPress={() => handleCancel(booking)}>
      <Text style={styles.dangerButtonText}>
        {booking.status === 'pending' ? 'Cancel request' : 'Cancel session'}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.emerald} />
      }
    >
      <Stack.Screen options={{ title: 'Sessions' }} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {showTrainerSections ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session requests</Text>
            {trainerRequests.length === 0 ? (
              <Text style={styles.emptyText}>No requests waiting for you.</Text>
            ) : (
              trainerRequests.map((booking) =>
                renderRow(
                  booking,
                  <>
                    <Pressable style={styles.outlineButton} onPress={() => handleDecline(booking)}>
                      <Text style={styles.outlineButtonText}>Decline</Text>
                    </Pressable>
                    <Pressable style={styles.primaryButton} onPress={() => handleConfirm(booking)}>
                      <Text style={styles.primaryButtonText}>Confirm</Text>
                    </Pressable>
                  </>
                )
              )
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming sessions</Text>
            {trainerUpcoming.length === 0 ? (
              <Text style={styles.emptyText}>No confirmed sessions coming up.</Text>
            ) : (
              trainerUpcoming.map((booking) => renderRow(booking, cancelButton(booking)))
            )}
          </View>
        </>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your bookings</Text>
        {myOpen.length === 0 ? (
          <Text style={styles.emptyText}>
            You haven&apos;t booked any upcoming sessions. Open a trainer&apos;s profile and tap
            Book a Session.
          </Text>
        ) : (
          myOpen.map((booking) => renderRow(booking, cancelButton(booking)))
        )}
      </View>

      {myPast.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past & closed</Text>
          {myPast.map((booking) => renderRow(booking, null))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function statusPillStyle(status: SessionBookingStatus) {
  if (status === 'confirmed') return styles.pillConfirmed;
  if (status === 'pending') return styles.pillPending;
  return styles.pillClosed;
}

function statusTextStyle(status: SessionBookingStatus) {
  if (status === 'confirmed') return styles.statusTextConfirmed;
  if (status === 'pending') return styles.statusTextPending;
  return styles.statusTextClosed;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  authButtons: {
    marginTop: spacing.md,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.base,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    lineHeight: 19,
  },
  card: {
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  when: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  whenDate: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  whenTime: {
    color: colors.emeraldLight,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  pillConfirmed: {
    backgroundColor: colors.emeraldTint,
    borderColor: colors.emerald,
  },
  pillPending: {
    backgroundColor: colors.warningTint,
    borderColor: colors.warningBorder,
  },
  pillClosed: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  statusTextConfirmed: {
    color: colors.emeraldLight,
  },
  statusTextPending: {
    color: colors.warning,
  },
  statusTextClosed: {
    color: colors.textMuted,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
  },
  note: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  primaryButton: {
    backgroundColor: colors.emerald,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  outlineButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  dangerButtonText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: fontSize.base,
  },
});
