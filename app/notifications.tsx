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

import { useAuth } from '../src/context/auth-context';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyNotificationsChanged,
} from '../src/lib/notifications';
import { formatShortDate } from '../src/lib/time';
import { colors } from '../src/theme/colors';
import type { AppNotification } from '../src/types/database';

export default function NotificationsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
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
      setItems(await fetchNotifications());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
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

  const unreadCount = items.filter((item) => item.readAt === null).length;

  // Optimistic: flip it read straight away, then tell the badge; if the write
  // fails the next load puts it back. Either way the gym opens.
  async function handleOpen(item: AppNotification) {
    if (item.readAt === null) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: now } : n)));
      markNotificationRead(item.id)
        .catch(() => {})
        .finally(notifyNotificationsChanged);
    }
    router.push({ pathname: '/gym/[id]', params: { id: String(item.gymId) } });
  }

  async function handleMarkAllRead() {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.readAt === null ? { ...n, readAt: now } : n)));
    try {
      await markAllNotificationsRead();
    } catch {
      await load();
    }
    notifyNotificationsChanged();
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Sign in to see your notifications.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.emerald}
        />
      }
    >
      <Stack.Screen options={{ title: 'Notifications' }} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {unreadCount > 0 ? (
        <Pressable style={styles.markAll} onPress={handleMarkAllRead} hitSlop={8}>
          <Feather name="check-circle" size={14} color={colors.emeraldLight} />
          <Text style={styles.markAllText}>Mark all as read ({unreadCount})</Text>
        </Pressable>
      ) : null}

      {items.length === 0 && !error ? (
        <View style={styles.empty}>
          <Feather name="bell" size={28} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            We&apos;ll let you know here when a gym membership of yours is about to end.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((item) => {
            const unread = item.readAt === null;
            const isExpired = item.kind === 'membership_expired';
            return (
              <Pressable
                key={item.id}
                style={[styles.card, unread && styles.cardUnread]}
                onPress={() => handleOpen(item)}
              >
                <View style={styles.dotColumn}>
                  {unread ? <View style={styles.unreadDot} /> : null}
                </View>
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <Feather
                      name={isExpired ? 'alert-circle' : 'clock'}
                      size={14}
                      color={isExpired ? '#f87171' : '#fbbf24'}
                    />
                    <Text style={[styles.title, unread && styles.titleUnread]}>{item.title}</Text>
                  </View>
                  <Text style={[styles.text, unread && styles.textUnread]}>{item.body}</Text>
                  <Text style={styles.time}>{formatShortDate(item.createdAt)}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      )}
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
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
  },
  markAllText: {
    color: colors.emeraldLight,
    fontWeight: '600',
    fontSize: 13,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  list: {
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 6,
  },
  cardUnread: {
    borderColor: colors.emerald,
    backgroundColor: '#052e1f',
  },
  dotColumn: {
    width: 14,
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.emerald,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  titleUnread: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  text: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  textUnread: {
    color: colors.textPrimary,
  },
  time: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
