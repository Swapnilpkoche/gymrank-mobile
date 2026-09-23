import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ThreadRow } from '../src/components/messages/ThreadRow';
import { useAuth } from '../src/context/auth-context';
import { fetchMessageThreads } from '../src/lib/messages';
import { colors } from '../src/theme/colors';
import type { MessageThread } from '../src/types/database';

export default function MessagesScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [pending, setPending] = useState<MessageThread[]>([]);
  const [accepted, setAccepted] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) {
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await fetchMessageThreads(session.user.id);
      setPending(result.pending);
      setAccepted(result.accepted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your messages.');
    }
    setIsLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  function openThread(thread: MessageThread) {
    router.push({ pathname: '/messages/[threadId]', params: { threadId: String(thread.id) } });
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Messages' }} />
        <Feather name="message-circle" size={32} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Sign in to view your messages</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Messages' }} />
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.emerald} />
      }
    >
      <Stack.Screen options={{ title: 'Messages' }} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Requests</Text>
        {pending.length === 0 ? (
          <Text style={styles.empty}>No pending requests.</Text>
        ) : (
          pending.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} onPress={() => openThread(thread)} />
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conversations</Text>
        {accepted.length === 0 ? (
          <Text style={styles.empty}>No conversations yet.</Text>
        ) : (
          accepted.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} onPress={() => openThread(thread)} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.background,
    padding: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  primaryButton: {
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
