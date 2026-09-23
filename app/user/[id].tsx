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

import { AlbumCategoryPreview } from '../../src/components/profile/AlbumCategoryPreview';
import { AlbumViewerModal } from '../../src/components/profile/AlbumViewerModal';
import { useAuth } from '../../src/context/auth-context';
import { fetchAlbumItems } from '../../src/lib/album';
import { confirmUnfollow } from '../../src/lib/confirmations';
import { getOrCreateMessageThread } from '../../src/lib/messages';
import {
  fetchPublicProfile,
  fetchRelationshipStatus,
  followUser,
  unfollowUser,
  type RelationshipStatus,
} from '../../src/lib/userFollows';
import { colors } from '../../src/theme/colors';
import type { AlbumItem, PublicProfile } from '../../src/types/database';

function initials(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const targetUserId = id;
  const { session } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [relationship, setRelationship] = useState<RelationshipStatus | null>(null);
  const [albumItems, setAlbumItems] = useState<AlbumItem[]>([]);
  const [viewerItem, setViewerItem] = useState<AlbumItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFollowActionPending, setIsFollowActionPending] = useState(false);
  const [isMessagePending, setIsMessagePending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [profileData, relationshipData, albumData] = await Promise.all([
        fetchPublicProfile(targetUserId),
        session ? fetchRelationshipStatus(session.user.id, targetUserId) : Promise.resolve(null),
        fetchAlbumItems(targetUserId),
      ]);
      setProfile(profileData);
      setRelationship(relationshipData);
      setAlbumItems(albumData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this profile.');
    }
    setIsLoading(false);
  }, [targetUserId, session]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const displayName = profile?.fullName || profile?.username || 'GymTrust member';
  const isOwnProfile = session?.user.id === targetUserId;
  const albumPhotos = albumItems.filter((item) => item.mediaType === 'photo');
  const albumVideos = albumItems.filter((item) => item.mediaType === 'video');

  async function performFollow() {
    if (!session) return;
    setIsFollowActionPending(true);
    setRelationship((prev) => ({ isFollowing: true, isFollowedBy: prev?.isFollowedBy ?? false }));
    try {
      const result = await followUser(session.user.id, targetUserId);
      if (result.kind === 'limit_exceeded') {
        setRelationship((prev) => (prev ? { ...prev, isFollowing: false } : prev));
        Alert.alert("Can't follow", result.message);
      } else if (result.kind === 'error') {
        setRelationship((prev) => (prev ? { ...prev, isFollowing: false } : prev));
        Alert.alert('Something went wrong', result.message);
      }
    } finally {
      setIsFollowActionPending(false);
    }
  }

  async function performUnfollow() {
    if (!session) return;
    setIsFollowActionPending(true);
    setRelationship((prev) => (prev ? { ...prev, isFollowing: false } : prev));
    try {
      await unfollowUser(session.user.id, targetUserId);
    } catch (err) {
      setRelationship((prev) => (prev ? { ...prev, isFollowing: true } : prev));
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsFollowActionPending(false);
    }
  }

  function handleAlbumItemPress(item: AlbumItem) {
    setViewerItem(item);
  }

  function goToFullAlbum(mediaType: AlbumItem['mediaType']) {
    router.push({
      pathname: '/album/[userId]/[mediaType]',
      params: { userId: targetUserId, mediaType: mediaType === 'photo' ? 'photos' : 'videos' },
    });
  }

  function handleFollowPress() {
    if (!session) {
      router.push('/login');
      return;
    }
    if (relationship?.isFollowing) {
      confirmUnfollow(displayName, performUnfollow);
    } else {
      performFollow();
    }
  }

  // Server-side (trg_enforce_message_thread_rules) is the real gate on
  // minors being excluded from messaging - this button is shown to anyone,
  // and a rejection just surfaces as a clear alert rather than being
  // pre-emptively hidden, since hiding it isn't a substitute for enforcement.
  async function handleMessagePress() {
    if (!session) {
      router.push('/login');
      return;
    }
    setIsMessagePending(true);
    try {
      const result = await getOrCreateMessageThread(session.user.id, targetUserId);
      if (result.kind === 'success') {
        router.push({
          pathname: '/messages/[threadId]',
          params: { threadId: String(result.threadId) },
        });
      } else if (result.kind === 'ineligible') {
        Alert.alert("Can't message", result.message);
      } else {
        Alert.alert('Something went wrong', result.message);
      }
    } finally {
      setIsMessagePending(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={styles.error}>{error ?? 'This profile is not available.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.emerald}
        />
      }
    >
      <Stack.Screen options={{ title: displayName }} />

      {profile.avatarUrl ? (
        <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{initials(displayName)}</Text>
        </View>
      )}

      <Text style={styles.name}>{displayName}</Text>
      {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}

      {relationship?.isFollowedBy ? (
        <View style={styles.followsYouBadge}>
          <Text style={styles.followsYouText}>Follows you</Text>
        </View>
      ) : null}

      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      {!isOwnProfile ? (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.followButton, relationship?.isFollowing && styles.followButtonActive]}
            onPress={handleFollowPress}
            disabled={isFollowActionPending}
          >
            {isFollowActionPending ? (
              <ActivityIndicator
                color={relationship?.isFollowing ? '#fff' : colors.emerald}
                size="small"
              />
            ) : (
              <>
                <Feather
                  name="heart"
                  size={16}
                  color={relationship?.isFollowing ? '#fff' : colors.emerald}
                />
                <Text
                  style={[
                    styles.followButtonText,
                    relationship?.isFollowing && styles.followButtonTextActive,
                  ]}
                >
                  {relationship?.isFollowing
                    ? 'Following'
                    : relationship?.isFollowedBy
                      ? 'Follow Back'
                      : 'Follow'}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={styles.messageButton}
            onPress={handleMessagePress}
            disabled={isMessagePending}
          >
            {isMessagePending ? (
              <ActivityIndicator color={colors.emerald} size="small" />
            ) : (
              <>
                <Feather name="message-circle" size={16} color={colors.emerald} />
                <Text style={styles.messageButtonText}>Message</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      {albumPhotos.length > 0 || albumVideos.length > 0 ? (
        <View style={styles.albumSection}>
          {albumPhotos.length > 0 ? (
            <AlbumCategoryPreview
              title="Photos"
              items={albumPhotos}
              onItemPress={handleAlbumItemPress}
              onSeeAll={() => goToFullAlbum('photo')}
            />
          ) : null}

          {albumVideos.length > 0 ? (
            <AlbumCategoryPreview
              title="Videos"
              items={albumVideos}
              onItemPress={handleAlbumItemPress}
              onSeeAll={() => goToFullAlbum('video')}
            />
          ) : null}
        </View>
      ) : null}

      <AlbumViewerModal item={viewerItem} onClose={() => setViewerItem(null)} />
    </ScrollView>
  );
}

const AVATAR_SIZE = 96;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 16,
  },
  error: {
    color: '#f87171',
    textAlign: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginBottom: 4,
  },
  avatarFallback: {
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 32,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  username: {
    fontSize: 13,
    color: colors.textMuted,
  },
  followsYouBadge: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  followsYouText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  bio: {
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 120,
  },
  followButtonActive: {
    backgroundColor: colors.emerald,
  },
  followButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: 14,
  },
  followButtonTextActive: {
    color: '#fff',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 120,
  },
  messageButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: 14,
  },
  albumSection: {
    width: '100%',
    gap: 20,
    marginTop: 20,
  },
});
