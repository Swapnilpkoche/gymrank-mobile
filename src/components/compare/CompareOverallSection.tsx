import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';

type OverallStats = { rating: number | null; reviewCount: number };

// Combines the average-rating and review-count rows into one tappable block
// per gym - tapping either side jumps to that gym's own Reviews section so
// the numbers here aren't a dead end.
export function CompareOverallSection({
  gymA,
  gymB,
  onPressA,
  onPressB,
}: {
  gymA: OverallStats;
  gymB: OverallStats;
  onPressA: () => void;
  onPressB: () => void;
}) {
  const aWins = gymA.rating !== null && gymB.rating !== null && gymA.rating > gymB.rating;
  const bWins = gymA.rating !== null && gymB.rating !== null && gymB.rating > gymA.rating;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Average rating · tap to read reviews</Text>
      <View style={styles.valuesRow}>
        <Pressable style={[styles.card, aWins && styles.cardWinner]} onPress={onPressA}>
          <Text style={[styles.ratingText, aWins && styles.ratingTextWinner]}>
            {gymA.rating !== null ? `${gymA.rating.toFixed(1)} ★` : 'Not available'}
          </Text>
          <Text style={styles.reviewCountText}>
            {gymA.reviewCount} review{gymA.reviewCount === 1 ? '' : 's'}
          </Text>
        </Pressable>
        <Pressable style={[styles.card, bWins && styles.cardWinner]} onPress={onPressB}>
          <Text style={[styles.ratingText, bWins && styles.ratingTextWinner]}>
            {gymB.rating !== null ? `${gymB.rating.toFixed(1)} ★` : 'Not available'}
          </Text>
          <Text style={styles.reviewCountText}>
            {gymB.reviewCount} review{gymB.reviewCount === 1 ? '' : 's'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  valuesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardWinner: {
    backgroundColor: colors.emeraldTint,
    borderColor: colors.emerald,
  },
  ratingText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  ratingTextWinner: {
    color: colors.emeraldLight,
    fontWeight: '700',
  },
  reviewCountText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
