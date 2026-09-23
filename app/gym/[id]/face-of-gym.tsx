import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NominationForm } from '../../../src/components/contests/NominationForm';
import { NomineeVoteCard } from '../../../src/components/contests/NomineeVoteCard';
import { useAuth } from '../../../src/context/auth-context';
import { confirmDelete } from '../../../src/lib/confirmations';
import {
  castVote,
  fetchCityContestIdForGym,
  fetchContestResults,
  fetchCurrentContestForGym,
  fetchMyNomination,
  fetchMyVoteNomineeId,
  fetchNominations,
  submitNomination,
  withdrawNomination,
  type ContestResultEntry,
} from '../../../src/lib/contests';
import { fetchGymDetail } from '../../../src/lib/gymDetail';
import { fetchProfile } from '../../../src/lib/profile';
import { colors } from '../../../src/theme/colors';
import type { ContestGender, ContestPeriod, Nomination } from '../../../src/types/database';

const GENDER_OPTIONS: { value: ContestGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

function formatTimeRemaining(untilIso: string): string {
  const diffMs = new Date(untilIso).getTime() - Date.now();
  if (diffMs <= 0) return 'Ending soon';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  if (days > 0) return `${days}d ${hours}h left`;
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
  return `${hours}h ${minutes}m left`;
}

export default function FaceOfGymScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gymId = Number(id);
  const { session } = useAuth();
  const router = useRouter();

  const [gymName, setGymName] = useState<string>('');
  const [myGender, setMyGender] = useState<ContestGender | null>(null);
  const [selectedGender, setSelectedGender] = useState<ContestGender>('male');
  const [contest, setContest] = useState<ContestPeriod | null>(null);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [myNomination, setMyNomination] = useState<Nomination | null>(null);
  const [myVoteNomineeId, setMyVoteNomineeId] = useState<number | null>(null);
  const [results, setResults] = useState<ContestResultEntry[]>([]);
  const [cityContestId, setCityContestId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedGenderDefault, setHasLoadedGenderDefault] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [gym, profile] = await Promise.all([
        fetchGymDetail(gymId),
        session ? fetchProfile(session.user.id) : Promise.resolve(null),
      ]);
      setGymName(gym?.name ?? '');
      const profileGender =
        profile?.gender === 'male' || profile?.gender === 'female' ? profile.gender : null;
      setMyGender(profileGender);
      if (!hasLoadedGenderDefault) {
        setSelectedGender(profileGender ?? 'male');
        setHasLoadedGenderDefault(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this gym.');
    }
    setIsLoading(false);
    // Only the very first load should decide the default tab from the
    // viewer's own gender - after that, the user's own tab taps take over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId, session]);

  useEffect(() => {
    load();
  }, [load]);

  const loadContest = useCallback(
    async (gender: ContestGender) => {
      setError(null);
      try {
        const current = await fetchCurrentContestForGym(gymId, gender);
        setContest(current);

        if (!current) {
          setNominations([]);
          setMyNomination(null);
          setMyVoteNomineeId(null);
          setResults([]);
          return;
        }

        const tasks: Promise<void>[] = [];

        if (session) {
          tasks.push(
            fetchMyNomination(current.id, session.user.id).then((n) => setMyNomination(n))
          );
        } else {
          setMyNomination(null);
        }

        if (current.status === 'voting' || current.status === 'runoff') {
          tasks.push(fetchNominations(current.id).then((list) => setNominations(list)));
          if (session) {
            tasks.push(
              fetchMyVoteNomineeId(current.id, session.user.id).then((id) => setMyVoteNomineeId(id))
            );
          }
        } else {
          setNominations([]);
          setMyVoteNomineeId(null);
        }

        if (current.status === 'completed') {
          tasks.push(fetchContestResults(current.id).then((list) => setResults(list)));
          tasks.push(
            fetchCityContestIdForGym(gymId, gender).then((cityId) => setCityContestId(cityId))
          );
        } else {
          setResults([]);
          setCityContestId(null);
        }

        await Promise.all(tasks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load this contest.');
      }
    },
    [gymId, session]
  );

  useEffect(() => {
    if (!hasLoadedGenderDefault) return;
    loadContest(selectedGender);
  }, [selectedGender, hasLoadedGenderDefault, loadContest]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([load(), loadContest(selectedGender)]);
    setIsRefreshing(false);
  }, [load, loadContest, selectedGender]);

  async function handleSubmitNomination(input: { primaryPhotoUri: string; extraPhotoUris: string[] }) {
    if (!session || !contest) return;
    setIsSubmitting(true);
    try {
      const result = await submitNomination({
        contestPeriodId: contest.id,
        userId: session.user.id,
        primaryPhotoUri: input.primaryPhotoUri,
        extraPhotoUris: input.extraPhotoUris,
      });
      if (result.kind === 'success') {
        setMyNomination(result.nomination);
      } else {
        Alert.alert("Can't nominate", result.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleWithdraw() {
    if (!myNomination) return;
    confirmDelete('nomination', async () => {
      const result = await withdrawNomination(myNomination.id);
      if (result.kind === 'success') {
        setMyNomination((prev) => (prev ? { ...prev, status: 'withdrawn' } : prev));
        loadContest(selectedGender);
      } else {
        Alert.alert('Something went wrong', result.message);
      }
    });
  }

  async function handleVote(nomineeId: number) {
    if (!session || !contest || myVoteNomineeId !== null) return;
    setIsVoting(true);
    try {
      const result = await castVote(contest.id, nomineeId, session.user.id);
      if (result.kind === 'success') {
        setMyVoteNomineeId(nomineeId);
      } else {
        Alert.alert("Can't vote", result.message);
      }
    } finally {
      setIsVoting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Face of the Gym' }} />
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  const canWithdraw = myNomination && myNomination.status === 'active';
  const canNominate = session && myGender === selectedGender && !myNomination;
  const winnerEntry = contest ? results.find((entry) => entry.id === contest.winnerId) : undefined;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.emerald} />
      }
    >
      <Stack.Screen options={{ title: gymName ? `Face of ${gymName}` : 'Face of the Gym' }} />

      <View style={styles.genderRow}>
        {GENDER_OPTIONS.map((option) => {
          const isActive = option.value === selectedGender;
          return (
            <Pressable
              key={option.value}
              style={[styles.genderSegment, isActive && styles.genderSegmentActive]}
              onPress={() => setSelectedGender(option.value)}
            >
              <Text style={[styles.genderLabel, isActive && styles.genderLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!contest ? (
        <Text style={styles.empty}>No Face of the Gym contest is running right now.</Text>
      ) : (
        <>
          {contest.status === 'nominating' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nominations are open</Text>
              <Text style={styles.sectionSubtitle}>
                Closes {formatTimeRemaining(contest.nominationEnd)}
              </Text>

              {!session ? (
                <Text style={styles.empty}>Sign in to nominate yourself.</Text>
              ) : myNomination && myNomination.status === 'active' ? (
                <View style={styles.myNominationCard}>
                  <Image source={{ uri: myNomination.primaryPhotoUrl }} style={styles.myNominationPhoto} />
                  <Text style={styles.myNominationText}>You're nominated!</Text>
                  <Pressable style={styles.withdrawButton} onPress={handleWithdraw}>
                    <Text style={styles.withdrawButtonText}>Withdraw</Text>
                  </Pressable>
                </View>
              ) : canNominate ? (
                <NominationForm isSubmitting={isSubmitting} onSubmit={handleSubmitNomination} />
              ) : (
                <Text style={styles.empty}>
                  Your profile gender must be set to {selectedGender} to nominate yourself in this
                  category. You can change this from Edit Profile.
                </Text>
              )}
            </View>
          ) : null}

          {contest.status === 'voting' || contest.status === 'runoff' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {contest.status === 'runoff' ? 'Runoff voting' : 'Voting is open'}
              </Text>
              <Text style={styles.sectionSubtitle}>
                Closes {formatTimeRemaining(contest.votingEnd)}
              </Text>

              {!session ? (
                <Text style={styles.empty}>Sign in to vote.</Text>
              ) : nominations.length === 0 ? (
                <Text style={styles.empty}>No nominees to vote for yet.</Text>
              ) : (
                <View style={styles.nomineeGrid}>
                  {nominations.map((nomination) => (
                    <NomineeVoteCard
                      key={nomination.id}
                      nomination={nomination}
                      hasVoted={myVoteNomineeId !== null || isVoting}
                      isVotedForThis={myVoteNomineeId === nomination.id}
                      onVote={() => handleVote(nomination.id)}
                    />
                  ))}
                </View>
              )}

              {canWithdraw ? (
                <Pressable style={styles.withdrawButton} onPress={handleWithdraw}>
                  <Text style={styles.withdrawButtonText}>Withdraw my nomination</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {contest.status === 'completed' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Results</Text>

              {results.length === 0 ? (
                <Text style={styles.empty}>This contest closed without a winner.</Text>
              ) : (
                <>
                  {winnerEntry ? (
                    <View style={styles.winnerCard}>
                      <Feather name="award" size={22} color={colors.emerald} />
                      <Image source={{ uri: winnerEntry.primaryPhotoUrl }} style={styles.winnerPhoto} />
                      <Text style={styles.winnerName}>
                        {winnerEntry.fullName || winnerEntry.username || 'GymTrust member'}
                      </Text>
                      <Text style={styles.winnerLabel}>Face of {gymName || 'the Gym'}</Text>
                    </View>
                  ) : null}

                  <View style={styles.resultsList}>
                    {results.map((entry, index) => (
                      <View key={entry.id} style={styles.resultRow}>
                        <Text style={styles.resultRank}>#{index + 1}</Text>
                        <Image source={{ uri: entry.primaryPhotoUrl }} style={styles.resultPhoto} />
                        <Text style={styles.resultName} numberOfLines={1}>
                          {entry.fullName || entry.username || 'GymTrust member'}
                        </Text>
                        <Text style={styles.resultVotes}>
                          {entry.voteCount} vote{entry.voteCount === 1 ? '' : 's'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {cityContestId ? (
                <Pressable
                  style={styles.cityBracketLink}
                  onPress={() =>
                    router.push({
                      pathname: '/city-bracket/[contestPeriodId]',
                      params: { contestPeriodId: String(cityContestId) },
                    })
                  }
                >
                  <Feather name="git-branch" size={14} color={colors.emerald} />
                  <Text style={styles.cityBracketLinkText}>See the City bracket</Text>
                  <Feather name="chevron-right" size={14} color={colors.emerald} />
                </Pressable>
              ) : null}

              {canWithdraw ? (
                <Pressable style={styles.withdrawButton} onPress={handleWithdraw}>
                  <Text style={styles.withdrawButtonText}>Withdraw my nomination</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
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
  genderRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  genderSegment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  genderSegmentActive: {
    backgroundColor: colors.emerald,
  },
  genderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  genderLabelActive: {
    color: '#fff',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: -8,
  },
  myNominationCard: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  myNominationPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  myNominationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  nomineeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cityBracketLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 12,
  },
  cityBracketLinkText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: 13,
  },
  withdrawButton: {
    borderWidth: 1,
    borderColor: '#f8717166',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  withdrawButtonText: {
    color: '#f87171',
    fontWeight: '600',
    fontSize: 13,
  },
  winnerCard: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
  },
  winnerPhoto: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  winnerName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  winnerLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  resultsList: {
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  resultRank: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    width: 28,
  },
  resultPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  resultName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  resultVotes: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.emerald,
  },
});
