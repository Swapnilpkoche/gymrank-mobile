import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverHeader } from '../../src/components/discover/DiscoverHeader';
import { DiscoverSearchResults } from '../../src/components/discover/DiscoverSearchResults';
import { FilterChips, type GymFilter } from '../../src/components/discover/FilterChips';
import { GymCardRow } from '../../src/components/discover/GymCardRow';
import {
  LocationScopeToggle,
  type LocationScope,
} from '../../src/components/discover/LocationScopeToggle';
import { SearchBar } from '../../src/components/discover/SearchBar';
import { useDeviceLocation } from '../../src/hooks/useDeviceLocation';
import { fetchDiscoverGyms, searchGyms } from '../../src/lib/gyms';
import { haversineDistanceKm } from '../../src/lib/location';
import { searchProfiles } from '../../src/lib/userFollows';
import { colors } from '../../src/theme/colors';
import type { FollowedUser, GymWithDiscoverData } from '../../src/types/database';

const NEARBY_RADIUS_KM = 25;
const SEARCH_DEBOUNCE_MS = 400;

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const deviceLocation = useDeviceLocation();
  const [gyms, setGyms] = useState<GymWithDiscoverData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<LocationScope>('city');
  const [filter, setFilter] = useState<GymFilter>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GymWithDiscoverData[]>([]);
  const [memberResults, setMemberResults] = useState<FollowedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const latestSearchRef = useRef('');
  const trimmedSearchQuery = searchQuery.trim();

  const loadGyms = useCallback(async () => {
    setError(null);
    try {
      setGyms(await fetchDiscoverGyms());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gyms.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadGyms();
  }, [loadGyms]);

  useEffect(() => {
    if (!trimmedSearchQuery) {
      setSearchResults([]);
      setMemberResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const timeoutId = setTimeout(async () => {
      latestSearchRef.current = trimmedSearchQuery;
      try {
        const [gymResults, profileResults] = await Promise.all([
          searchGyms(trimmedSearchQuery),
          searchProfiles(trimmedSearchQuery),
        ]);
        // A newer keystroke may have kicked off another search while this
        // one was in flight - ignore this response if it's no longer the
        // latest, so a slow earlier result can't clobber a faster later one.
        if (latestSearchRef.current !== trimmedSearchQuery) return;
        setSearchResults(gymResults);
        setMemberResults(profileResults);
      } catch (err) {
        if (latestSearchRef.current !== trimmedSearchQuery) return;
        setSearchError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      } finally {
        if (latestSearchRef.current === trimmedSearchQuery) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [trimmedSearchQuery]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadGyms();
    setIsRefreshing(false);
  }, [loadGyms]);

  const gymsWithDistance = useMemo(() => {
    if (!deviceLocation.coords) return gyms;

    return gyms.map((gym) => {
      if (gym.latitude === null || gym.longitude === null) return gym;
      return {
        ...gym,
        distanceKm: haversineDistanceKm(deviceLocation.coords!, {
          latitude: gym.latitude,
          longitude: gym.longitude,
        }),
      };
    });
  }, [gyms, deviceLocation.coords]);

  const scopeValue =
    scope === 'city'
      ? deviceLocation.city
      : scope === 'state'
        ? deviceLocation.state
        : deviceLocation.country;

  const scopedGyms = useMemo(() => {
    if (!scopeValue) return gymsWithDistance;
    return gymsWithDistance.filter((gym) => gym[scope] === scopeValue);
  }, [gymsWithDistance, scope, scopeValue]);

  const filteredGyms = useMemo(() => {
    switch (filter) {
      case 'best_rated':
        return scopedGyms
          .filter((gym) => gym.rating !== null)
          .sort((a, b) => b.rating! - a.rating!);
      case 'best_value': {
        // "Strong rating relative to price tier", not just highest raw
        // rating: for each price tier present in the current scope, compute
        // that tier's average rating, then rank gyms by how far they
        // outperform their OWN tier's average - a budget gym rated well
        // above other budget gyms surfaces here even if its raw rating
        // trails a merely-average premium gym.
        const eligible = scopedGyms.filter((gym) => gym.rating !== null && gym.priceTier !== null);
        const tierTotals = new Map<string, { sum: number; count: number }>();
        for (const gym of eligible) {
          const existing = tierTotals.get(gym.priceTier!) ?? { sum: 0, count: 0 };
          existing.sum += gym.rating!;
          existing.count += 1;
          tierTotals.set(gym.priceTier!, existing);
        }
        return eligible
          .map((gym) => {
            const tierStats = tierTotals.get(gym.priceTier!)!;
            const tierAverage = tierStats.sum / tierStats.count;
            return { gym, valueScore: gym.rating! - tierAverage };
          })
          .sort((a, b) => b.valueScore - a.valueScore)
          .map((entry) => entry.gym);
      }
      case 'nearby':
        return scopedGyms
          .filter((gym) => gym.distanceKm !== null && gym.distanceKm <= NEARBY_RADIUS_KM)
          .sort((a, b) => a.distanceKm! - b.distanceKm!);
      case 'budget':
        return scopedGyms.filter((gym) => gym.priceTier === 'budget');
      default:
        return scopedGyms;
    }
  }, [scopedGyms, filter]);

  const sectionTitle = scopeValue ? `Gyms in ${scopeValue}` : 'Gyms';
  const locationText =
    deviceLocation.city && deviceLocation.state
      ? `${deviceLocation.city}, ${deviceLocation.state}`
      : null;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.emerald}
        />
      }
    >
      <StatusBar style="light" />
      <DiscoverHeader locationText={locationText} />
      <SearchBar value={searchQuery} onChangeText={setSearchQuery} isSearching={isSearching} />

      {trimmedSearchQuery ? (
        <View style={styles.searchResultsSection}>
          <Text style={styles.sectionTitle}>Results for "{trimmedSearchQuery}"</Text>
          {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
          <DiscoverSearchResults
            gyms={searchResults}
            members={memberResults}
            isSearching={isSearching}
          />
        </View>
      ) : (
        <>
          <LocationScopeToggle value={scope} onChange={setScope} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <GymCardRow
            title={sectionTitle}
            gyms={filteredGyms}
            emptyLabel="No gyms match this filter yet."
          />

          <FilterChips value={filter} onChange={setFilter} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 20,
  },
  searchResultsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  error: {
    color: '#f87171',
  },
});
