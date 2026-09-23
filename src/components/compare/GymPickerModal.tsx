import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { SearchBar } from '../discover/SearchBar';
import { fetchGymsInSameCity } from '../../lib/gymCompare';
import { searchGyms } from '../../lib/gyms';
import { colors } from '../../theme/colors';
import type { GymWithDiscoverData } from '../../types/database';

const SEARCH_DEBOUNCE_MS = 400;

// Defaults to gyms in the same city as the gym being compared from, so the
// user isn't stuck scrolling every gym in the app - search (same search_gyms
// RPC Discover uses) takes over once they type.
export function GymPickerModal({
  visible,
  excludeGymId,
  defaultCityName,
  onClose,
  onSelect,
}: {
  visible: boolean;
  excludeGymId: number;
  defaultCityName: string | null;
  onClose: () => void;
  onSelect: (gym: GymWithDiscoverData) => void;
}) {
  const [query, setQuery] = useState('');
  const [defaultGyms, setDefaultGyms] = useState<GymWithDiscoverData[]>([]);
  const [searchResults, setSearchResults] = useState<GymWithDiscoverData[]>([]);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestSearchRef = useRef('');
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setSearchResults([]);
    setIsLoadingDefaults(true);
    setError(null);
    fetchGymsInSameCity(defaultCityName, excludeGymId)
      .then(setDefaultGyms)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load gyms.'))
      .finally(() => setIsLoadingDefaults(false));
  }, [visible, defaultCityName, excludeGymId]);

  useEffect(() => {
    if (!trimmedQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    const timeoutId = setTimeout(async () => {
      latestSearchRef.current = trimmedQuery;
      try {
        const results = await searchGyms(trimmedQuery);
        if (latestSearchRef.current !== trimmedQuery) return;
        setSearchResults(results.filter((gym) => gym.id !== excludeGymId));
      } catch (err) {
        if (latestSearchRef.current !== trimmedQuery) return;
        setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      } finally {
        if (latestSearchRef.current === trimmedQuery) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [trimmedQuery, excludeGymId]);

  const listToShow = trimmedQuery ? searchResults : defaultGyms;

  return (
    // presentationStyle="pageSheet" is what actually gives this modal iOS's
    // native swipe-down-to-dismiss gesture - the default presentation for a
    // non-transparent Modal is "fullScreen", which iOS never allows to be
    // swiped away. onDismiss catches that gesture (onRequestClose is
    // Android/tvOS-only and never fires for it) and routes it through the
    // same onClose the header's X button and Android's back button already use.
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={onClose}
    >
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Compare with...</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Feather name="x" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <SearchBar value={query} onChangeText={setQuery} isSearching={isSearching} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isLoadingDefaults && !trimmedQuery ? (
          <ActivityIndicator color={colors.emerald} style={styles.loading} />
        ) : (
          <FlatList
            data={listToShow}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable style={styles.gymRow} onPress={() => onSelect(item)}>
                <View style={styles.gymInfo}>
                  <Text style={styles.gymName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.city ? (
                    <Text style={styles.gymCity} numberOfLines={1}>
                      {item.city}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {trimmedQuery
                  ? 'No gyms match your search.'
                  : "No other gyms found in this city yet - try searching."}
              </Text>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
  loading: {
    marginTop: 24,
  },
  listContent: {
    paddingBottom: 24,
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  gymInfo: {
    flex: 1,
  },
  gymName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  gymCity: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  separator: {
    height: 8,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
  },
});
