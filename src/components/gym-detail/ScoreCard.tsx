import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';

export function ScoreCard({
  avgRating,
  reviewCount,
}: {
  avgRating: number | null;
  reviewCount: number;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.scoreRow}>
        <Feather name="star" size={22} color={colors.emeraldLight} />
        <Text style={styles.score}>{avgRating !== null ? avgRating.toFixed(1) : '—'}</Text>
        <Text style={styles.label}>GymTrust score</Text>
      </View>
      <Text style={styles.reviewCount}>
        {reviewCount > 0 ? `${reviewCount} review${reviewCount === 1 ? '' : 's'}` : 'No reviews yet'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  score: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  label: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  reviewCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
