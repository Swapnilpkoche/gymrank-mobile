import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckInCalendar } from '../../src/components/checkin/CheckInCalendar';
import { CheckInModal } from '../../src/components/checkin/CheckInModal';
import { GymCheckInRow } from '../../src/components/checkin/GymCheckInRow';
import { CheckInSummaryCard } from '../../src/components/gym-detail/CheckInSummaryCard';
import { useAuth } from '../../src/context/auth-context';
import {
  fetchLatestValidCheckIn,
  fetchMyGyms,
  fetchOverallCheckInSummary,
  fetchRecentCheckIns,
  formatCheckInTimestamp,
  type LatestValidCheckIn,
} from '../../src/lib/checkin';
import { colors } from '../../src/theme/colors';
import type { CheckInHistoryEntry, CheckInSummary, MyGym } from '../../src/types/database';

const HISTORY_PREVIEW_LIMIT = 5;

export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const router = useRouter();

  const [myGyms, setMyGyms] = useState<MyGym[]>([]);
  // checkin_to_gym enforces once-per-day GLOBALLY - one record (or null)
  // applies to every gym in the list below; each row compares its own gymId
  // against it to tell "checked in here" apart from "checked in elsewhere".
  const [latestValidCheckIn, setLatestValidCheckIn] = useState<LatestValidCheckIn | null>(null);
  const [history, setHistory] = useState<CheckInHistoryEntry[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [summary, setSummary] = useState<CheckInSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCheckIn, setActiveCheckIn] = useState<{ gymId: number; gymName: string } | null>(null);
  const [calendarRefreshToken, setCalendarRefreshToken] = useState(0);

  const load = useCallback(async () => {
    if (!session) {
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const [gymsData, historyPage, summaryData, latestCheckIn] = await Promise.all([
        fetchMyGyms(session.user.id),
        fetchRecentCheckIns(session.user.id, HISTORY_PREVIEW_LIMIT),
        fetchOverallCheckInSummary(session.user.id),
        fetchLatestValidCheckIn(session.user.id),
      ]);
      setMyGyms(gymsData);
      setHistory(historyPage.entries);
      setHistoryTotalCount(historyPage.totalCount);
      setSummary(summaryData);
      setLatestValidCheckIn(latestCheckIn);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your check-ins.');
    }
    setIsLoading(false);
    setCalendarRefreshToken((token) => token + 1);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  if (!session) {
    return (
      <View style={styles.centered}>
        <Feather name="map-pin" size={32} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Sign in to check in</Text>
        <Text style={styles.emptyText}>
          Track your gym visits and streaks once you&apos;re signed in.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 12 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.emerald}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <Text style={styles.pageTitle}>Check In</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.sectionTitle}>Check in now</Text>
            {myGyms.length > 0 ? (
              <View style={styles.gymList}>
                {myGyms.map((gym) => (
                  <GymCheckInRow
                    key={gym.gymId}
                    gymId={gym.gymId}
                    gymName={gym.gymName}
                    latestValidCheckIn={latestValidCheckIn}
                    onCheckIn={(gymId, gymName) => setActiveCheckIn({ gymId, gymName })}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>Join a gym from Discover to check in.</Text>
                <Pressable onPress={() => router.push('/')}>
                  <Text style={styles.link}>Go to Discover</Text>
                </Pressable>
              </View>
            )}

            <Text style={[styles.sectionTitle, styles.historyTitle]}>History</Text>
            {summary ? <CheckInSummaryCard summary={summary} scope="overall" /> : null}
            <CheckInCalendar
              userId={session.user.id}
              myGyms={myGyms}
              refreshToken={calendarRefreshToken}
            />
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.historyRow}>
            <View style={styles.historyDot} />
            <View style={styles.historyRowText}>
              <Text style={styles.historyGymName}>{item.gymName}</Text>
              <Text style={styles.historyTimestamp}>{formatCheckInTimestamp(item.checkedInAt)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyHistoryText}>No check-ins yet.</Text>}
        ListFooterComponent={
          historyTotalCount > HISTORY_PREVIEW_LIMIT ? (
            <Pressable style={styles.viewAllRow} onPress={() => router.push('/check-in-history')}>
              <Text style={styles.viewAllText}>View all ({historyTotalCount})</Text>
              <Feather name="arrow-right" size={14} color={colors.emeraldLight} />
            </Pressable>
          ) : null
        }
      />

      <CheckInModal
        visible={activeCheckIn !== null}
        gymId={activeCheckIn?.gymId ?? null}
        gymName={activeCheckIn?.gymName ?? ''}
        onClose={() => setActiveCheckIn(null)}
        onSuccess={load}
      />
    </View>
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
    gap: 8,
    backgroundColor: colors.background,
    padding: 24,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerSection: {
    gap: 14,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyTitle: {
    marginTop: 4,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
  gymList: {
    gap: 10,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 24,
  },
  emptyCardText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  link: {
    color: colors.emeraldLight,
    fontWeight: '600',
    fontSize: 13,
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
  emptyHistoryText: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: 12,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  viewAllText: {
    color: colors.emeraldLight,
    fontWeight: '600',
    fontSize: 13,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
