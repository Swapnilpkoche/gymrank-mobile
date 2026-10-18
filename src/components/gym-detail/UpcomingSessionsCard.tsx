import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { fetchGymUpcomingSessions, formatSessionDate, formatSlotTime } from '../../lib/sessions';
import { colors, fontSize, radius, spacing } from '../../theme';
import type { GymUpcomingSession } from '../../types/database';

const MAX_VISIBLE = 10;

// Owners/admins: read-only list of confirmed trainer sessions coming up at
// this gym, so they always know who's training whom and when. Rendered only
// for admins; get_gym_upcoming_sessions enforces that server-side regardless.
export function UpcomingSessionsCard({
  gymId,
  refreshToken,
}: {
  gymId: number;
  refreshToken?: number;
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

  const visible = sessions.slice(0, MAX_VISIBLE);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Feather name="calendar" size={18} color={colors.emerald} />
        <Text style={styles.title}>Upcoming sessions</Text>
        {sessions.length > 0 ? <Text style={styles.count}>{sessions.length}</Text> : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.emerald} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : sessions.length === 0 ? (
        <Text style={styles.empty}>
          No confirmed trainer sessions coming up. Sessions your trainers confirm show up here.
        </Text>
      ) : (
        <View style={styles.list}>
          {visible.map((session) => (
            <View key={session.id} style={styles.row}>
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
            </View>
          ))}
          {sessions.length > MAX_VISIBLE ? (
            <Text style={styles.more}>+{sessions.length - MAX_VISIBLE} more</Text>
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
  more: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
