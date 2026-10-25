import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { fetchGymUpcomingSessions, formatSessionDate, formatSlotTime } from '../../lib/sessions';
import { colors, fontSize, radius, spacing } from '../../theme';
import type { GymUpcomingSession } from '../../types/database';

const MAX_VISIBLE = 10;

// Owners/admins: read-only list of trainer sessions coming up at this gym -
// confirmed ones and requests still waiting on the trainer - so they always
// know who's training whom and when. Rendered only for admins;
// get_gym_upcoming_sessions enforces that server-side regardless.
// highlightBookingId (from the owner's "Session requested / booked at your
// gym" notifications) marks that session's row, keeps it visible even past
// the first MAX_VISIBLE, and says so plainly if it's no longer upcoming.
export function UpcomingSessionsCard({
  gymId,
  refreshToken,
  highlightBookingId = null,
}: {
  gymId: number;
  refreshToken?: number;
  highlightBookingId?: number | null;
}) {
  const [sessions, setSessions] = useState<GymUpcomingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setError(null);
    fetchGymUpcomingSessions(gymId)
      .then((data) => {
        if (!isCancelled) setSessions(data);
      })
      .catch((err) => {
        if (!isCancelled) setError(err instanceof Error ? err.message : 'Could not load sessions.');
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [gymId, refreshToken]);

  const highlighted =
    highlightBookingId !== null ? sessions.find((s) => s.id === highlightBookingId) ?? null : null;
  const firstPage = sessions.slice(0, MAX_VISIBLE);
  const visible =
    highlighted && !firstPage.includes(highlighted) ? [...firstPage, highlighted] : firstPage;
  // Declined or cancelled since, or the session time has passed.
  const isHighlightGone = highlightBookingId !== null && !isLoading && !error && !highlighted;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Feather name="calendar" size={18} color={colors.emerald} />
        <Text style={styles.title}>Upcoming sessions</Text>
        {sessions.length > 0 ? <Text style={styles.count}>{sessions.length}</Text> : null}
      </View>

      {isHighlightGone ? (
        <Text style={styles.goneNote}>
          The session from your notification is no longer upcoming - it was declined or cancelled,
          or its time has passed.
        </Text>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.emerald} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : sessions.length === 0 ? (
        <Text style={styles.empty}>
          No trainer sessions coming up. New requests and the sessions your trainers confirm show
          up here.
        </Text>
      ) : (
        <View style={styles.list}>
          {visible.map((session) => (
            <View
              key={session.id}
              style={[styles.row, session.id === highlightBookingId && styles.rowHighlighted]}
            >
              <View style={styles.when}>
                <Text style={styles.whenDate}>{formatSessionDate(session.sessionDate)}</Text>
                <Text style={styles.whenTime}>{formatSlotTime(session.startTime)}</Text>
              </View>
              <View style={styles.who}>
                <Text style={styles.trainer} numberOfLines={1}>
                  {session.trainerName}
                </Text>
                <Text style={styles.requester} numberOfLines={1}>
                  with {session.requesterName}
                </Text>
              </View>
              {session.status === 'pending' ? (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>Awaiting trainer</Text>
                </View>
              ) : null}
            </View>
          ))}
          {sessions.length > visible.length ? (
            <Text style={styles.more}>+{sessions.length - visible.length} more</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  count: {
    color: colors.emeraldLight,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.base,
  },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    lineHeight: 18,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  rowHighlighted: {
    borderWidth: 1,
    borderColor: colors.emerald,
    backgroundColor: colors.emeraldTint,
  },
  goneNote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 17,
  },
  when: {
    width: 88,
    gap: spacing.xs,
  },
  whenDate: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  whenTime: {
    color: colors.emeraldLight,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  who: {
    flex: 1,
    gap: spacing.xs,
  },
  trainer: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  requester: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  pendingBadge: {
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  pendingBadgeText: {
    color: colors.warning,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  more: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
