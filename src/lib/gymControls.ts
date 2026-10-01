import { supabase } from './supabase';

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
