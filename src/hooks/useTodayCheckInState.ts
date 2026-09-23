import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { LatestValidCheckIn } from '../lib/checkin';
import { APP_TIMEZONE, dateKeyInTimeZone } from '../lib/time';

// 'here' - today's valid check-in (checkin_to_gym enforces once per day
// GLOBALLY, across all gyms) was at THIS gym.
// 'elsewhere' - today's valid check-in was at a DIFFERENT gym - the button
// must not claim a check-in happened here, only that none can right now.
// 'none' - no valid check-in yet today; the normal active button.
export type TodayCheckInState = 'here' | 'elsewhere' | 'none';

// Re-derived on a timer and on app-foreground (not just once on mount) so
// this flips back to 'none' right after midnight Asia/Kolkata without a
// refetch or app restart - the underlying timestamp never changes, only
// which day it's on.
export function useTodayCheckInState(
  latestValidCheckIn: LatestValidCheckIn | null,
  gymId: number
): TodayCheckInState {
  const [todayKey, setTodayKey] = useState(() => dateKeyInTimeZone(new Date(), APP_TIMEZONE));

  useEffect(() => {
    const recompute = () => setTodayKey(dateKeyInTimeZone(new Date(), APP_TIMEZONE));
    const interval = setInterval(recompute, 60_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') recompute();
    });
    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, []);

  if (!latestValidCheckIn) return 'none';
  const isToday =
    dateKeyInTimeZone(new Date(latestValidCheckIn.checkedInAt), APP_TIMEZONE) === todayKey;
  if (!isToday) return 'none';
  return latestValidCheckIn.gymId === gymId ? 'here' : 'elsewhere';
}
