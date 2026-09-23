import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MessageBubble } from '../../src/components/messages/MessageBubble';
import { ReportThreadModal } from '../../src/components/messages/ReportThreadModal';
import { useAuth } from '../../src/context/auth-context';
import { confirmDelete } from '../../src/lib/confirmations';
import {
  acceptMessageThread,
  deleteMessageThread,
  fetchMessageThread,
  fetchThreadMessages,
  reportMessageThread,
  sendMessage,
} from '../../src/lib/messages';
import { colors } from '../../src/theme/colors';
import type { Message, MessageThread } from '../../src/types/database';

export default function ThreadScreen() {
  const { threadId: threadIdParam } = useLocalSearchParams<{ threadId: string }>();
  const threadId = Number(threadIdParam);
  const { session } = useAuth();
  const router = useRouter();
  const listRef = useRef<FlatList<Message>>(null);

  const [thread, setThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const [threadData, messagesData] = await Promise.all([
        fetchMessageThread(threadId, session.user.id),
        fetchThreadMessages(threadId),
      ]);
      setThread(threadData);
      setMessages(messagesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this conversation.');
    }
    setIsLoading(false);
    // session is stable across the lifetime of this screen for a given user;
    // re-running on every session object identity change (e.g. token
    // refresh) would just reload the same data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || !session) return;
    setIsSending(true);
    try {
      const result = await sendMessage(threadId, session.user.id, trimmed);
      if (result.kind === 'success') {
        setMessages((prev) => [...prev, result.message]);
        setDraft('');
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      } else {
        Alert.alert('Could not send', result.message);
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleAccept() {
    setIsAccepting(true);
    try {
      const result = await acceptMessageThread(threadId);
      if (result.kind === 'success') {
        setThread((prev) => (prev ? { ...prev, status: 'accepted' } : prev));
      } else {
        Alert.alert('Something went wrong', result.message);
      }
    } finally {
      setIsAccepting(false);
    }
  }

  function handleDecline() {
    confirmDelete('request', async () => {
      try {
        await deleteMessageThread(threadId);
        router.back();
      } catch (err) {
        Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
      }
    });
  }

  async function handleReportSubmit(reason: string) {
    const result = await reportMessageThread(threadId, reason);
    setIsReportModalVisible(false);
    if (result.kind === 'success') {
      Alert.alert('Reported', "Thanks — we've recorded this report.");
    } else {
      Alert.alert('Something went wrong', result.message);
    }
  }

  if (!session || isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  if (error || !thread) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={styles.error}>{error ?? 'This conversation is not available.'}</Text>
      </View>
    );
  }

  const displayName = thread.otherUserFullName || thread.otherUserUsername || 'GymTrust member';
  // The initiator can always send. The recipient can only send once
  // accepted - see the design note in the chat response for why.
  const isPendingForRecipient = !thread.initiatedByMe && thread.status === 'pending';
  const canSend = thread.initiatedByMe || thread.status === 'accepted';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          title: displayName,
          headerRight: isPendingForRecipient
            ? () => (
                <Pressable onPress={() => setIsReportModalVisible(true)} hitSlop={8}>
                  <Feather name="flag" size={18} color={colors.textMuted} />
                </Pressable>
              )
            : undefined,
        }}
      />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <MessageBubble message={item} isMine={item.senderId === session.user.id} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {thread.initiatedByMe
              ? 'Say hello — they can reply once they accept.'
              : 'No messages yet.'}
          </Text>
        }
      />

      {isPendingForRecipient ? (
        <View style={styles.requestBar}>
          <Text style={styles.requestText}>{displayName} wants to message you.</Text>
          <View style={styles.requestButtons}>
            <Pressable style={styles.declineButton} onPress={handleDecline}>
              <Text style={styles.declineButtonText}>Decline</Text>
            </Pressable>
            <Pressable style={styles.acceptButton} onPress={handleAccept} disabled={isAccepting}>
              {isAccepting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : canSend ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message..."
            placeholderTextColor={colors.textMuted}
            multiline
            editable={!isSending}
          />
          <Pressable
            style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!draft.trim() || isSending}
          >
            <Feather name="arrow-up" size={18} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      <ReportThreadModal
        visible={isReportModalVisible}
        onClose={() => setIsReportModalVisible(false)}
        onSubmit={handleReportSubmit}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 16,
  },
  error: {
    color: '#f87171',
    textAlign: 'center',
  },
  messagesContent: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
  },
  requestBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 10,
  },
  requestText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  declineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    padding: 10,
  },
  composerInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
