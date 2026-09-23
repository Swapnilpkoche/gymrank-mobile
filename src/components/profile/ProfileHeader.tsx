import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarPicker } from './AvatarPicker';
import { colors } from '../../theme/colors';
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
    gap: 10,
  },
  info: {
    alignItems: 'center',
    gap: 3,
  },
  name: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  username: {
    fontSize: 13,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
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
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  bio: {
    fontSize: 13,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  editButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: 13,
  },
});
