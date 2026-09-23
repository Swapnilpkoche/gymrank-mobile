import { StyleSheet, Text, View } from 'react-native';

import { getCurrentHourInTimeZone } from '../../lib/time';
import { colors } from '../../theme/colors';
import type { BusyHour } from '../../types/database';

const GYM_TIMEZONE = 'Asia/Kolkata';
const CHART_HEIGHT = 80;

type BusyLevel = 'Busy now' | 'Moderate' | 'Quiet';

function getBusyLevel(currentHourCount: number, peakCount: number): BusyLevel {
  if (peakCount === 0) return 'Quiet';
  const ratio = currentHourCount / peakCount;
  if (ratio >= 0.7) return 'Busy now';
  if (ratio >= 0.3) return 'Moderate';
  return 'Quiet';
}

const LEVEL_COLOR: Record<BusyLevel, string> = {
  'Busy now': '#f87171',
  Moderate: '#facc15',
  Quiet: colors.emeraldLight,
};

export function BusyHoursChart({ hours }: { hours: BusyHour[] }) {
  const currentHour = getCurrentHourInTimeZone(GYM_TIMEZONE);
  const peakCount = Math.max(0, ...hours.map((h) => h.count));
  const currentHourCount = hours[currentHour]?.count ?? 0;
  const level = getBusyLevel(currentHourCount, peakCount);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Busy hours today</Text>
        <View style={[styles.badge, { backgroundColor: LEVEL_COLOR[level] }]}>
          <Text style={styles.badgeText}>{level}</Text>
        </View>
      </View>

      <View style={styles.chart}>
        {hours.map(({ hour, count }) => {
          const barHeight = peakCount > 0 ? Math.max(2, (count / peakCount) * CHART_HEIGHT) : 2;
          return (
            <View key={hour} style={styles.barColumn}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: hour === currentHour ? colors.emerald : colors.border,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>12am</Text>
        <Text style={styles.axisLabel}>12pm</Text>
        <Text style={styles.axisLabel}>11pm</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#020617',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    gap: 2,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: CHART_HEIGHT,
  },
  bar: {
    width: '100%',
    borderRadius: 2,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  axisLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
