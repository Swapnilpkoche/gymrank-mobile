import { Feather } from '@expo/vector-icons';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { formatDistanceKm } from '../../lib/location';
import { colors } from '../../theme/colors';
import type { GymWithDiscoverData } from '../../types/database';

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
            <Feather name="star" size={11} color="#020617" />
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
    borderRadius: 16,
    overflow: 'hidden',
    paddingBottom: 12,
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
    backgroundColor: '#1e293b',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.emeraldLight,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#020617',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#00000099',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  priceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 10,
    marginHorizontal: 12,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
    marginHorizontal: 12,
  },
});
