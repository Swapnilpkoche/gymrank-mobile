import { supabase } from './supabase';
import { fetchPublicProfile } from './userFollows';
import type { Message, MessageThread, MessageThreadStatus } from '../types/database';

type RawThreadRow = {
  id: number;
  user_a: string;
  user_b: string;
  status: MessageThreadStatus;
  initiated_by: string;
  created_at: string;
  reported_at: string | null;
};

// profiles RLS only exposes your own row or an active gym staff member's row
// (see gymDetail.ts), so the other participant's display info has to come
// through get_public_profile - same reason fetchFollowedUsers does this.
async function toMessageThread(row: RawThreadRow, currentUserId: string): Promise<MessageThread> {
  const otherUserId = row.user_a === currentUserId ? row.user_b : row.user_a;
  const profile = await fetchPublicProfile(otherUserId);

  return {
    id: row.id,
    otherUserId,
    otherUserFullName: profile?.fullName ?? null,
    otherUserUsername: profile?.username ?? null,
    otherUserAvatarUrl: profile?.avatarUrl ?? null,
    status: row.status,
    initiatedByMe: row.initiated_by === currentUserId,
    createdAt: row.created_at,
    reportedAt: row.reported_at,
  };
}

export async function fetchMessageThreads(
  currentUserId: string
): Promise<{ pending: MessageThread[]; accepted: MessageThread[] }> {
  const { data, error } = await supabase
    .from('message_threads')
    .select('id, user_a, user_b, status, initiated_by, created_at, reported_at')
    .or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as RawThreadRow[];
  const threads = await Promise.all(rows.map((row) => toMessageThread(row, currentUserId)));

  return {
    pending: threads.filter((t) => t.status === 'pending'),
    accepted: threads.filter((t) => t.status === 'accepted'),
  };
}

export async function fetchMessageThread(
  threadId: number,
  currentUserId: string
): Promise<MessageThread | null> {
  const { data, error } = await supabase
    .from('message_threads')
    .select('id, user_a, user_b, status, initiated_by, created_at, reported_at')
    .eq('id', threadId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toMessageThread(data as RawThreadRow, currentUserId);
}

export type GetOrCreateThreadResult =
  | { kind: 'success'; threadId: number }
  | { kind: 'ineligible'; message: string }
  | { kind: 'error'; message: string };

// message_threads normalizes (user_a, user_b) into canonical order
// server-side (trg_enforce_message_thread_rules), so it doesn't matter which
// order this insert names them in. A duplicate pair just hits the unique
// constraint (23505), which is treated as "thread already exists" - fetch
// and return it instead of erroring, so tapping "Message" is idempotent.
export async function getOrCreateMessageThread(
  currentUserId: string,
  otherUserId: string
): Promise<GetOrCreateThreadResult> {
  const { data, error } = await supabase
    .from('message_threads')
    .insert({
      user_a: currentUserId,
      user_b: otherUserId,
      initiated_by: currentUserId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (!error) return { kind: 'success', threadId: data.id };

  if (error.code === '23505') {
    const { data: existing, error: fetchError } = await supabase
      .from('message_threads')
      .select('id')
      .or(
        `and(user_a.eq.${currentUserId},user_b.eq.${otherUserId}),and(user_a.eq.${otherUserId},user_b.eq.${currentUserId})`
      )
      .single();

    if (fetchError || !existing) {
      return {
        kind: 'error',
        message: fetchError?.message ?? 'Could not open this conversation.',
      };
    }
    return { kind: 'success', threadId: existing.id };
  }

  // Default SQLSTATE for a plain RAISE EXCEPTION (trg_enforce_message_thread_rules
  // has no custom code) is P0001 - same pattern as the follow/media/dob limits.
  if (error.code === 'P0001') {
    return { kind: 'ineligible', message: error.message };
  }

  return { kind: 'error', message: error.message };
}

export async function fetchThreadMessages(threadId: number): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, thread_id, sender_id, body, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
  }));
}

export type SendMessageResult =
  | { kind: 'success'; message: Message }
  | { kind: 'error'; message: string };

// trg_enforce_message_send_rules is the actual gate (participant-only,
// initiator-only-while-pending, both-still-adults) - this just surfaces
// whatever it decides via a clear message, same P0001 pattern as elsewhere.
export async function sendMessage(
  threadId: number,
  senderId: string,
  body: string
): Promise<SendMessageResult> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ thread_id: threadId, sender_id: senderId, body: body.trim() })
    .select('id, thread_id, sender_id, body, created_at')
    .single();

  if (error) return { kind: 'error', message: error.message };

  return {
    kind: 'success',
    message: {
      id: data.id,
      threadId: data.thread_id,
      senderId: data.sender_id,
      body: data.body,
      createdAt: data.created_at,
    },
  };
}

export type ThreadActionResult = { kind: 'success' } | { kind: 'error'; message: string };

// RLS (not this function) is what actually restricts this to the recipient
// of a still-pending thread - see "Recipient can accept or report a pending
// thread" in the add_messaging_phase4 migration.
export async function acceptMessageThread(threadId: number): Promise<ThreadActionResult> {
  const { error } = await supabase
    .from('message_threads')
    .update({ status: 'accepted' })
    .eq('id', threadId);

  if (error) return { kind: 'error', message: error.message };
  return { kind: 'success' };
}

export async function reportMessageThread(
  threadId: number,
  reason: string
): Promise<ThreadActionResult> {
  const { error } = await supabase
    .from('message_threads')
    .update({ report_reason: reason.trim(), reported_at: new Date().toISOString() })
    .eq('id', threadId);

  if (error) return { kind: 'error', message: error.message };
  return { kind: 'success' };
}

// Only the recipient can do this (RLS), in any status - initiators can never
// delete a thread they started.
export async function deleteMessageThread(threadId: number): Promise<void> {
  const { error } = await supabase.from('message_threads').delete().eq('id', threadId);
  if (error) throw error;
}
