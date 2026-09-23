import { fetchMyMemberships, isCurrentMemberState } from './memberships';
import { supabase } from './supabase';
import { APP_TIMEZONE, computeCheckInStreak } from './time';
import type {
  BusyHour,
  CheckInSummary,
  Gym,
  GymDetail,
  GymReview,
  LocationOption,
  TeamMember,
} from '../types/database';

const GYM_TIMEZONE = APP_TIMEZONE;

type RawGymDetailRow = Omit<Gym, 'city' | 'state' | 'country'> & {
  city: string | null;
  state: string | null;
  country: string | null;
  gym_locations: {
    id: number;
    is_primary: boolean;
    localities: {
      name: string;
      cities: {
        name: string;
        states: { name: string; countries: { name: string } | null } | null;
      } | null;
    } | null;
  }[];
};

function resolveLocationNames(row: RawGymDetailRow) {
  const primaryLocation = row.gym_locations.find((l) => l.is_primary) ?? row.gym_locations[0];
  const city = primaryLocation?.localities?.cities;
  const state = city?.states;
  const country = state?.countries;

  return {
    locationId: primaryLocation?.id ?? null,
    city: city?.name ?? row.city,
    state: state?.name ?? row.state,
    country: country?.name ?? row.country,
  };
}

async function fetchHeroPhoto(gymId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('gym_media')
    .select('role, url, sort_order')
    .eq('gym_id', gymId)
    .in('role', ['hero', 'gallery'])
    .order('sort_order', { ascending: true });

  if (error) throw error;

  const hero = data?.find((row) => row.role === 'hero');
  return hero?.url ?? data?.[0]?.url ?? null;
}

export async function fetchGymDetail(gymId: number): Promise<GymDetail | null> {
  const { data, error } = await supabase
    .from('gyms')
    .select(
      `id, name, slug, description, status, verification_status, location, city, state, country, category, latitude, longitude,
      gym_locations ( id, is_primary, localities ( name, cities ( name, states ( name, countries ( name ) ) ) ) )`
    )
    .eq('id', gymId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as RawGymDetailRow;
  const { locationId, city, state, country } = resolveLocationNames(row);
  const photoUrl = await fetchHeroPhoto(gymId);

  let avgRating: number | null = null;
  let reviewCount = 0;

  if (locationId !== null) {
    const { data: statsData, error: statsError } = await supabase.rpc('get_location_stats', {
      p_location_id: locationId,
    });
    if (statsError) throw statsError;
    const stats = statsData?.[0];
    if (stats && Number(stats.total_reviews) > 0) {
      avgRating = Number(stats.avg_rating);
      reviewCount = Number(stats.total_reviews);
    }
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    verification_status: row.verification_status,
    location: row.location,
    category: row.category,
    latitude: row.latitude,
    longitude: row.longitude,
    city,
    state,
    country,
    locationId,
    photoUrl,
    avgRating,
    reviewCount,
  };
}

export async function fetchIsEligibleVisitor(gymId: number, userId: string): Promise<boolean> {
  const [memberships, staffResult, checkinResult] = await Promise.all([
    // "Is a member" now means approved AND not past the last day of their
    // current term (or a legacy member with no term) - resolved server-side,
    // so an expired member no longer counts here. Own rows only.
    fetchMyMemberships(gymId),
    supabase
      .from('gym_staff')
      .select('id')
      .eq('gym_id', gymId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('gym_checkins')
      .select('id')
      .eq('gym_id', gymId)
      .eq('user_id', userId)
      .eq('is_valid', true)
      .limit(1)
      .maybeSingle(),
  ]);

  if (staffResult.error) throw staffResult.error;
  if (checkinResult.error) throw checkinResult.error;

  const isMember = memberships.some((membership) => isCurrentMemberState(membership.state));
  return Boolean(isMember || staffResult.data || checkinResult.data);
}

export async function fetchBusyHours(gymId: number): Promise<BusyHour[]> {
  const { data, error } = await supabase.rpc('get_gym_busy_hours', {
    target_gym_id: gymId,
    target_timezone: GYM_TIMEZONE,
  });
  if (error) throw error;

  const counts = new Array(24).fill(0);
  for (const row of data ?? []) {
    counts[row.hour_of_day] = Number(row.checkin_count);
  }

  return counts.map((count, hour) => ({ hour, count }));
}

export async function fetchCheckInSummary(gymId: number, userId: string): Promise<CheckInSummary> {
  const { data, error } = await supabase
    .from('gym_checkins')
    .select('checked_in_at')
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .eq('is_valid', true);

  if (error) throw error;

  return computeCheckInStreak((data ?? []).map((row) => row.checked_in_at), GYM_TIMEZONE);
}

export async function fetchEquipment(gymId: number): Promise<LocationOption[]> {
  const { data, error } = await supabase.from('gym_equipment').select('id, name').eq('gym_id', gymId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchAmenities(gymId: number): Promise<LocationOption[]> {
  const { data, error } = await supabase.from('gym_amenities').select('id, name').eq('gym_id', gymId);
  if (error) throw error;
  return data ?? [];
}

// gym_reviews.user_id references auth.users, not public.profiles directly, so
// PostgREST can't auto-embed profiles under it (no direct FK). Fetch profiles
// separately and merge in JS.
//
// profiles RLS only exposes a user's own row, so reviewers resolve to nothing
// (by design) - callers fall back to a generic display name for those.
async function fetchProfilesByIds(
  userIds: string[]
): Promise<Map<string, { full_name: string | null; username: string | null; avatar_url: string | null }>> {
  const map = new Map<string, { full_name: string | null; username: string | null; avatar_url: string | null }>();
  if (userIds.length === 0) return map;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', userIds);

  if (error) throw error;

  for (const row of data ?? []) {
    map.set(row.id, { full_name: row.full_name, username: row.username, avatar_url: row.avatar_url });
  }
  return map;
}

// Mirrors is_gym_admin()'s own logic (owner/admin, active) - gym_staff rows
// for active staff are publicly selectable, so this is a plain client-side
// check, not an RPC call.
export async function fetchIsGymAdmin(gymId: number, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('gym_staff')
    .select('id')
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

type RawTeamRow = {
  staff_id: number;
  staff_user_id: string;
  staff_role: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  has_trainer_profile: boolean;
};

// get_gym_team is a SECURITY DEFINER RPC returning only safe public fields
// (name, username, avatar) for a gym's active staff, owner first. It replaces
// reading other users' rows straight from profiles, which RLS no longer
// allows.
export async function fetchTeam(gymId: number): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc('get_gym_team', { p_gym_id: gymId });
  if (error) throw error;

  return ((data ?? []) as RawTeamRow[]).map((row) => ({
    id: row.staff_id,
    userId: row.staff_user_id,
    role: row.staff_role,
    displayName: row.full_name || row.username || 'GymTrust member',
    avatarUrl: row.avatar_url,
    hasTrainerProfile: row.has_trainer_profile,
  }));
}

export async function fetchReviews(gymId: number): Promise<GymReview[]> {
  const { data, error } = await supabase
    .from('gym_reviews')
    .select('id, user_id, rating, title, review_text, is_verified_visit, created_at')
    .eq('gym_id', gymId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(rows.map((row) => row.user_id));

  return rows.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      rating: Number(row.rating),
      title: row.title,
      reviewText: row.review_text,
      isVerifiedVisit: row.is_verified_visit,
      createdAt: row.created_at,
      reviewerName: profile?.full_name ?? profile?.username ?? 'GymTrust member',
    };
  });
}

export async function fetchIsFollowing(gymId: number, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('gym_followers')
    .select('id')
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function toggleFollow(gymId: number, userId: string, isFollowing: boolean): Promise<void> {
  if (isFollowing) {
    const { error } = await supabase
      .from('gym_followers')
      .delete()
      .eq('gym_id', gymId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('gym_followers').insert({ gym_id: gymId, user_id: userId });
    if (error) throw error;
  }
}

export type RequestJoinResult =
  | { kind: 'success' }
  | { kind: 'duplicate'; message: string }
  | { kind: 'error'; message: string };

// gym_members has a UNIQUE (gym_id, user_id) constraint, so a second
// request hits a 23505 violation - look up the existing row to give a
// status-appropriate message instead of a generic failure.
export async function requestJoinAsMember(gymId: number, userId: string): Promise<RequestJoinResult> {
  const { error } = await supabase
    .from('gym_members')
    .insert({ gym_id: gymId, user_id: userId, status: 'pending' });

  if (!error) return { kind: 'success' };
  if (error.code !== '23505') {
    return { kind: 'error', message: error.message };
  }

  const { data: existing, error: fetchError } = await supabase
    .from('gym_members')
    .select('id, status')
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { kind: 'duplicate', message: "You've already requested to join this gym." };
  }

  if (existing.status === 'pending') {
    return { kind: 'duplicate', message: 'Your request to join is still pending approval.' };
  }
  if (existing.status === 'active') {
    return { kind: 'duplicate', message: "You're already a member of this gym." };
  }
  if (existing.status === 'removed') {
    return {
      kind: 'duplicate',
      message: 'You were removed from this gym. Contact the gym directly to rejoin.',
    };
  }

  // status === 'rejected' - let them try again. RLS only lets gym admins
  // transition a row's status, but a user can delete their own rejected
  // row, so retry as delete-then-reinsert rather than an update.
  const { error: deleteError } = await supabase.from('gym_members').delete().eq('id', existing.id);
  if (deleteError) return { kind: 'error', message: deleteError.message };

  const { error: reinsertError } = await supabase
    .from('gym_members')
    .insert({ gym_id: gymId, user_id: userId, status: 'pending' });
  if (reinsertError) return { kind: 'error', message: reinsertError.message };

  return { kind: 'success' };
}

// Preview only - drives the "Verified visit" hint in the review form. The badge
// itself is computed by the database when the review is saved (a valid
// check-in must exist for this user + gym), so this mirrors that rule: only
// VALID check-ins count. It used to count any check-in, invalid ones included,
// which is how an unearned badge got sent.
export async function fetchHasGymCheckIn(gymId: number, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('gym_checkins')
    .select('id')
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .eq('is_valid', true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export type SubmitGymReviewInput = {
  gymId: number;
  locationId: number;
  userId: string;
  rating: number;
  title: string | null;
  reviewText: string | null;
  equipmentRating: number | null;
  cleanlinessRating: number | null;
  staffRating: number | null;
  crowdRating: number | null;
  valueRating: number | null;
};

export type SubmitGymReviewResult =
  | { kind: 'success' }
  | { kind: 'blocked'; message: string }
  | { kind: 'duplicate' }
  | { kind: 'error'; message: string };

// The gym_reviews_gym_id_user_id_key unique constraint (one review per
// user per gym) and the trg_moderate_gym_review trigger (banned-word/spam
// rejection, and forcing status to 'published' on everything else) already
// live in the DB - this just maps their failure modes to UI-friendly results.
const BANNED_WORDS_MESSAGE =
  "Your review contains language that isn't allowed. Please revise and resubmit.";

export async function submitGymReview(input: SubmitGymReviewInput): Promise<SubmitGymReviewResult> {
  const { error } = await supabase.from('gym_reviews').insert({
    gym_id: input.gymId,
    location_id: input.locationId,
    user_id: input.userId,
    rating: input.rating,
    title: input.title,
    review_text: input.reviewText,
    equipment_rating: input.equipmentRating,
    cleanliness_rating: input.cleanlinessRating,
    staff_rating: input.staffRating,
    crowd_rating: input.crowdRating,
    value_rating: input.valueRating,
    // is_verified_visit is deliberately NOT sent: the database computes it
    // (trg_set_gym_review_verified_visit) and discards anything supplied here.
  });

  if (!error) return { kind: 'success' };
  if (error.message.includes(BANNED_WORDS_MESSAGE)) {
    return { kind: 'blocked', message: BANNED_WORDS_MESSAGE };
  }
  if (error.code === '23505') {
    return { kind: 'duplicate' };
  }
  // The insert policy rejects reviews from active staff of the gym (any role).
  // The UI hides the button for them, so this only surfaces on a stale screen
  // (e.g. approved as a trainer while this gym page was already open).
  if (error.code === '42501') {
    return {
      kind: 'error',
      message: "You're on this gym's team, so you can't review it.",
    };
  }
  return { kind: 'error', message: error.message };
}
