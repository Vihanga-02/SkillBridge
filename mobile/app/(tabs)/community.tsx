import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatListRow } from '@/components/community/ChatListRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToMyChats } from '@/services/chatService';
import type { Chat } from '@/types';
import { errorMessage } from '@/utils/authErrors';

type CommunityTab = 'feed' | 'chats';

/** Community home. The feed is wired for its later post flow; the chat inbox is live now. */
export default function CommunityScreen() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<CommunityTab>('chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!profile) return;

    setLoadingChats(true);
    setChatError(null);

    return subscribeToMyChats(
      profile.uid,
      (nextChats) => {
        setChats(nextChats);
        setLoadingChats(false);
      },
      (error) => {
        setChatError(errorMessage(error));
        setLoadingChats(false);
      }
    );
  }, [profile, retryKey]);

  if (!profile) {
    return <LoadingState fullScreen label="Loading community…" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Community" subtitle="Share ideas and stay connected." />

      <View style={styles.tabBar} accessibilityRole="tablist">
        <CommunityTabButton
          label="Feed"
          selected={activeTab === 'feed'}
          onPress={() => setActiveTab('feed')}
        />
        <CommunityTabButton
          label="Chats"
          selected={activeTab === 'chats'}
          onPress={() => setActiveTab('chats')}
        />
      </View>

      {activeTab === 'feed' ? (
        <FeedPending />
      ) : loadingChats ? (
        <LoadingState label="Loading chats…" />
      ) : chatError ? (
        <ErrorState message={chatError} onRetry={() => setRetryKey((current) => current + 1)} />
      ) : chats.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            icon="chatbubbles-outline"
            title="No conversations yet"
            message="Open a member's profile and send them a message to start a chat."
            actionLabel="Discover members"
            onAction={() => router.push('/discovery')}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.chatList} showsVerticalScrollIndicator={false}>
          {chats.map((chat) => {
            const otherUserId = chat.participantIds.find((uid) => uid !== profile.uid);
            const otherParticipant = otherUserId ? chat.participants?.[otherUserId] : undefined;

            return (
              <ChatListRow
                key={chat.id}
                chat={chat}
                currentUserId={profile.uid}
                onPress={() =>
                  router.push({
                    pathname: '/chat/[id]',
                    params: { id: chat.id, participantName: otherParticipant?.name || 'Direct message' },
                  })
                }
              />
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function CommunityTabButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} tab`}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, selected && styles.tabSelected, pressed && styles.tabPressed]}>
      <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function FeedPending() {
  return (
    <View style={styles.empty}>
      <EmptyState
        icon="newspaper-outline"
        title="Community posts are next"
        message="Tips, questions and achievements will appear here once the post feed is ready."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  tab: {
    flex: 1,
    minHeight: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  tabSelected: {
    backgroundColor: colors.surface,
  },
  tabPressed: {
    backgroundColor: colors.accentSurface,
  },
  tabText: {
    ...type.bodyStrong,
    color: colors.inkMuted,
  },
  tabTextSelected: {
    color: colors.accent,
  },
  chatList: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
