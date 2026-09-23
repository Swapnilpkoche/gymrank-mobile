export function getCurrentHourInTimeZone(timeZone: string): number {
  const hourString = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date());

  return parseInt(hourString, 10);
}

export const APP_TIMEZONE = 'Asia/Kolkata';

// "24 Oct" - for a 'YYYY-MM-DD' calendar date or an instant, in the app's timezone.
export function formatDayMonth(dateOrIso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short',
  }).format(new Date(dateOrIso));
}

// "21 Sep 2026", in the app's timezone.
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

// "48 hours", "47 hours 12 minutes", "12 minutes" - rounds UP to the minute so
// a countdown never claims less wait than remains.
export function formatWaitDuration(totalSeconds: number): string {
  const totalMinutes = Math.max(1, Math.ceil(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  return parts.join(' ');
}

// Compact form for a button label: "48h", "47h", "35m".
export function formatWaitShort(totalSeconds: number): string {
  const totalMinutes = Math.max(1, Math.ceil(totalSeconds / 60));
  return totalMinutes >= 60 ? `${Math.ceil(totalMinutes / 60)}h` : `${totalMinutes}m`;
}

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

// Asia/Kolkata never observes DST, so its UTC offset is always +05:30 -
// safe to hardcode here rather than deriving it per-call.
const APP_TIMEZONE_UTC_OFFSET = '+05:30';

// UTC instant range for a given calendar month in APP_TIMEZONE, as
// [startIso, endIso) - suitable for a timestamptz `gte`/`lt` query.
export function monthRangeUtc(year: number, month: number): { startIso: string; endIso: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return {
    startIso: `${year}-${pad(month)}-01T00:00:00${APP_TIMEZONE_UTC_OFFSET}`,
    endIso: `${nextYear}-${pad(nextMonth)}-01T00:00:00${APP_TIMEZONE_UTC_OFFSET}`,
  };
}

// Pure calendar arithmetic on a 'YYYY-MM-DD' key: no instants, so neither the
// device's timezone nor DST can shift the result.
function previousDateKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

// Consecutive-day streak. Counts back from today in the given timezone; if
// today has no entry yet, counts back from yesterday instead - the streak is
// still alive until today ends, so it doesn't reset to 0 at midnight.
export function computeCheckInStreak(
  checkedInTimestamps: string[],
  timeZone: string
): { streakDays: number; totalDaysLogged: number } {
  const dateKeys = new Set(checkedInTimestamps.map((ts) => dateKeyInTimeZone(new Date(ts), timeZone)));
  const totalDaysLogged = dateKeys.size;

  let key = dateKeyInTimeZone(new Date(), timeZone);
  if (!dateKeys.has(key)) key = previousDateKey(key);

  let streakDays = 0;
  while (dateKeys.has(key)) {
    streakDays += 1;
    key = previousDateKey(key);
  }

  return { streakDays, totalDaysLogged };
}
