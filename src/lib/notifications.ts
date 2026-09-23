import { supabase } from './supabase';
import type { AppNotification, NotificationKind } from '../types/database';

// In-app notifications. There's no push infrastructure: the daily job writes
// rows to `notifications` and this reads them. RLS scopes every query to the
// caller's own rows, and clients may only update read_at (column-level grant).

type RawNotificationRow = {
  id: number;
  gym_id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, gym_id, kind, title, body, created_at, read_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as RawNotificationRow[]).map((row) => ({
    id: row.id,
    gymId: row.gym_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: number): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}

// Tiny pub/sub so the tab-bar badge and the Profile button refresh the moment
// the inbox marks something read, rather than waiting for the next foreground.
const listeners = new Set<() => void>();

export function notifyNotificationsChanged(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToNotificationChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
