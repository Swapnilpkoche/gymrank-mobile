import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BracketMatchupCard } from '../../src/components/contests/BracketMatchupCard';
import { useAuth } from '../../src/context/auth-context';
import {
  castBracketVote,
  fetchBracketMatchupVotes,
  fetchBracketMatchups,
  fetchBracketRounds,
  fetchContestPeriod,
  fetchMyBracketVote,
  fetchNominationById,
} from '../../src/lib/contests';
import { colors } from '../../src/theme/colors';
import type { BracketMatchup, BracketRound, ContestPeriod, Nomination } from '../../src/types/database';

export default function CityBracketScreen() {
  const { contestPeriodId } = useLocalSearchParams<{ contestPeriodId: string }>();
  const id = Number(contestPeriodId);
  const { session } = useAuth();

  const [contest, setContest] = useState<ContestPeriod | null>(null);
  const [rounds, setRounds] = useState<BracketRound[]>([]);
  const [matchupsByRound, setMatchupsByRound] = useState<Map<number, BracketMatchup[]>>(new Map());
  const [revealedVotesByMatchup, setRevealedVotesByMatchup] = useState<Map<number, Map<number, number>>>(
    new Map()
  );
  const [myVoteByMatchup, setMyVoteByMatchup] = useState<Map<number, number>>(new Map());
  const [champion, setChampion] = useState<Nomination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const contestData = await fetchContestPeriod(id);
      setContest(contestData);
      if (!contestData) {
        setIsLoading(false);
        return;
      }

      const roundsData = await fetchBracketRounds(id);
      setRounds(roundsData);

      const matchupsMap = new Map<number, BracketMatchup[]>();
      for (const round of roundsData) {
        matchupsMap.set(round.id, await fetchBracketMatchups(round.id));
      }
      setMatchupsByRound(matchupsMap);

      const votesMap = new Map<number, Map<number, number>>();
      const myVoteMap = new Map<number, number>();
      for (const round of roundsData) {
        const matchups = matchupsMap.get(round.id) ?? [];
        for (const matchup of matchups) {
          if (!matchup.nomineeA || !matchup.nomineeB) continue; // bye, nothing to vote/reveal

          if (round.status === 'completed') {
            const results = await fetchBracketMatchupVotes(matchup.id);
            votesMap.set(matchup.id, new Map(results.map((r) => [r.nomineeId, r.voteCount])));
          } else if (round.status === 'voting' && session) {
            const myVote = await fetchMyBracketVote(matchup.id, session.user.id);
            if (myVote !== null) myVoteMap.set(matchup.id, myVote);
          }
        }
      }
      setRevealedVotesByMatchup(votesMap);
      setMyVoteByMatchup(myVoteMap);

      if (contestData.status === 'completed' && contestData.winnerId) {
        setChampion(await fetchNominationById(contestData.winnerId));
      } else {
        setChampion(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this bracket.');
    }
    setIsLoading(false);
  }, [id, session]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  async function handleVote(matchupId: number, nomineeId: number) {
    if (!session) return;
    const result = await castBracketVote(matchupId, nomineeId, session.user.id);
    if (result.kind === 'success') {
      setMyVoteByMatchup((prev) => new Map(prev).set(matchupId, nomineeId));
    } else {
      Alert.alert("Can't vote", result.message);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Face of the City' }} />
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  if (error || !contest) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Face of the City' }} />
        <Text style={styles.error}>{error ?? 'This bracket is not available.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.emerald} />
      }
    >
      <Stack.Screen options={{ title: 'Face of the City' }} />

      {champion ? (
        <View style={styles.championCard}>
          <Feather name="award" size={24} color={colors.emerald} />
          <Image source={{ uri: champion.primaryPhotoUrl }} style={styles.championPhoto} />
          <Text style={styles.championName}>
            {champion.fullName || champion.username || 'GymTrust member'}
          </Text>
          <Text style={styles.championLabel}>Face of the City</Text>
        </View>
      ) : null}

      {rounds.length === 0 ? (
        <Text style={styles.empty}>This bracket hasn't been populated yet.</Text>
      ) : (
        rounds.map((round) => {
          const matchups = matchupsByRound.get(round.id) ?? [];
          return (
            <View key={round.id} style={styles.section}>
              <View style={styles.roundHeaderRow}>
                <Text style={styles.sectionTitle}>Round {round.roundNumber}</Text>
                <Text style={styles.roundStatus}>
                  {round.status === 'pending'
                    ? 'Starting soon'
                    : round.status === 'voting'
                      ? 'Voting open'
                      : 'Completed'}
                </Text>
              </View>

              <View style={styles.matchupList}>
                {matchups.map((matchup) => (
                  <BracketMatchupCard
                    key={matchup.id}
                    matchup={matchup}
                    myVoteNomineeId={myVoteByMatchup.get(matchup.id) ?? null}
                    revealedVotes={revealedVotesByMatchup.get(matchup.id) ?? null}
                    canVote={!!session && round.status === 'voting'}
                    onVote={(nomineeId) => handleVote(matchup.id, nomineeId)}
                  />
                ))}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
  },
  championCard: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
  },
  championPhoto: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  championName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  championLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  section: {
    gap: 12,
  },
  roundHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  roundStatus: {
    fontSize: 12,
    color: colors.textMuted,
  },
  matchupList: {
    gap: 12,
  },
});
