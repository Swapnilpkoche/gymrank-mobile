import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

function initials(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export function SavedMemberRow({
  displayName,
  username,
  avatarUrl,
  onPress,
  onUnfollow,
}: {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  onPress: () => void;
  onUnfollow?: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{initials(displayName)}</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        {username ? (
          <Text style={styles.username} numberOfLines={1}>
            @{username}
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>
        {onUnfollow ? (
          <Pressable style={styles.unfollowButton} onPress={onUnfollow} hitSlop={8}>
            <Feather name="heart" size={14} color="#fff" />
          </Pressable>
        ) : null}
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    backgroundColor: '#1e293b',
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  username: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  unfollowButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
