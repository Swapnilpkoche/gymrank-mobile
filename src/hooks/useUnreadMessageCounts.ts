import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../context/auth-context';
import { fetchUnreadMessageCounts, subscribeToMessageChanges } from '../lib/messages';

// Unread message counts for the signed-in user - same shape as
// useUnreadNotificationCount, but messages arrive at any time, so on top of
// refreshing on sign-in and app foreground it listens to Realtime inserts on
// `messages`, and to the thread screen marking a thread read.
export function useUnreadMessageCounts(): {
  total: number;
  byThread: Record<number, number>;
  refresh: () => Promise<void>;
} {
  const { session } = useAuth();
  const [byThread, setByThread] = useState<Record<number, number>>({});

  const refresh = useCallback(async () => {
    if (!session) {
      setByThread({});
      return;
    }
    try {
      setByThread(await fetchUnreadMessageCounts());
    } catch {
      // Best-effort: a failed count just leaves the badges as they were.
    }
  }, [session]);

  useEffect(() => {
    refresh();
    // Signed out there's nothing to count, so don't hold a Realtime channel open.
    const unsubscribe = session ? subscribeToMessageChanges(refresh) : () => {};
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [session, refresh]);

  const total = Object.values(byThread).reduce((sum, count) => sum + count, 0);
  return { total, byThread, refresh };
}
