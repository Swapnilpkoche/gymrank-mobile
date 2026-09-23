import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LatestValidCheckIn } from '../../lib/checkin';
import { useTodayCheckInState } from '../../hooks/useTodayCheckInState';
import { colors, fontSize, radius, spacing } from '../../theme';

// One row in the Check In tab's "Check in now" list. Its own component (not
// inlined in the list's .map()) so useTodayCheckInState - which ticks on a
// timer - can be called per row without breaking the rules of hooks.
//
// checkin_to_gym enforces once-per-day GLOBALLY (any valid check-in today, at
// any gym, blocks a new one) - so `latestValidCheckIn` is the same record for
// every row in the list; each row just compares its own gymId against it.
export function GymCheckInRow({
  gymId,
  gymName,
  latestValidCheckIn,
  onCheckIn,
}: {
  gymId: number;
  gymName: string;
  latestValidCheckIn: LatestValidCheckIn | null;
  onCheckIn: (gymId: number, gymName: string) => void;
}) {
  const state = useTodayCheckInState(latestValidCheckIn, gymId);

  if (state === 'here') {
    return (
      <View style={styles.gymRow}>
        <Text style={styles.gymRowName} numberOfLines={1}>
          {gymName}
        </Text>
        <View style={styles.checkedInBadge}>
          <Feather name="check" size={14} color={colors.emeraldLight} />
          <Text style={styles.checkedInBadgeText}>Checked in today</Text>
        </View>
      </View>
    );
  }

  if (state === 'elsewhere') {
    return (
      <View style={styles.gymRow}>
        <Text style={styles.gymRowName} numberOfLines={1}>
          {gymName}
        </Text>
        <View style={styles.usedElsewhereBadge}>
          <Feather name="info" size={14} color={colors.textMuted} />
          <Text style={styles.usedElsewhereBadgeText}>Checked in elsewhere today</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.gymRow}>
      <Text style={styles.gymRowName} numberOfLines={1}>
        {gymName}
      </Text>
      <Pressable style={styles.checkInButton} onPress={() => onCheckIn(gymId, gymName)}>
        <Feather name="map-pin" size={14} color={colors.white} />
        <Text style={styles.checkInButtonText}>Check In</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  gymRowName: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  checkInButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.base,
  },
  checkedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  checkedInBadgeText: {
    color: colors.emeraldLight,
    fontWeight: '700',
    fontSize: fontSize.base,
  },
  usedElsewhereBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    opacity: 0.8,
  },
  usedElsewhereBadgeText: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: fontSize.base,
  },
});
