import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/context/auth-context';
import { fetchCheckInHistoryPage, formatCheckInTimestamp } from '../src/lib/checkin';
import { colors } from '../src/theme/colors';
import type { CheckInHistoryEntry } from '../src/types/database';

const PAGE_SIZE = 20;

export default function CheckInHistoryScreen() {
  const { session } = useAuth();

  const [entries, setEntries] = useState<CheckInHistoryEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    if (!session) {
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const page = await fetchCheckInHistoryPage(session.user.id, 0, PAGE_SIZE);
      setEntries(page.entries);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your check-in history.');
    }
    setIsLoading(false);
  }, [session]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadInitial();
    setIsRefreshing(false);
  }, [loadInitial]);

  async function handleLoadMore() {
    if (!session || !hasMore || isLoadingMore || isLoading) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchCheckInHistoryPage(session.user.id, entries.length, PAGE_SIZE);
      setEntries((prev) => [...prev, ...page.entries]);
      setHasMore(page.hasMore);
    } catch (err) {
      // Existing entries stay put - pull-to-refresh or scrolling back into
      // view can retry rather than losing what's already loaded.
      setError(err instanceof Error ? err.message : 'Failed to load more check-ins.');
    }
    setIsLoadingMore(false);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.emerald}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={handleLoadMore}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      renderItem={({ item }) => (
        <View style={styles.historyRow}>
          <View style={styles.historyDot} />
          <View style={styles.historyRowText}>
            <Text style={styles.historyGymName}>{item.gymName}</Text>
            <Text style={styles.historyTimestamp}>{formatCheckInTimestamp(item.checkedInAt)}</Text>
          </View>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={<Text style={styles.emptyText}>No check-ins yet.</Text>}
      ListFooterComponent={
        isLoadingMore ? (
          <ActivityIndicator color={colors.emerald} style={styles.footerSpinner} />
        ) : null
      }
    />
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
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.emerald,
  },
  historyRowText: {
    flex: 1,
  },
  historyGymName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  historyTimestamp: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  separator: {
    height: 4,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: 12,
  },
  footerSpinner: {
    paddingVertical: 16,
  },
});
