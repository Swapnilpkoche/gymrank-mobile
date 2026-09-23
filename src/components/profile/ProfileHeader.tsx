import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarPicker } from './AvatarPicker';
import { colors, fontSize, radius, spacing } from '../../theme';
import type { Profile } from '../../types/database';

export function ProfileHeader({
  profile,
  email,
  userId,
  followingCount,
  followerCount,
  onAvatarUploaded,
  onEditPress,
}: {
  profile: Profile | null;
  email: string | undefined;
  userId: string;
  followingCount: number;
  followerCount: number;
  onAvatarUploaded: (url: string) => void;
  onEditPress: () => void;
}) {
  const displayName = profile?.fullName || profile?.username || email || 'GymTrust member';

  return (
    <View style={styles.container}>
      <AvatarPicker
        avatarUrl={profile?.avatarUrl ?? null}
        displayName={displayName}
        userId={userId}
        onUploaded={onAvatarUploaded}
      />

      <View style={styles.info}>
        <Text style={styles.name}>{displayName}</Text>
        {profile?.username ? <Text style={styles.username}>@{profile.username}</Text> : null}

        {profile?.city ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={12} color={colors.textMuted} />
            <Text style={styles.metaText}>{profile.city}</Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{followerCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
        </View>

        {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>

      <Pressable style={styles.editButton} onPress={onEditPress}>
        <Feather name="edit-2" size={13} color={colors.emerald} />
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  info: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  username: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  bio: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  editButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: fontSize.base,
  },
});
