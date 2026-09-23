import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';
import type { Nomination } from '../../types/database';

export function NomineeVoteCard({
  nomination,
  hasVoted,
  isVotedForThis,
  onVote,
  showVoteButton = true,
}: {
  nomination: Nomination;
  hasVoted: boolean;
  isVotedForThis: boolean;
  onVote: () => void;
  showVoteButton?: boolean;
}) {
  const displayName = nomination.fullName || nomination.username || 'GymTrust member';

  return (
    <View style={styles.card}>
      <Image source={{ uri: nomination.primaryPhotoUrl }} style={styles.photo} />
      <Text style={styles.name} numberOfLines={1}>
        {displayName}
      </Text>

      {showVoteButton ? (
        <Pressable
          style={[styles.voteButton, isVotedForThis && styles.voteButtonActive]}
          onPress={onVote}
          disabled={hasVoted}
        >
          <Feather
            name={isVotedForThis ? 'check-circle' : 'heart'}
            size={14}
            color={isVotedForThis ? colors.white : colors.emerald}
          />
          <Text style={[styles.voteButtonText, isVotedForThis && styles.voteButtonTextActive]}>
            {isVotedForThis ? 'Voted' : 'Vote'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    paddingBottom: spacing.md,
  },
  photo: {
    width: '100%',
    height: 150,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
  },
  voteButtonActive: {
    backgroundColor: colors.emerald,
  },
  voteButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: fontSize.base,
  },
  voteButtonTextActive: {
    color: colors.white,
  },
});
