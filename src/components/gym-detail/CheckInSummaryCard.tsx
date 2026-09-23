import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { CheckInSummary } from '../../types/database';

// 'overall' = across every gym (Check In tab, Profile); 'gym' = only the gym
// whose page is showing it. The caller decides which summary it passes in.
const SCOPE_LABELS = {
  overall: 'Across all gyms',
  gym: 'At this gym',
} as const;

export function CheckInSummaryCard({
  summary,
  scope,
}: {
  summary: CheckInSummary;
  scope: keyof typeof SCOPE_LABELS;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.scope}>{SCOPE_LABELS[scope]}</Text>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Feather name="zap" size={18} color={colors.emeraldLight} />
          <Text style={styles.value}>{summary.streakDays}</Text>
          <Text style={styles.label}>day streak</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Feather name="calendar" size={18} color={colors.emeraldLight} />
          <Text style={styles.value}>{summary.totalDaysLogged}</Text>
          <Text style={styles.label}>days logged</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  scope: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
