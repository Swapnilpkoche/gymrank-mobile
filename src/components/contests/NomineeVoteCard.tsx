import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
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
            color={isVotedForThis ? '#fff' : colors.emerald}
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
    borderRadius: 16,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  photo: {
    width: '100%',
    height: 150,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 8,
    marginHorizontal: 10,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 999,
    paddingVertical: 8,
    marginTop: 8,
    marginHorizontal: 10,
  },
  voteButtonActive: {
    backgroundColor: colors.emerald,
  },
  voteButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: 13,
  },
  voteButtonTextActive: {
    color: '#fff',
  },
});
