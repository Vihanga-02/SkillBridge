import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ChatListRow } from '@/components/community/ChatListRow';
import { CommunityFeed } from '@/components/community/CommunityFeed';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { brand, colors, radius, sizes, spacing } from '@/constants/theme';
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

  // Unread conversations, not messages — the badge says how many chats need a look.
  const unreadChats = chats.filter((chat) => (chat.unreadCount?.[profile.uid] ?? 0) > 0).length;

  return (
    <View style={styles.screen}>
      <BrandHeader
        title="Community"
        subtitle="Share ideas and stay connected."
        action={
          <Pressable
            onPress={() => router.push('/leaderboard')}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel="Open the contributor leaderboard"
            style={({ pressed }) => [styles.headerAction, pressed && styles.headerActionPressed]}>
            <Ionicons name="trophy" size={sizes.iconMd} color={brand.yellow} />
          </Pressable>
        }>
        <SegmentedTabs
          tone="dark"
          accessibilityLabel="Community sections"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'feed', label: 'Feed', icon: 'newspaper-outline' },
            { value: 'chats', label: 'Chats', icon: 'chatbubbles-outline', badge: unreadChats },
          ]}
        />
      </BrandHeader>

      <View style={styles.body}>
        {activeTab === 'feed' ? (
          <CommunityFeed />
        ) : loadingChats ? (
          <LoadingState label="Loading chats…" />
        ) : chatError ? (
          <ErrorState message={chatError} onRetry={() => setRetryKey((current) => current + 1)} />
        ) : chats.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState
              icon="chatbubbles-outline"
              iconColor={brand.blue}
              title="No conversations yet"
              message="Find someone on Discover, open their profile and say hello — your chats will live here."
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  headerAction: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.onInk,
  },
  headerActionPressed: {
    backgroundColor: brand.onInkBorder,
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
