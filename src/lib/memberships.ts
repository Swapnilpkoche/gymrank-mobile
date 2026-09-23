import { supabase } from './supabase';
import { formatDayMonth } from './time';
import type {
  GymPlanType,
  MemberRequest,
  MembershipState,
  MyMembership,
  OwnerMember,
  OwnerMemberState,
  OwnerMembersData,
  TermPreview,
} from '../types/database';

// GymTrust records what a member is paid up to - it processes no payments. Owners
// record a term after being paid at the gym. Every date here is an IST calendar
// date computed by the database (today, end dates, days left, expiry); the app
// only formats them.

export const PLAN_OPTIONS: { value: GymPlanType; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-yearly' },
  { value: 'annual', label: 'Annual' },
];

export function planLabel(plan: GymPlanType | null): string {
  if (!plan) return 'No plan set';
  return PLAN_OPTIONS.find((option) => option.value === plan)?.label ?? plan;
}

// A member whose membership currently counts: approved and not past the last
// day of their current term (or a legacy member with no term yet).
export function isCurrentMemberState(state: MembershipState | null | undefined): boolean {
  return state === 'active' || state === 'expiring_soon' || state === 'no_plan';
}

function pluralDays(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

// "Ends 24 Oct · 12 days left", "Ends today", "Ended 12 Sep · 9 days ago".
export function endsLabel(endDate: string | null, daysLeft: number | null): string {
  if (!endDate || daysLeft === null) return 'No plan set';
  const when = formatDayMonth(endDate);
  if (daysLeft < 0) return `Ended ${when} · ${pluralDays(-daysLeft)} ago`;
  if (daysLeft === 0) return `Ends today (${when})`;
  return `Ends ${when} · ${pluralDays(daysLeft)} left`;
}

// ---- calendar-date plumbing for the start-date picker ----
// The picker chooses a calendar DATE, not an instant, so this is plain
// year/month/day - no time-zone maths involved.
export function isoToLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function localDateToIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---- reads ----

type RawMyMembershipRow = {
  gym_id: number;
  gym_name: string;
  member_id: number;
  member_status: string;
  state: MembershipState;
  plan_type: GymPlanType | null;
  start_date: string | null;
  end_date: string | null;
  days_left: number | null;
  reminder_window_days: number | null;
};

// The caller's OWN memberships (any status), or just one gym's. This is how the
// app decides "am I a member here?" - it can't read term dates for anyone else,
// so expiry is resolved server-side and only the caller's own result comes back.
export async function fetchMyMemberships(gymId?: number): Promise<MyMembership[]> {
  const { data, error } = await supabase.rpc('get_my_memberships', { p_gym_id: gymId ?? null });
  if (error) throw error;

  return ((data ?? []) as RawMyMembershipRow[]).map((row) => ({
    gymId: row.gym_id,
    gymName: row.gym_name,
    memberId: row.member_id,
    memberStatus: row.member_status,
    state: row.state,
    planType: row.plan_type,
    startDate: row.start_date,
    endDate: row.end_date,
    daysLeft: row.days_left,
    reminderWindowDays: row.reminder_window_days,
  }));
}

type RawOwnerMember = {
  member_id: number;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  plan_type: GymPlanType | null;
  start_date: string | null;
  end_date: string | null;
  days_left: number | null;
  state: OwnerMemberState;
};

type RawMemberRequest = {
  member_id: number;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  requested_at: string;
};

type RawOwnerMembers = {
  today: string;
  summary: {
    active: number;
    expiring_soon: number;
    expiring_within_7_days: number;
    expired: number;
    no_plan: number;
    by_plan: Record<GymPlanType, number>;
  };
  members: RawOwnerMember[];
  requests: RawMemberRequest[];
};

// Owner/admin only - the RPC returns an error to anyone else.
export async function fetchOwnerMembers(gymId: number): Promise<OwnerMembersData> {
  const { data, error } = await supabase.rpc('get_gym_members_for_owner', { p_gym_id: gymId });
  if (error) throw error;

  const raw = data as RawOwnerMembers;
  return {
    today: raw.today,
    summary: {
      active: raw.summary.active,
      expiringSoon: raw.summary.expiring_soon,
      expiringWithin7Days: raw.summary.expiring_within_7_days,
      expired: raw.summary.expired,
      noPlan: raw.summary.no_plan,
      byPlan: raw.summary.by_plan,
    },
    members: raw.members.map(
      (row): OwnerMember => ({
        memberId: row.member_id,
        userId: row.user_id,
        fullName: row.full_name,
        username: row.username,
        avatarUrl: row.avatar_url,
        planType: row.plan_type,
        startDate: row.start_date,
        endDate: row.end_date,
        daysLeft: row.days_left,
        state: row.state,
      })
    ),
    requests: raw.requests.map(
      (row): MemberRequest => ({
        memberId: row.member_id,
        userId: row.user_id,
        fullName: row.full_name,
        username: row.username,
        avatarUrl: row.avatar_url,
        requestedAt: row.requested_at,
      })
    ),
  };
}

type RawTermPreview = { term_start_date: string; term_end_date: string; today: string };

// What confirming would record. With a memberId (renewal) the default start
// honours the current term (no days lost); without one (approval) it's today.
export async function previewMemberTerm(
  plan: GymPlanType,
  startDate: string | null,
  memberId: number | null
): Promise<TermPreview> {
  const { data, error } = await supabase.rpc('preview_member_term', {
    p_plan_type: plan,
    p_start_date: startDate,
    p_member_id: memberId,
  });
  if (error) throw error;

  const row = (data as RawTermPreview[] | null)?.[0];
  if (!row) throw new Error('Could not work out the membership dates.');
  return { startDate: row.term_start_date, endDate: row.term_end_date, today: row.today };
}

// ---- writes (all authorization lives in the RPCs; messages are user-safe) ----

export type MemberActionResult = { kind: 'success' } | { kind: 'error'; message: string };

export async function approveMemberRequest(
  memberId: number,
  plan: GymPlanType,
  startDate: string | null
): Promise<MemberActionResult> {
  const { error } = await supabase.rpc('approve_gym_member_request', {
    p_member_id: memberId,
    p_plan_type: plan,
    p_start_date: startDate,
  });
  return error ? { kind: 'error', message: error.message } : { kind: 'success' };
}

export async function rejectMemberRequest(memberId: number): Promise<MemberActionResult> {
  const { error } = await supabase.rpc('reject_gym_member_request', { p_member_id: memberId });
  return error ? { kind: 'error', message: error.message } : { kind: 'success' };
}

// Also how a legacy member (no term) gets their first plan. With no start date
// the server starts the term the day after the current one ends, or today if
// that has already passed - an early renewal loses no days.
export async function renewMember(
  memberId: number,
  plan: GymPlanType,
  startDate: string | null = null
): Promise<MemberActionResult> {
  const { error } = await supabase.rpc('renew_gym_member', {
    p_member_id: memberId,
    p_plan_type: plan,
    p_start_date: startDate,
  });
  return error ? { kind: 'error', message: error.message } : { kind: 'success' };
}
