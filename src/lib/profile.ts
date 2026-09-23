import { endsLabel, fetchMyMemberships, isCurrentMemberState } from './memberships';
import { supabase } from './supabase';
import type { FollowedGym, Gender, MyGymRelationship, Profile } from '../types/database';

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, bio, city, phone_number, gender, date_of_birth, dob_edit_count')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    username: data.username,
    avatarUrl: data.avatar_url,
    bio: data.bio,
    city: data.city,
    phoneNumber: data.phone_number,
    gender: data.gender as Gender | null,
    dateOfBirth: data.date_of_birth,
    dobEditCount: data.dob_edit_count,
  };
}

// Just the piece of profile state the app-wide DOB backfill prompt needs -
// cheaper than fetching (and mapping) the whole Profile shape just to check
// one column.
export async function fetchDateOfBirth(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('date_of_birth')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.date_of_birth ?? null;
}

export type UpdateProfileInput = {
  fullName: string | null;
  username: string | null;
  bio: string | null;
  city: string | null;
  phoneNumber: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
};

export type UpdateProfileResult =
  | { kind: 'success' }
  | { kind: 'duplicate_username' }
  | { kind: 'error'; message: string };

// profiles.username has a UNIQUE constraint - map that violation to a
// specific message rather than a raw DB error, same pattern used for
// gym_reviews/gym_members duplicate handling. A date_of_birth rejection
// (under the minimum age, or the 2-edit cap reached) comes back as the
// trigger's own P0001 message, which is already clear enough to show
// as-is via the 'error' branch below.
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<UpdateProfileResult> {
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: input.fullName,
      username: input.username,
      bio: input.bio,
      city: input.city,
      phone_number: input.phoneNumber,
      gender: input.gender,
      date_of_birth: input.dateOfBirth,
    })
    .eq('id', userId);

  if (!error) return { kind: 'success' };
  if (error.code === '23505') return { kind: 'duplicate_username' };
  return { kind: 'error', message: error.message };
}

export type UpdateDateOfBirthResult = { kind: 'success' } | { kind: 'error'; message: string };

// Narrow, single-column update for the DOB backfill prompt - it only ever
// knows about date_of_birth, so it must not go through updateProfile's
// full-object update (which would null out every other field it doesn't
// have loaded).
export async function updateDateOfBirth(
  userId: string,
  dateOfBirth: string
): Promise<UpdateDateOfBirthResult> {
  const { error } = await supabase
    .from('profiles')
    .update({ date_of_birth: dateOfBirth })
    .eq('id', userId);

  if (!error) return { kind: 'success' };
  return { kind: 'error', message: error.message };
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(uri.split('?')[0]);
  return match ? match[1] : 'jpg';
}

// Path is prefixed with the user's own id to satisfy the avatars bucket's
// storage policies (INSERT/UPDATE both require storage.foldername(name)[1]
// = auth.uid()). A timestamped filename (rather than a fixed one) avoids
// stale-CDN-cache issues on re-upload.
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const blob = await uriToBlob(localUri);
  const path = `${userId}/avatar-${Date.now()}.${extensionFromUri(localUri)}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob);
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);
  if (updateError) throw updateError;

  return avatarUrl;
}

type RawFollowedGymRow = {
  gym_id: number;
  gyms: { name: string } | null;
};

export async function fetchFollowedGyms(userId: string): Promise<FollowedGym[]> {
  const { data, error } = await supabase
    .from('gym_followers')
    .select('gym_id, followed_at, gyms(name)')
    .eq('user_id', userId)
    .order('followed_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawFollowedGymRow[];
  return rows.map((row) => ({
    gymId: row.gym_id,
    gymName: row.gyms?.name ?? 'Unknown gym',
  }));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type RawGymStaffRow = {
  gym_id: number;
  role: string;
  gyms: { name: string } | null;
};

export async function fetchMyGymRelationships(userId: string): Promise<MyGymRelationship[]> {
  const [staffResult, memberships] = await Promise.all([
    supabase
      .from('gym_staff')
      .select('gym_id, role, gyms(name)')
      .eq('user_id', userId)
      .eq('status', 'active'),
    // Own memberships with their state resolved server-side. Anyone approved
    // but past their term is kept in the list, labelled, so they can find the
    // gym to renew at - they just no longer count as a current member.
    fetchMyMemberships(),
  ]);

  if (staffResult.error) throw staffResult.error;

  const staffRows = (staffResult.data ?? []) as unknown as RawGymStaffRow[];

  const staffRelationships: MyGymRelationship[] = staffRows.map((row) => ({
    gymId: row.gym_id,
    gymName: row.gyms?.name ?? 'Unknown gym',
    label: capitalize(row.role),
  }));

  // A gym already covered by a staff role isn't also listed as a plain
  // membership, in the rare case a user holds both rows for the same gym.
  const staffGymIds = new Set(staffRelationships.map((r) => r.gymId));

  const memberRelationships: MyGymRelationship[] = memberships
    .filter(
      (membership) =>
        !staffGymIds.has(membership.gymId) &&
        (isCurrentMemberState(membership.state) || membership.state === 'expired')
    )
    .map((membership) => ({
      gymId: membership.gymId,
      gymName: membership.gymName,
      label: membership.state === 'expired' ? 'Membership ended' : 'Member',
      // While inside the plan's reminder window (decided server-side), say
      // when it ends right on the row - the same warning the daily reminder gives.
      note:
        membership.state === 'expiring_soon'
          ? endsLabel(membership.endDate, membership.daysLeft)
          : undefined,
    }));

  return [...staffRelationships, ...memberRelationships].sort((a, b) =>
    a.gymName.localeCompare(b.gymName)
  );
}
