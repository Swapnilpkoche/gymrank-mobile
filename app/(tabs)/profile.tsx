import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckInSummaryCard } from '../../src/components/gym-detail/CheckInSummaryCard';
import { OnboardingStatusCard } from '../../src/components/list-gym/OnboardingStatusCard';
import { AlbumSection } from '../../src/components/profile/AlbumSection';
import { EditProfileModal } from '../../src/components/profile/EditProfileModal';
import { GymListSection } from '../../src/components/profile/GymListSection';
import { ProfileHeader } from '../../src/components/profile/ProfileHeader';
import { useAuth } from '../../src/context/auth-context';
import { useUnreadNotificationCount } from '../../src/hooks/useUnreadNotificationCount';
import { fetchOverallCheckInSummary } from '../../src/lib/checkin';
import { fetchMyOnboardingRequests } from '../../src/lib/onboarding';
import {
  fetchFollowedGyms,
  fetchMyGymRelationships,
  fetchProfile,
} from '../../src/lib/profile';
import { supabase } from '../../src/lib/supabase';
import { fetchFollowCounts } from '../../src/lib/userFollows';
import { colors, fontSize, radius, spacing } from '../../src/theme';
import type {
  CheckInSummary,
  FollowedGym,
  MyGymRelationship,
  OnboardingRequest,
  Profile,
} from '../../src/types/database';

const SUPPORT_EMAIL = 'swapnil.koche@gmail.com';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [checkInSummary, setCheckInSummary] = useState<CheckInSummary | null>(null);
  const [followedGyms, setFollowedGyms] = useState<FollowedGym[]>([]);
  const [myGyms, setMyGyms] = useState<MyGymRelationship[]>([]);
  const [onboardingRequests, setOnboardingRequests] = useState<OnboardingRequest[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [albumRefreshToken, setAlbumRefreshToken] = useState(0);
  const { count: unreadNotifications, refresh: refreshUnreadNotifications } =
    useUnreadNotificationCount();

  const load = useCallback(async () => {
    if (!session) {
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const [profileData, summaryData, followedData, myGymsData, onboardingData, followCounts] =
        await Promise.all([
          fetchProfile(session.user.id),
          fetchOverallCheckInSummary(session.user.id),
          fetchFollowedGyms(session.user.id),
          fetchMyGymRelationships(session.user.id),
          fetchMyOnboardingRequests(session.user.id),
          fetchFollowCounts(session.user.id),
        ]);
      setProfile(profileData);
      setCheckInSummary(summaryData);
      setFollowedGyms(followedData);
      setMyGyms(myGymsData);
      setOnboardingRequests(onboardingData);
      setFollowingCount(followCounts.followingCount);
      setFollowerCount(followCounts.followerCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your profile.');
    }
    setIsLoading(false);
    setAlbumRefreshToken((token) => token + 1);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  // This tab stays mounted while you use the rest of the app, and there are no
  // push notifications - so if you leave a gym, or an owner removes you, "Your
  // Gyms" would otherwise keep showing it until a manual pull-to-refresh.
  // Re-read just that list (one small query) whenever the tab is focused.
  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      fetchMyGymRelationships(session.user.id)
        .then(setMyGyms)
        .catch(() => {
          // Best-effort - keep showing what we had.
        });
      // A renewal reminder may have arrived (or been read) since last visit.
      refreshUnreadNotifications();
    }, [session, refreshUnreadNotifications])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      `To delete your account, please contact us at ${SUPPORT_EMAIL} and we'll process it manually.`
    );
  }

  function handleAvatarUploaded(url: string) {
    setProfile((prev) => (prev ? { ...prev, avatarUrl: url } : prev));
  }

  function handleProfileSaved(updated: Profile) {
    setProfile(updated);
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Feather name="user" size={32} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Sign in to view your profile</Text>
        <Text style={styles.emptyText}>
          Track your gyms, follows, and check-ins once you&apos;re signed in.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.emerald}
        />
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ProfileHeader
        profile={profile}
        email={session.user.email}
        userId={session.user.id}
        followingCount={followingCount}
        followerCount={followerCount}
        onAvatarUploaded={handleAvatarUploaded}
        onEditPress={() => setIsEditModalVisible(true)}
      />

      <AlbumSection userId={session.user.id} refreshToken={albumRefreshToken} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Messages</Text>
        <Pressable style={styles.listGymButton} onPress={() => router.push('/messages')}>
          <Feather name="message-circle" size={18} color={colors.emerald} />
          <Text style={styles.listGymButtonText}>View your messages</Text>
        </Pressable>
        <Pressable style={styles.listGymButton} onPress={() => router.push('/notifications')}>
          <Feather name="bell" size={18} color={colors.emerald} />
          <Text style={styles.listGymButtonText}>Notifications</Text>
          {unreadNotifications > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadNotifications}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trainer Profile</Text>
        <Pressable
          style={styles.listGymButton}
          onPress={() =>
            router.push({ pathname: '/trainer/[id]', params: { id: session.user.id } })
          }
        >
          <Feather name="award" size={18} color={colors.emerald} />
          <Text style={styles.listGymButtonText}>View / Edit my trainer profile</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Check-Ins</Text>
        {checkInSummary ? <CheckInSummaryCard summary={checkInSummary} scope="overall" /> : null}
        <Pressable style={styles.linkRow} onPress={() => router.push('/check-in')}>
          <Text style={styles.linkText}>View full history</Text>
          <Feather name="arrow-right" size={14} color={colors.emeraldLight} />
        </Pressable>
      </View>

      <GymListSection
        title="Gyms You Follow"
        gyms={followedGyms.map((gym) => ({ gymId: gym.gymId, gymName: gym.gymName }))}
        emptyLabel="You're not following any gyms yet."
        maxVisible={5}
        onViewAll={() => router.push('/saved')}
      />

      <GymListSection
        title="Your Gyms"
        gyms={myGyms.map((gym) => ({
          gymId: gym.gymId,
          gymName: gym.gymName,
          badge: gym.label,
          note: gym.note,
        }))}
        emptyLabel="You're not a member or staff of any gym yet."
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>List Your Gym</Text>
        <Pressable style={styles.listGymButton} onPress={() => router.push('/list-gym')}>
          <Feather name="plus-circle" size={18} color={colors.emerald} />
          <Text style={styles.listGymButtonText}>Own a gym? List it here</Text>
        </Pressable>

        {onboardingRequests.map((request) => (
          <OnboardingStatusCard key={request.id} request={request} />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <Text style={styles.email}>{session.user.email}</Text>
        <Pressable style={styles.button} onPress={() => router.push('/change-password')}>
          <Text style={styles.buttonText}>Change Password</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={handleDeleteAccount}>
          <Text style={styles.dangerButtonText}>Delete Account</Text>
        </Pressable>
      </View>

      <EditProfileModal
        visible={isEditModalVisible}
        userId={session.user.id}
        profile={profile}
        onClose={() => setIsEditModalVisible(false)}
        onSaved={handleProfileSaved}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.base,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  linkText: {
    color: colors.emeraldLight,
    fontWeight: '600',
    fontSize: fontSize.base,
  },
  listGymButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  listGymButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  email: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  button: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: colors.danger,
    fontWeight: '600',
  },
});
