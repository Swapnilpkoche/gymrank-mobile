import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CompareListSection } from '../../../src/components/compare/CompareListSection';
import { CompareOverallSection } from '../../../src/components/compare/CompareOverallSection';
import { CompareRow } from '../../../src/components/compare/CompareRow';
import { PRICE_TIER_SYMBOL } from '../../../src/components/discover/GymCard';
import { useDeviceLocation } from '../../../src/hooks/useDeviceLocation';
import { fetchGymCompareData, type GymCompareData } from '../../../src/lib/gymCompare';
import { formatDistanceKm, haversineDistanceKm } from '../../../src/lib/location';
import { colors, fontSize, radius, spacing } from '../../../src/theme';

function formatRating(value: number): string {
  return `${value.toFixed(1)} ★`;
}

function formatRupeesPerMonth(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}/mo`;
}

export default function CompareGymsScreen() {
  const { gymAId, gymBId } = useLocalSearchParams<{ gymAId: string; gymBId: string }>();
  const deviceLocation = useDeviceLocation();
  const router = useRouter();

  const [gymA, setGymA] = useState<GymCompareData | null>(null);
  const [gymB, setGymB] = useState<GymCompareData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setError(null);
    Promise.all([fetchGymCompareData(Number(gymAId)), fetchGymCompareData(Number(gymBId))])
      .then(([a, b]) => {
        if (!isMounted) return;
        setGymA(a);
        setGymB(b);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load these gyms.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [gymAId, gymBId]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Compare Gyms' }} />
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  if (error || !gymA || !gymB) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Compare Gyms' }} />
        <Text style={styles.error}>{error ?? 'One of these gyms could not be found.'}</Text>
      </View>
    );
  }

  // Only compute a distance when we actually have a device fix - matches
  // Discover's own gating (no permission/no fix just means the row shows
  // "Not available" rather than a stale or fabricated value).
  const distanceA =
    deviceLocation.status === 'granted' && deviceLocation.coords && gymA.summary.latitude !== null && gymA.summary.longitude !== null
      ? haversineDistanceKm(deviceLocation.coords, {
          latitude: gymA.summary.latitude,
          longitude: gymA.summary.longitude,
        })
      : null;
  const distanceB =
    deviceLocation.status === 'granted' && deviceLocation.coords && gymB.summary.latitude !== null && gymB.summary.longitude !== null
      ? haversineDistanceKm(deviceLocation.coords, {
          latitude: gymB.summary.latitude,
          longitude: gymB.summary.longitude,
        })
      : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Compare Gyms' }} />

      <View style={styles.headerRow}>
        {[gymA, gymB].map((gym) => (
          <View key={gym.summary.id} style={styles.headerCard}>
            {gym.summary.photoUrl ? (
              <Image source={{ uri: gym.summary.photoUrl }} style={styles.headerPhoto} />
            ) : (
              <View style={[styles.headerPhoto, styles.headerPhotoPlaceholder]} />
            )}
            <Text style={styles.headerName} numberOfLines={2}>
              {gym.summary.name}
            </Text>
            {gym.summary.city ? (
              <Text style={styles.headerCity} numberOfLines={1}>
                {gym.summary.city}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overall</Text>
        <CompareOverallSection
          gymA={{ rating: gymA.ratings.overall, reviewCount: gymA.ratings.reviewCount }}
          gymB={{ rating: gymB.ratings.overall, reviewCount: gymB.ratings.reviewCount }}
          onPressA={() =>
            router.push({
              pathname: '/gym/[id]',
              params: { id: String(gymA.summary.id), highlight: 'reviews' },
            })
          }
          onPressB={() =>
            router.push({
              pathname: '/gym/[id]',
              params: { id: String(gymB.summary.id), highlight: 'reviews' },
            })
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rating Breakdown</Text>
        <CompareRow label="Equipment" rawA={gymA.ratings.equipment} rawB={gymB.ratings.equipment} formatValue={formatRating} />
        <CompareRow label="Cleanliness" rawA={gymA.ratings.cleanliness} rawB={gymB.ratings.cleanliness} formatValue={formatRating} />
        <CompareRow label="Staff" rawA={gymA.ratings.staff} rawB={gymB.ratings.staff} formatValue={formatRating} />
        <CompareRow label="Crowd" rawA={gymA.ratings.crowd} rawB={gymB.ratings.crowd} formatValue={formatRating} />
        <CompareRow label="Value" rawA={gymA.ratings.value} rawB={gymB.ratings.value} formatValue={formatRating} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pricing</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Price tier</Text>
          <View style={styles.valuesRow}>
            {[gymA, gymB].map((gym) => (
              <View key={gym.summary.id} style={styles.tierBox}>
                <Text style={styles.tierText}>
                  {gym.price.priceTier ? PRICE_TIER_SYMBOL[gym.price.priceTier] : 'Not available'}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <CompareRow
          label="Starting price"
          rawA={gymA.price.lowestMonthlyEquivalent}
          rawB={gymB.price.lowestMonthlyEquivalent}
          formatValue={formatRupeesPerMonth}
          higherIsBetter={false}
        />
      </View>

      {deviceLocation.status === 'granted' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distance</Text>
          <CompareRow
            label="From your location"
            rawA={distanceA}
            rawB={distanceB}
            formatValue={formatDistanceKm}
            higherIsBetter={false}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Facilities</Text>
        <CompareListSection label="Equipment" itemsA={gymA.equipment} itemsB={gymB.equipment} />
        <CompareListSection label="Amenities" itemsA={gymA.amenities} itemsB={gymB.amenities} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  headerCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerPhoto: {
    width: '100%',
    height: 90,
    borderRadius: radius.md,
  },
  headerPhotoPlaceholder: {
    backgroundColor: colors.surfaceRaised,
  },
  headerName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  headerCity: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
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
  tierBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
