import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProfileNavigation } from '../../hooks/useProfileNavigation';
import { colors, fontSize, radius, spacing } from '../../theme';
import type { GymReview } from '../../types/database';

export function ReviewsList({ reviews }: { reviews: GymReview[] }) {
  const goToProfile = useProfileNavigation();

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Reviews</Text>

      {reviews.length === 0 ? (
        <Text style={styles.empty}>No reviews yet.</Text>
      ) : (
        <View style={styles.list}>
          {reviews.map((review) => (
            <View key={review.id} style={styles.card}>
              <View style={styles.headerRow}>
                <Pressable onPress={() => goToProfile(review.userId)} hitSlop={4}>
                  <Text style={styles.reviewerName}>{review.reviewerName}</Text>
                </Pressable>
                <View style={styles.ratingRow}>
                  <Feather name="star" size={13} color={colors.emeraldLight} />
                  <Text style={styles.ratingText}>{review.rating.toFixed(1)}</Text>
                </View>
              </View>

              {review.isVerifiedVisit ? (
                <Text style={styles.verifiedBadge}>Verified visit</Text>
              ) : null}

              {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
              {review.reviewText ? <Text style={styles.reviewText}>{review.reviewText}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.base,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewerName: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: fontSize.base,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  verifiedBadge: {
    color: colors.emeraldLight,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  reviewTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  reviewText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    lineHeight: 18,
  },
});
