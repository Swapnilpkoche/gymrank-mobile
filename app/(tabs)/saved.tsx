import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SavedGymRow } from '../../src/components/saved/SavedGymRow';
import { SavedMemberRow } from '../../src/components/saved/SavedMemberRow';
import { SavedTabToggle, type SavedTab } from '../../src/components/saved/SavedTabToggle';
import { useAuth } from '../../src/context/auth-context';
import { confirmUnfollow } from '../../src/lib/confirmations';
import { toggleFollow } from '../../src/lib/gymDetail';
import { fetchFollowedGyms } from '../../src/lib/profile';
import { fetchFollowedUsers, searchProfiles, unfollowUser } from '../../src/lib/userFollows';
import { colors } from '../../src/theme/colors';
import type { FollowedGym, FollowedUser } from '../../src/types/database';

const SEARCH_DEBOUNCE_MS = 400;

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<SavedTab>('gyms');
  const [gyms, setGyms] = useState<FollowedGym[]>([]);
  const [members, setMembers] = useState<FollowedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FollowedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const latestSearchRef = useRef('');
  const trimmedSearchQuery = searchQuery.trim();

  const load = useCallback(async () => {
    if (!session) {
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const [gymsData, membersData] = await Promise.all([
        fetchFollowedGyms(session.user.id),
        fetchFollowedUsers(session.user.id),
      ]);
      setGyms(gymsData);
      setMembers(membersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your saved items.');
    }
    setIsLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!trimmedSearchQuery) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const timeoutId = setTimeout(async () => {
      latestSearchRef.current = trimmedSearchQuery;
      try {
        const results = await searchProfiles(trimmedSearchQuery);
        // A newer keystroke may have kicked off another search while this
        // one was in flight - ignore this response if it's no longer the
        // latest, so a slow earlier result can't clobber a faster later one.
        if (latestSearchRef.current !== trimmedSearchQuery) return;
        setSearchResults(results);
      } catch (err) {
        if (latestSearchRef.current !== trimmedSearchQuery) return;
        setSearchError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      } finally {
        if (latestSearchRef.current === trimmedSearchQuery) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [trimmedSearchQuery]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  function handleUnfollowGym(gym: FollowedGym) {
    if (!session) return;
    confirmUnfollow(gym.gymName, async () => {
      const previousGyms = gyms;
      setGyms((prev) => prev.filter((g) => g.gymId !== gym.gymId));
      try {
        await toggleFollow(gym.gymId, session.user.id, true);
      } catch (err) {
        setGyms(previousGyms);
        Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
      }
    });
  }

  function handleUnfollowMember(member: FollowedUser) {
    if (!session) return;
    const displayName = member.fullName || member.username || 'this member';
    confirmUnfollow(displayName, async () => {
      const previousMembers = members;
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
      try {
        await unfollowUser(session.user.id, member.userId);
      } catch (err) {
        setMembers(previousMembers);
        Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
      }
    });
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Feather name="heart" size={32} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Sign in to see what you follow</Text>
        <Text style={styles.emptyText}>
          Follow gyms and members to keep track of them once you&apos;re signed in.
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
    <View style={styles.container}>
      <View style={[styles.headerSection, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.pageTitle}>Saved</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <SavedTabToggle value={activeTab} onChange={setActiveTab} />

        {activeTab === 'members' ? (
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search members by name or username"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isSearching ? (
              <ActivityIndicator color={colors.emerald} size="small" />
            ) : searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Feather name="x" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {activeTab === 'members' && searchError ? (
          <Text style={styles.error}>{searchError}</Text>
        ) : null}
      </View>

      {activeTab === 'gyms' ? (
        <FlatList
          data={gyms}
          keyExtractor={(item) => String(item.gymId)}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.emerald}
            />
          }
          renderItem={({ item }) => (
            <SavedGymRow
              name={item.gymName}
              onPress={() =>
                router.push({ pathname: '/gym/[id]', params: { id: String(item.gymId) } })
              }
              onUnfollow={() => handleUnfollowGym(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="heart" size={32} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No saved gyms yet</Text>
              <Text style={styles.emptyText}>
                You&apos;re not following any gyms yet — find some on Discover.
              </Text>
              <Pressable onPress={() => router.push('/')}>
                <Text style={styles.link}>Go to Discover</Text>
              </Pressable>
            </View>
          }
        />
      ) : (
        <FlatList
          data={trimmedSearchQuery ? searchResults : members}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.emerald}
            />
          }
          renderItem={({ item }) => (
            <SavedMemberRow
              displayName={item.fullName || item.username || 'GymTrust member'}
              username={item.username}
              avatarUrl={item.avatarUrl}
              onPress={() =>
                router.push({ pathname: '/user/[id]', params: { id: item.userId } })
              }
              onUnfollow={trimmedSearchQuery ? undefined : () => handleUnfollowMember(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            isSearching ? null : trimmedSearchQuery ? (
              <View style={styles.emptyContainer}>
                <Feather name="search" size={32} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No members found</Text>
                <Text style={styles.emptyText}>Try a different name or username.</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Feather name="users" size={32} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No followed members yet</Text>
                <Text style={styles.emptyText}>
                  You&apos;re not following any members yet — check out reviews or a gym&apos;s
                  team to find people.
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.background,
    padding: 24,
  },
  headerSection: {
    gap: 12,
    padding: 16,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  listContent: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 40,
    flexGrow: 1,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  link: {
    color: colors.emeraldLight,
    fontWeight: '600',
    fontSize: 13,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
