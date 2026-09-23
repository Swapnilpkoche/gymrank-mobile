import { requestCurrentCoordinates } from './location';
import { fetchMyMemberships, isCurrentMemberState } from './memberships';
import { supabase } from './supabase';
import { APP_TIMEZONE, computeCheckInStreak, monthRangeUtc } from './time';
import type { CheckInHistoryEntry, CheckInSummary, MyGym } from '../types/database';

// Shared by the capped preview (check-in.tsx) and the full history screen
// (check-in-history.tsx) so the two never drift out of sync.
export function formatCheckInTimestamp(iso: string): string {
  const date = new Date(iso);
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return `${dateLabel} · ${timeLabel}`;
}

export type CheckInPhase = 'permission' | 'locating' | 'submitting';

export type CheckInOutcome =
  | { kind: 'success'; message: string; distanceMeters: number | null }
  | { kind: 'rejected'; message: string; distanceMeters: number | null }
  | { kind: 'permission-denied' }
  | { kind: 'location-error' }
  | { kind: 'error'; message: string };

type CheckInRpcRow = {
  success: boolean;
  message: string;
  distance_meters: number | null;
};

export async function performCheckIn(
  gymId: number,
  onPhaseChange?: (phase: CheckInPhase) => void
): Promise<CheckInOutcome> {
  const locationResult = await requestCurrentCoordinates(onPhaseChange);
  if (locationResult.kind === 'permission-denied') {
    return { kind: 'permission-denied' };
  }
  if (locationResult.kind === 'location-error') {
    return { kind: 'location-error' };
  }

  onPhaseChange?.('submitting');
  const { data, error } = await supabase.rpc('checkin_to_gym', {
    p_gym_id: gymId,
    p_user_latitude: locationResult.coords.latitude,
    p_user_longitude: locationResult.coords.longitude,
  });

  if (error) {
    return { kind: 'error', message: error.message };
  }

  const row = (data as CheckInRpcRow[] | null)?.[0];
  if (!row) {
    return { kind: 'error', message: 'Check-in failed. Please try again.' };
  }

  return row.success
    ? { kind: 'success', message: row.message, distanceMeters: row.distance_meters }
    : { kind: 'rejected', message: row.message, distanceMeters: row.distance_meters };
}

// gyms is fetched separately (rather than embedded on gym_members/gym_staff/
// gym_checkins) to match the fetchProfilesByIds pattern in gymDetail.ts -
// keeps this working the same way regardless of embed/FK quirks.
async function fetchGymNames(gymIds: number[]): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  if (gymIds.length === 0) return names;

  const { data, error } = await supabase.from('gyms').select('id, name').in('id', gymIds);
  if (error) throw error;

  for (const row of data ?? []) {
    names.set(row.id, row.name);
  }
  return names;
}

export type LatestValidCheckIn = { gymId: number; checkedInAt: string };

// Latest VALID check-in across ALL gyms, for this user - checkin_to_gym
// enforces once-per-day GLOBALLY (any valid check-in today, anywhere, blocks a
// new one), not per gym, so this single record drives the check-in button
// state for every gym on the Check In tab and every gym detail page.
// `gymId` is included (not just the timestamp) so a caller can tell "checked
// in HERE today" apart from "checked in at a DIFFERENT gym today" - the two
// must not be labeled the same way, since the latter didn't happen at that
// gym. Callers derive "is that today" themselves (see useTodayCheckInState)
// rather than filtering by date here, so the state keeps updating live as
// Asia/Kolkata midnight passes without a refetch.
export async function fetchLatestValidCheckIn(userId: string): Promise<LatestValidCheckIn | null> {
  const { data, error } = await supabase
    .from('gym_checkins')
    .select('gym_id, checked_in_at')
    .eq('user_id', userId)
    .eq('is_valid', true)
    .order('checked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? { gymId: data.gym_id, checkedInAt: data.checked_in_at } : null;
}

export type MyGymsResult = {
  gyms: MyGym[];
  // True when the caller has an approved membership that has lapsed. Lets the
  // Check In tab say "renew" instead of "join" when `gyms` is empty.
  hasExpiredMembership: boolean;
};

export async function fetchMyGyms(userId: string): Promise<MyGymsResult> {
  const [memberships, staffResult] = await Promise.all([
    // Only memberships that currently count make the list - an expired member
    // drops off it (expiry is resolved server-side; own rows only) but is
    // flagged via hasExpiredMembership.
    fetchMyMemberships(),
    supabase.from('gym_staff').select('gym_id').eq('user_id', userId).eq('status', 'active'),
  ]);

  if (staffResult.error) throw staffResult.error;

  const memberGymIds = memberships
    .filter((membership) => isCurrentMemberState(membership.state))
    .map((membership) => membership.gymId);
  const gymIds = Array.from(
    new Set([...memberGymIds, ...(staffResult.data ?? []).map((row) => row.gym_id)])
  );

  const names = await fetchGymNames(gymIds);

  const gyms = gymIds
    .map((gymId) => ({ gymId, gymName: names.get(gymId) ?? 'Unknown gym' }))
    .sort((a, b) => a.gymName.localeCompare(b.gymName));

  return {
    gyms,
    hasExpiredMembership: memberships.some((membership) => membership.state === 'expired'),
  };
}

// Capped inline preview for the Check In tab - fetches only `limit` rows
// plus the total count (in one request via count: 'exact') so the caller
// can decide whether to show a "View all" link without pulling the whole
// history (which can be 100+ rows for an active user).
export async function fetchRecentCheckIns(
  userId: string,
  limit: number
): Promise<{ entries: CheckInHistoryEntry[]; totalCount: number }> {
  const { data, error, count } = await supabase
    .from('gym_checkins')
    .select('id, gym_id, checked_in_at', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_valid', true)
    .order('checked_in_at', { ascending: false })
    .range(0, limit - 1);

  if (error) throw error;

  const rows = data ?? [];
  const names = await fetchGymNames(Array.from(new Set(rows.map((row) => row.gym_id))));

  return {
    entries: rows.map((row) => ({
      id: row.id,
      gymId: row.gym_id,
      gymName: names.get(row.gym_id) ?? 'Unknown gym',
      checkedInAt: row.checked_in_at,
    })),
    totalCount: count ?? rows.length,
  };
}

// Powers the full check-in history screen's infinite scroll. `hasMore` is
// inferred from a short page (no separate count query needed): if fewer
// rows than `limit` came back, there's nothing left to fetch.
export async function fetchCheckInHistoryPage(
  userId: string,
  offset: number,
  limit: number
): Promise<{ entries: CheckInHistoryEntry[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from('gym_checkins')
    .select('id, gym_id, checked_in_at')
    .eq('user_id', userId)
    .eq('is_valid', true)
    .order('checked_in_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const rows = data ?? [];
  const names = await fetchGymNames(Array.from(new Set(rows.map((row) => row.gym_id))));

  return {
    entries: rows.map((row) => ({
      id: row.id,
      gymId: row.gym_id,
      gymName: names.get(row.gym_id) ?? 'Unknown gym',
      checkedInAt: row.checked_in_at,
    })),
    hasMore: rows.length === limit,
  };
}

// month is 1-indexed (1 = January), matching the rest of this codebase's
// month handling. Scoped separately from the history fetchers above so the
// calendar can page through months without pulling all-time history.
export async function fetchCheckInDatesForMonth(
  userId: string,
  year: number,
  month: number
): Promise<string[]> {
  const { startIso, endIso } = monthRangeUtc(year, month);

  const { data, error } = await supabase
    .from('gym_checkins')
    .select('checked_in_at')
    .eq('user_id', userId)
    .eq('is_valid', true)
    .gte('checked_in_at', startIso)
    .lt('checked_in_at', endIso);

  if (error) throw error;
  return (data ?? []).map((row) => row.checked_in_at);
}

export async function fetchOverallCheckInSummary(userId: string): Promise<CheckInSummary> {
  const { data, error } = await supabase
    .from('gym_checkins')
    .select('checked_in_at')
    .eq('user_id', userId)
    .eq('is_valid', true);

  if (error) throw error;

  return computeCheckInStreak((data ?? []).map((row) => row.checked_in_at), APP_TIMEZONE);
}
