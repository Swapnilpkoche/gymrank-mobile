import { Feather } from '@expo/vector-icons';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { formatDistanceKm } from '../../lib/location';
import { colors, fontSize, radius } from '../../theme';
import type { GymWithDiscoverData } from '../../types/database';
import { spacing } from '../../theme';

export const GYM_CARD_WIDTH = 200;

export const PRICE_TIER_SYMBOL: Record<NonNullable<GymWithDiscoverData['priceTier']>, string> = {
  budget: '₹',
  mid: '₹₹',
  premium: '₹₹₹',
};

// style overrides the fixed swipe-row width for callers like the Discover
// search results column, which need the same card at a flexible width.
export function GymCard({
  gym,
  style,
}: {
  gym: GymWithDiscoverData;
  style?: StyleProp<ViewStyle>;
}) {
  const subtitleParts = [
    gym.distanceKm !== null ? formatDistanceKm(gym.distanceKm) : null,
    gym.memberCount !== null && gym.memberCount > 0 ? `${gym.memberCount} members` : null,
  ].filter((part): part is string => part !== null);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.photoWrapper}>
        {gym.photoUrl ? (
          <Image source={{ uri: gym.photoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Feather name="image" size={28} color={colors.textMuted} />
          </View>
        )}

        {gym.rating !== null ? (
          <View style={styles.ratingBadge}>
            <Feather name="star" size={11} color={colors.textOnAccent} />
            <Text style={styles.ratingText}>{gym.rating.toFixed(1)}</Text>
          </View>
        ) : null}

        {gym.priceTier ? (
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>{PRICE_TIER_SYMBOL[gym.priceTier]}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {gym.name}
      </Text>
      {subtitleParts.length > 0 ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitleParts.join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: GYM_CARD_WIDTH,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    paddingBottom: spacing.md,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 110,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.emeraldLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  ratingText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textOnAccent,
  },
  priceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: colors.scrimLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  priceText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.white,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginHorizontal: spacing.md,
  },
});
