import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';
import type { BracketMatchup } from '../../types/database';

function displayName(nomination: { fullName: string | null; username: string | null } | null): string {
  if (!nomination) return '';
  return nomination.fullName || nomination.username || 'GymTrust member';
}

export function BracketMatchupCard({
  matchup,
  myVoteNomineeId,
  revealedVotes,
  canVote,
  onVote,
}: {
  matchup: BracketMatchup;
  myVoteNomineeId: number | null;
  revealedVotes: Map<number, number> | null;
  canVote: boolean;
  onVote: (nomineeId: number) => void;
}) {
  if (matchup.nomineeA && !matchup.nomineeB) {
    // A bye - nothing to vote on.
    return (
      <View style={styles.card}>
        <View style={styles.side}>
          <Image source={{ uri: matchup.nomineeA.primaryPhotoUrl }} style={styles.photo} />
          <Text style={styles.name} numberOfLines={1}>
            {displayName(matchup.nomineeA)}
          </Text>
        </View>
        <View style={styles.byeLabel}>
          <Feather name="fast-forward" size={14} color={colors.textMuted} />
          <Text style={styles.byeText}>Bye — advances automatically</Text>
        </View>
      </View>
    );
  }

  const sides = [matchup.nomineeA, matchup.nomineeB] as const;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {sides.map((nomination, index) =>
          nomination ? (
            <View key={nomination.id} style={styles.side}>
              <Image source={{ uri: nomination.primaryPhotoUrl }} style={styles.photo} />
              <Text style={styles.name} numberOfLines={1}>
                {displayName(nomination)}
              </Text>

              {revealedVotes ? (
                <Text style={styles.voteCount}>
                  {revealedVotes.get(nomination.id) ?? 0} vote
                  {(revealedVotes.get(nomination.id) ?? 0) === 1 ? '' : 's'}
                </Text>
              ) : canVote ? (
                <Pressable
                  style={[styles.voteButton, myVoteNomineeId === nomination.id && styles.voteButtonActive]}
                  onPress={() => onVote(nomination.id)}
                  disabled={myVoteNomineeId !== null}
                >
                  <Text
                    style={[
                      styles.voteButtonText,
                      myVoteNomineeId === nomination.id && styles.voteButtonTextActive,
                    ]}
                  >
                    {myVoteNomineeId === nomination.id ? 'Voted' : 'Vote'}
                  </Text>
                </Pressable>
              ) : null}

              {matchup.status === 'completed' && matchup.winnerId === nomination.id ? (
                <View style={styles.winnerBadge}>
                  <Feather name="award" size={11} color={colors.white} />
                </View>
              ) : null}
            </View>
          ) : (
            <View key={`empty-${index}`} style={styles.side} />
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  side: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  voteCount: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.emerald,
  },
  voteButton: {
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  voteButtonActive: {
    backgroundColor: colors.emerald,
  },
  voteButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  voteButtonTextActive: {
    color: colors.white,
  },
  winnerBadge: {
    width: 20,
    height: 20,
    borderRadius: radius.md,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  byeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  byeText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
