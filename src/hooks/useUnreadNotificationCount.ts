import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../context/auth-context';
import {
  fetchUnreadNotificationCount,
  subscribeToNotificationChanges,
} from '../lib/notifications';

// Unread in-app notification count for the signed-in user. There's no push, so
// it refreshes on sign-in, whenever the app returns to the foreground (the
// reminder job only runs once a day, so that's plenty), and immediately when
// the inbox marks something read.
export function useUnreadNotificationCount(): { count: number; refresh: () => Promise<void> } {
  const { session } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!session) {
      setCount(0);
      return;
    }
    try {
      setCount(await fetchUnreadNotificationCount());
    } catch {
      // Best-effort: a failed count just leaves the badge as it was.
    }
  }, [session]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribeToNotificationChanges(refresh);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [refresh]);

  return { count, refresh };
}
