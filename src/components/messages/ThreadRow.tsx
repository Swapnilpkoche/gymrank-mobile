import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';
import type { MessageThread } from '../../types/database';

function initials(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export function ThreadRow({ thread, onPress }: { thread: MessageThread; onPress: () => void }) {
  const displayName = thread.otherUserFullName || thread.otherUserUsername || 'GymTrust member';

  return (
    <Pressable style={styles.row} onPress={onPress}>
      {thread.otherUserAvatarUrl ? (
        <Image source={{ uri: thread.otherUserAvatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{initials(displayName)}</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        {thread.status === 'pending' ? (
          <Text style={styles.statusText} numberOfLines={1}>
            {thread.initiatedByMe ? 'Request sent — waiting for reply' : 'Wants to message you'}
          </Text>
        ) : null}
      </View>

      <Feather name="chevron-right" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
  },
  avatarFallback: {
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 1,
  },
});
