import { supabase } from './supabase';
import { APP_TIMEZONE, dateKeyInTimeZone } from './time';
import type {
  AvailabilitySlot,
  GymUpcomingSession,
  SessionBooking,
  SessionBookingStatus,
} from '../types/database';

// Trainer session booking. Availability slots are written directly (RLS: own
// rows, only while an active trainer at that gym); bookings are read-only to
// the client and every change goes through the request/respond/cancel RPCs,
// which also write the notifications.

// How far ahead a session can be booked. The server allows up to today + 28;
// the picker offers today plus the next 27 days (exactly four weeks of dates).
export const BOOKING_WINDOW_DAYS = 28;

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Postgres `time` comes back as 'HH:MM:SS'; the app works in 'HH:MM'.
function toHourMinute(value: string): string {
  return value.slice(0, 5);
}

// '07:00' -> '7:00 AM'
export function formatSlotTime(hhmm: string): string {
  const [hourText, minute] = hhmm.split(':');
  const hour = Number(hourText);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${suffix}`;
}

// 'YYYY-MM-DD' -> 0..6 (Sunday = 0). Pure calendar arithmetic, so neither the
// device timezone nor DST can shift it.
export function dayOfWeekForDateKey(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// 'YYYY-MM-DD' -> 'Wed 21 Oct'
export function formatSessionDate(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function todayKey(): string {
  return dateKeyInTimeZone(new Date(), APP_TIMEZONE);
}

// 'HH:MM' right now in the app's timezone.
function nowHourMinute(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

// Whether a session date/time is still ahead of now (IST).
export function isUpcoming(sessionDate: string, startTime: string): boolean {
  const today = todayKey();
  if (sessionDate !== today) return sessionDate > today;
  return startTime > nowHourMinute();
}

export type BookableDay = { date: string; times: string[] };

// Every date in the booking window that has at least one open slot: the
// trainer's active weekly slots for that weekday, minus times already
// confirmed for someone else, minus times already past today.
export function buildBookableDays(
  slots: AvailabilitySlot[],
  booked: { sessionDate: string; startTime: string }[]
): BookableDay[] {
  const today = todayKey();
  const now = nowHourMinute();
  const bookedKeys = new Set(booked.map((b) => `${b.sessionDate} ${b.startTime}`));
  const days: BookableDay[] = [];

  for (let offset = 0; offset < BOOKING_WINDOW_DAYS; offset += 1) {
    const date = addDaysToKey(today, offset);
    const dow = dayOfWeekForDateKey(date);
    const times = slots
      .filter((slot) => slot.isActive && slot.dayOfWeek === dow)
      .map((slot) => slot.startTime)
      .filter((time) => !bookedKeys.has(`${date} ${time}`))
      .filter((time) => date !== today || time > now)
      .sort();
    if (times.length > 0) days.push({ date, times });
  }

  return days;
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

type RawSlotRow = {
  id: number;
  trainer_id: string;
  gym_id: number;
  day_of_week: number;
  start_time: string;
  is_active: boolean;
};

function mapSlot(row: RawSlotRow): AvailabilitySlot {
  return {
    id: row.id,
    trainerId: row.trainer_id,
    gymId: row.gym_id,
    dayOfWeek: row.day_of_week,
    startTime: toHourMinute(row.start_time),
    isActive: row.is_active,
  };
}

// A trainer's slots, optionally for one gym. RLS hides slots at gyms the
// trainer has left (except from the trainer themselves).
export async function fetchAvailabilitySlots(
  trainerId: string,
  gymId?: number
): Promise<AvailabilitySlot[]> {
  let query = supabase
    .from('trainer_availability_slots')
    .select('id, trainer_id, gym_id, day_of_week, start_time, is_active')
    .eq('trainer_id', trainerId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });
  if (gymId !== undefined) query = query.eq('gym_id', gymId);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as RawSlotRow[]).map(mapSlot);
}

export type SlotMutationResult = { kind: 'success' } | { kind: 'error'; message: string };

export async function addAvailabilitySlot(input: {
  trainerId: string;
  gymId: number;
  dayOfWeek: number;
  startTime: string;
}): Promise<SlotMutationResult> {
  const { error } = await supabase.from('trainer_availability_slots').insert({
    trainer_id: input.trainerId,
    gym_id: input.gymId,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
  });

  if (!error) return { kind: 'success' };
  if (error.code === '23505') {
    return { kind: 'error', message: 'You already have that slot at this gym.' };
  }
  if (error.code === '42501') {
    return { kind: 'error', message: "You can only add slots at gyms where you're an active trainer." };
  }
  return { kind: 'error', message: error.message };
}

export async function removeAvailabilitySlot(slotId: number): Promise<SlotMutationResult> {
  const { error } = await supabase.from('trainer_availability_slots').delete().eq('id', slotId);
  if (error) return { kind: 'error', message: error.message };
  return { kind: 'success' };
}

// Upcoming confirmed times for a trainer at a gym - dates/times only, never
// who booked them.
export async function fetchBookedSlots(
  trainerId: string,
  gymId: number
): Promise<{ sessionDate: string; startTime: string }[]> {
  const { data, error } = await supabase.rpc('get_trainer_booked_slots', {
    p_trainer_id: trainerId,
    p_gym_id: gymId,
  });
  if (error) throw error;
  return ((data ?? []) as { session_date: string; start_time: string }[]).map((row) => ({
    sessionDate: row.session_date,
    startTime: toHourMinute(row.start_time),
  }));
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

// Same shape as messaging's eligibility result, so the screens can show a
// minor the "only available to adults" message the same way.
export type SessionActionResult =
  | { kind: 'success' }
  | { kind: 'ineligible'; message: string }
  | { kind: 'error'; message: string };

function toActionResult(error: { code?: string; message: string } | null): SessionActionResult {
  if (!error) return { kind: 'success' };
  if (error.code === '42501') return { kind: 'ineligible', message: error.message };
  return { kind: 'error', message: error.message };
}

export async function checkCanBookSessions(userId: string): Promise<SessionActionResult> {
  const { data, error } = await supabase.rpc('is_adult', { profile_id: userId });
  if (error) return { kind: 'error', message: error.message };
  if (data !== true) {
    return {
      kind: 'ineligible',
      message:
        "Booking a session is only available to adults (18+). If you're over 18, add your date of birth in your profile first.",
    };
  }
  return { kind: 'success' };
}

export async function requestTrainerSession(input: {
  trainerId: string;
  gymId: number;
  sessionDate: string;
  startTime: string;
  note: string;
}): Promise<SessionActionResult> {
  const { error } = await supabase.rpc('request_trainer_session', {
    p_trainer_id: input.trainerId,
    p_gym_id: input.gymId,
    p_session_date: input.sessionDate,
    p_start_time: input.startTime,
    p_note: input.note.trim() || null,
  });
  return toActionResult(error);
}

export async function respondTrainerSession(
  bookingId: number,
  decision: 'confirmed' | 'declined'
): Promise<SessionActionResult> {
  const { error } = await supabase.rpc('respond_trainer_session', {
    p_booking_id: bookingId,
    p_decision: decision,
  });
  return toActionResult(error);
}

export async function cancelTrainerSession(bookingId: number): Promise<SessionActionResult> {
  const { error } = await supabase.rpc('cancel_trainer_session', { p_booking_id: bookingId });
  return toActionResult(error);
}

type RawMySessionRow = {
  booking_id: number;
  is_trainer: boolean;
  other_user_id: string;
  other_name: string;
  gym_id: number;
  gym_name: string;
  session_date: string;
  start_time: string;
  status: SessionBookingStatus;
  note: string | null;
  created_at: string;
};

// Both sides of the caller's bookings, from a week ago onward.
export async function fetchMySessions(): Promise<SessionBooking[]> {
  const { data, error } = await supabase.rpc('get_my_trainer_sessions');
  if (error) throw error;
  return ((data ?? []) as RawMySessionRow[]).map((row) => ({
    id: row.booking_id,
    isTrainer: row.is_trainer,
    otherUserId: row.other_user_id,
    otherName: row.other_name,
    gymId: row.gym_id,
    gymName: row.gym_name,
    sessionDate: row.session_date,
    startTime: toHourMinute(row.start_time),
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
  }));
}

type RawGymSessionRow = {
  booking_id: number;
  session_date: string;
  start_time: string;
  trainer_id: string;
  trainer_name: string;
  requester_id: string;
  requester_name: string;
};

// Owner/admin only (the RPC checks is_gym_admin).
export async function fetchGymUpcomingSessions(gymId: number): Promise<GymUpcomingSession[]> {
  const { data, error } = await supabase.rpc('get_gym_upcoming_sessions', { p_gym_id: gymId });
  if (error) throw error;
  return ((data ?? []) as RawGymSessionRow[]).map((row) => ({
    id: row.booking_id,
    sessionDate: row.session_date,
    startTime: toHourMinute(row.start_time),
    trainerId: row.trainer_id,
    trainerName: row.trainer_name,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
  }));
}
