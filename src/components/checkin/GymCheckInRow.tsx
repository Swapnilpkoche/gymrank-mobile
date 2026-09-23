import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LatestValidCheckIn } from '../../lib/checkin';
import { useTodayCheckInState } from '../../hooks/useTodayCheckInState';
import { colors } from '../../theme/colors';

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
        <Feather name="map-pin" size={14} color="#fff" />
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
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  gymRowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.emerald,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  checkInButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  checkedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  checkedInBadgeText: {
    color: colors.emeraldLight,
    fontWeight: '700',
    fontSize: 13,
  },
  usedElsewhereBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    opacity: 0.8,
  },
  usedElsewhereBadgeText: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
});
