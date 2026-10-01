import { supabase } from './supabase';
import type { GymControlSettings, OwnedGymControls } from '../types/database';

export type GymRequestKind = 'member' | 'trainer';

// What the requester can see of a gym before sending a join/trainer request.
// The gym_members / gym_staff INSERT policies are the real gate (they require
// the gym's accepting_* flag), but a failed WITH CHECK only comes back as a
// bare 42501 - it can't say WHY. So the request flows read the flags first
// and pick the message from this, rather than parsing the RLS error.
//  - 'unavailable': no row visible - gyms RLS only shows active gyms (plus
//    the caller's own), so this is a draft/suspended/closed gym.
//  - 'not_accepting': the owner has switched this kind of request off.
export type GymRequestAvailability = 'accepting' | 'not_accepting' | 'unavailable';

export const GYM_UNAVAILABLE_MESSAGE = "This gym isn't available right now.";

export function notAcceptingMessage(kind: GymRequestKind, gymName?: string): string {
  const who = gymName ?? 'This gym';
  return kind === 'member'
    ? `${who} isn't accepting new member requests right now.`
    : `${who} isn't accepting trainer requests right now.`;
}

export async function fetchGymRequestAvailability(
  gymId: number,
  kind: GymRequestKind
): Promise<GymRequestAvailability> {
  const { data, error } = await supabase
    .from('gyms')
    .select('status, accepting_join_requests, accepting_trainer_requests')
    .eq('id', gymId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.status !== 'active') return 'unavailable';
  const accepting =
    kind === 'member' ? data.accepting_join_requests : data.accepting_trainer_requests;
  return accepting ? 'accepting' : 'not_accepting';
}

type RawOwnedGymRow = {
  gym_id: number;
  gyms: {
    name: string;
    is_discoverable: boolean;
    accepting_join_requests: boolean;
    accepting_trainer_requests: boolean;
  } | null;
};

// Every gym the caller is an ACTIVE owner/admin of (the same people
// set_gym_controls / is_gym_admin accept), with its controls and how many
// requests are waiting. Pending counts come from rows the caller can already
// read as an admin: gym_members ("Gym staff can view their gym's members") and
// gym_staff ("Staff can view their gym's team" - all statuses for admins).
export async function fetchOwnedGymControls(userId: string): Promise<OwnedGymControls[]> {
  const { data, error } = await supabase
    .from('gym_staff')
    .select('gym_id, gyms(name, is_discoverable, accepting_join_requests, accepting_trainer_requests)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin']);

  if (error) throw error;

  // Same to-one-embedded-as-array caveat as gyms.ts (no generated types).
  // A gym whose row isn't visible (e.g. an admin of a non-active gym they
  // didn't create) has nothing to control here, so it's dropped.
  const rows = ((data ?? []) as unknown as RawOwnedGymRow[]).filter((row) => row.gyms);
  const gymIds = rows.map((row) => row.gym_id);
  if (gymIds.length === 0) return [];

  const [memberRequests, trainerRequests] = await Promise.all([
    supabase.from('gym_members').select('gym_id').in('gym_id', gymIds).eq('status', 'pending'),
    supabase
      .from('gym_staff')
      .select('gym_id')
      .in('gym_id', gymIds)
      .eq('status', 'pending')
      .eq('role', 'trainer'),
  ]);
  if (memberRequests.error) throw memberRequests.error;
  if (trainerRequests.error) throw trainerRequests.error;

  const countBy = (list: { gym_id: number }[] | null) => {
    const counts = new Map<number, number>();
    for (const row of list ?? []) counts.set(row.gym_id, (counts.get(row.gym_id) ?? 0) + 1);
    return counts;
  };
  const memberCounts = countBy(memberRequests.data);
  const trainerCounts = countBy(trainerRequests.data);

  return rows
    .map((row) => ({
      gymId: row.gym_id,
      gymName: row.gyms!.name,
      isDiscoverable: row.gyms!.is_discoverable,
      acceptingJoinRequests: row.gyms!.accepting_join_requests,
      acceptingTrainerRequests: row.gyms!.accepting_trainer_requests,
      pendingMemberRequests: memberCounts.get(row.gym_id) ?? 0,
      pendingTrainerRequests: trainerCounts.get(row.gym_id) ?? 0,
    }))
    .sort((a, b) => a.gymName.localeCompare(b.gymName));
}

// set_gym_controls refuses anyone but an active owner/admin of the gym.
// Omitted fields are sent as null, which the RPC leaves unchanged.
export async function setGymControls(
  gymId: number,
  changes: Partial<GymControlSettings>
): Promise<GymControlSettings> {
  const { data, error } = await supabase.rpc('set_gym_controls', {
    p_gym_id: gymId,
    p_is_discoverable: changes.isDiscoverable ?? null,
    p_accepting_join_requests: changes.acceptingJoinRequests ?? null,
    p_accepting_trainer_requests: changes.acceptingTrainerRequests ?? null,
  });

  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row) throw new Error("Couldn't update this gym's controls.");
  return {
    isDiscoverable: row.is_discoverable,
    acceptingJoinRequests: row.accepting_join_requests,
    acceptingTrainerRequests: row.accepting_trainer_requests,
  };
}
