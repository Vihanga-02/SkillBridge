import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MessageBubble } from '@/components/community/MessageBubble';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { sendMessage, subscribeToChat, subscribeToMessages } from '@/services/chatService';
import type { ChatParticipant, Message } from '@/types';
import { errorMessage } from '@/utils/authErrors';

export default function ChatThreadScreen() {
  const { id, participantName } = useLocalSearchParams<{ id: string; participantName?: string }>();
  const { profile } = useAuth();
  const chatId = typeof id === 'string' ? id : '';
  const nameFromRoute = typeof participantName === 'string' ? participantName : '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<{
    participants: Record<string, ChatParticipant>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [threadExists, setThreadExists] = useState<boolean | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (!chatId) return;

    setLoading(true);
    setThreadError(null);
    setThreadExists(null);

    const unsubscribeChat = subscribeToChat(
      chatId,
      (nextChat) => {
        setChat(nextChat);
        setThreadExists(nextChat !== null);
      },
      (error) => {
        setThreadError(errorMessage(error));
        setThreadExists(false);
      }
    );
    const unsubscribeMessages = subscribeToMessages(
      chatId,
      (nextMessages) => {
        setMessages(nextMessages);
        setLoading(false);
      },
      (error) => {
        setThreadError(errorMessage(error));
        setLoading(false);
      }
    );

    return () => {
      unsubscribeChat();
      unsubscribeMessages();
    };
  }, [chatId, retryKey]);

  const otherParticipant = useMemo(() => {
    const participant = Object.entries(chat?.participants ?? {}).find(([uid]) => uid !== profile?.uid)?.[1];
    return participant ?? { name: nameFromRoute || 'Direct message', avatarUrl: '' };
  }, [chat, nameFromRoute, profile?.uid]);

  async function handleSend() {
    const text = draft.trim();
    if (!profile || !chatId || !text || sending) return;

    setThreadError(null);
    setSending(true);
    setDraft('');

    try {
      await sendMessage(chatId, profile, text);
    } catch (error) {
      setDraft(text);
      setThreadError(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  if (!profile) {
    return <LoadingState fullScreen label="Loading your chat…" />;
  }

  if (!chatId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Chat" showBack />
        <ErrorState message="This chat link is incomplete." />
      </SafeAreaView>
    );
  }

  const showUnavailable = threadExists === false && !threadError;
  const showFatalError = !!threadError && messages.length === 0;
  const canSend = draft.trim().length > 0 && !sending && threadExists === true;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardSafe}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader
          title="Chat"
          subtitle={otherParticipant.name}
          showBack
          action={<Avatar name={otherParticipant.name} uri={otherParticipant.avatarUrl || undefined} size="sm" />}
        />

        {threadError && !showFatalError ? (
          <View style={styles.notice}>
            <Notice tone="error" message={threadError} />
          </View>
        ) : null}

        {loading ? (
          <LoadingState label="Loading messages…" />
        ) : showFatalError ? (
          <ErrorState
            message={threadError}
            onRetry={() => setRetryKey((current) => current + 1)}
          />
        ) : showUnavailable ? (
          <ErrorState message="This conversation is no longer available." />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(message) => message.id}
            renderItem={({ item }) => <MessageBubble message={item} isMine={item.senderId === profile.uid} />}
            contentContainerStyle={[styles.messages, messages.length === 0 && styles.messagesEmpty]}
            ListEmptyComponent={
              <EmptyState
                icon="chatbubbles-outline"
                title="Start the conversation"
                message={`Send ${otherParticipant.name} a message to begin.`}
              />
            }
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Message ${otherParticipant.name}`}
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel="Write a message"
            autoCapitalize="sentences"
            autoCorrect
            multiline
            editable={!sending && threadExists === true}
            style={styles.input}
          />
          <Button
            label="Send"
            onPress={() => void handleSend()}
            loading={sending}
            disabled={!canSend}
            style={styles.sendButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardSafe: {
    flex: 1,
  },
  notice: {
    paddingHorizontal: spacing.lg,
  },
  messages: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  messagesEmpty: {
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: sizes.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    color: colors.ink,
    ...type.body,
    textAlignVertical: 'center',
  },
  sendButton: {
    alignSelf: 'flex-end',
   },
});
