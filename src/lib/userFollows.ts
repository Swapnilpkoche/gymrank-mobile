import { supabase } from './supabase';
import type { FollowedUser, PublicProfile } from '../types/database';

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc('get_public_profile', { p_user_id: userId });
  if (error) throw error;

  const row = data?.[0];
  if (!row) return null;

  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    bio: row.bio,
  };
}

type RawSearchProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export async function searchProfiles(query: string): Promise<FollowedUser[]> {
  const { data, error } = await supabase.rpc('search_profiles', { p_query: query });
  if (error) throw error;

  const rows = (data ?? []) as RawSearchProfileRow[];
  return rows.map((row) => ({
    userId: row.id,
    fullName: row.full_name,
    username: row.username,
    avatarUrl: row.avatar_url,
  }));
}

export type RelationshipStatus = {
  isFollowing: boolean; // me -> them
  isFollowedBy: boolean; // them -> me
};

// RLS on user_follows only exposes rows where the caller is either party,
// which is exactly what this OR covers - both possible edges between the
// two specific users, nothing about anyone else's follows.
export async function fetchRelationshipStatus(
  currentUserId: string,
  targetUserId: string
): Promise<RelationshipStatus> {
  const { data, error } = await supabase
    .from('user_follows')
    .select('follower_id, followed_id')
    .or(
      `and(follower_id.eq.${currentUserId},followed_id.eq.${targetUserId}),and(follower_id.eq.${targetUserId},followed_id.eq.${currentUserId})`
    );

  if (error) throw error;

  const rows = data ?? [];
  return {
    isFollowing: rows.some(
      (row) => row.follower_id === currentUserId && row.followed_id === targetUserId
    ),
    isFollowedBy: rows.some(
      (row) => row.follower_id === targetUserId && row.followed_id === currentUserId
    ),
  };
}

export type FollowUserResult =
  | { kind: 'success' }
  | { kind: 'limit_exceeded'; message: string }
  | { kind: 'error'; message: string };

// trg_enforce_follow_limits (BEFORE INSERT on user_follows) raises a plain
// RAISE EXCEPTION for either cap - no custom SQLSTATE, so both land on the
// default 'P0001' code. It's the only thing that trigger raises, so the
// code alone identifies "a cap message" without string-matching the text -
// and the text is already written to show the user directly.
export async function followUser(
  currentUserId: string,
  targetUserId: string
): Promise<FollowUserResult> {
  const { error } = await supabase
    .from('user_follows')
    .insert({ follower_id: currentUserId, followed_id: targetUserId });

  if (!error) return { kind: 'success' };
  if (error.code === 'P0001') {
    return { kind: 'limit_exceeded', message: error.message };
  }
  if (error.code === '23505') {
    // Already following (e.g. a double-tap) - not an error from the UI's
    // perspective.
    return { kind: 'success' };
  }
  return { kind: 'error', message: error.message };
}

export async function unfollowUser(currentUserId: string, targetUserId: string): Promise<void> {
  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', currentUserId)
    .eq('followed_id', targetUserId);

  if (error) throw error;
}

// user_follows.followed_id references auth.users, not public.profiles, so
// PostgREST can't embed profile fields directly (same reason gymDetail.ts
// fetches reviewer/team profiles separately). get_public_profile only takes
// one id at a time - fine here since follow_limit caps this list small.
export async function fetchFollowedUsers(userId: string): Promise<FollowedUser[]> {
  const { data, error } = await supabase
    .from('user_follows')
    .select('followed_id, created_at')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const profiles = await Promise.all(rows.map((row) => fetchPublicProfile(row.followed_id)));

  return rows.map((row, index) => {
    const profile = profiles[index];
    return {
      userId: row.followed_id,
      fullName: profile?.fullName ?? null,
      username: profile?.username ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
    };
  });
}

export async function fetchFollowCounts(
  userId: string
): Promise<{ followingCount: number; followerCount: number }> {
  const [followingResult, followerResult] = await Promise.all([
    supabase
      .from('user_follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', userId),
    supabase
      .from('user_follows')
      .select('id', { count: 'exact', head: true })
      .eq('followed_id', userId),
  ]);

  if (followingResult.error) throw followingResult.error;
  if (followerResult.error) throw followerResult.error;

  return {
    followingCount: followingResult.count ?? 0,
    followerCount: followerResult.count ?? 0,
  };
}
