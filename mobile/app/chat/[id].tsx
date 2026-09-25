import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { FILE_LIMITS } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';
import { useMediaPicker, type PickedFile } from '@/hooks/useMediaPicker';
import { markChatRead, sendMessage, subscribeToChat, subscribeToMessages } from '@/services/chatService';
import type { Chat, Message } from '@/types';
import { errorMessage } from '@/utils/authErrors';

export default function ChatThreadScreen() {
  const { id, participantName } = useLocalSearchParams<{ id: string; participantName?: string }>();
  const { profile } = useAuth();
  const isFocused = useIsFocused();
  const chatId = typeof id === 'string' ? id : '';
  const nameFromRoute = typeof participantName === 'string' ? participantName : '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [threadExists, setThreadExists] = useState<boolean | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [appState, setAppState] = useState(AppState.currentState);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<PickedFile | null>(null);
  const [sending, setSending] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const listRef = useRef<FlatList<Message>>(null);
  const { pickImage, error: mediaError, clearError: clearMediaError } = useMediaPicker();

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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (
      !profile ||
      !chat ||
      !chatId ||
      !isFocused ||
      appState !== 'active' ||
      (chat.unreadCount?.[profile.uid] ?? 0) === 0
    ) {
      return;
    }

    void markChatRead(chatId, profile.uid).catch((error: unknown) => {
      setThreadError(errorMessage(error));
    });
  }, [appState, chat, chatId, isFocused, profile]);

  const { otherParticipant, otherParticipantId } = useMemo(() => {
    const entry = Object.entries(chat?.participants ?? {}).find(([uid]) => uid !== profile?.uid);
    const [participantId, participant] = entry ?? [];

    return {
      otherParticipant: participant ?? { name: nameFromRoute || 'Direct message', avatarUrl: '' },
      otherParticipantId: participantId ?? null,
    };
  }, [chat, nameFromRoute, profile?.uid]);

  async function handleSend() {
    const text = draft.trim();
    const image = attachment;
    if (!profile || !chatId || (!text && !image) || sending) return;

    setThreadError(null);
    setSending(true);
    setDraft('');
    setAttachment(null);

    try {
      await sendMessage(
        chatId,
        profile,
        text,
        image ? { uri: image.uri, contentType: image.contentType } : undefined
      );
    } catch (error) {
      setDraft(text);
      setAttachment(image);
      setThreadError(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function handlePickImage() {
    if (sending || threadExists !== true) return;

    const image = await pickImage({ maxBytes: FILE_LIMITS.chatImage, quality: 0.75 });
    if (image) setAttachment(image);
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
  const canSend = (draft.trim().length > 0 || attachment !== null) && !sending && threadExists === true;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardSafe}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader
          title="Chat"
          subtitle={otherParticipant.name}
          showBack
          action={
            otherParticipantId ? (
              <Pressable
                onPress={() => router.push(`/user/${otherParticipantId}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${otherParticipant.name}'s profile`}
                style={styles.profileAction}>
                <Avatar
                  name={otherParticipant.name}
                  uri={otherParticipant.avatarUrl || undefined}
                  size="sm"
                />
              </Pressable>
            ) : (
              <Avatar name={otherParticipant.name} uri={otherParticipant.avatarUrl || undefined} size="sm" />
            )
          }
        />

        {threadError && !showFatalError ? (
          <View style={styles.notice}>
            <Notice tone="error" message={threadError} />
          </View>
        ) : null}
        {mediaError ? (
          <View style={styles.notice}>
            <Notice tone="error" message={mediaError} />
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
          {attachment ? (
            <View style={styles.attachmentPreview}>
              <Image source={{ uri: attachment.uri }} contentFit="cover" style={styles.attachmentImage} />
              <Pressable
                onPress={() => {
                  setAttachment(null);
                  clearMediaError();
                }}
                disabled={sending}
                accessibilityRole="button"
                accessibilityLabel="Remove attached image"
                style={styles.removeAttachment}>
                <Ionicons name="close" size={sizes.iconSm} color={colors.inkInverse} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.composerRow}>
            <Pressable
              onPress={() => void handlePickImage()}
              disabled={sending || threadExists !== true}
              accessibilityRole="button"
              accessibilityLabel="Attach image"
              style={({ pressed }) => [styles.attachButton, pressed && styles.attachPressed]}>
              <Ionicons name="image-outline" size={sizes.iconMd} color={colors.accent} />
            </Pressable>
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
  profileAction: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  attachmentPreview: {
    alignSelf: 'flex-start',
  },
  attachmentImage: {
    width: sizes.preview,
    height: sizes.preview,
    maxWidth: '100%',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  removeAttachment: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  attachButton: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accentSurface,
  },
  attachPressed: {
    backgroundColor: colors.surfaceAlt,
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
