import { Ionicons } from '@expo/vector-icons';
import { format, isToday } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import type { Chat } from '@/types';
import { toDate } from '@/utils/date';

type Props = {
  chat: Chat;
  currentUserId: string;
  onPress: () => void;
};

/** A compact, accessible row for one direct conversation in the chat inbox. */
export function ChatListRow({ chat, currentUserId, onPress }: Props) {
  const otherUserId = chat.participantIds.find((uid) => uid !== currentUserId);
  const otherParticipant = otherUserId ? chat.participants?.[otherUserId] : undefined;
  const name = otherParticipant?.name || 'Direct message';
  const preview = chat.lastMessage.trim() || 'Start a conversation';
  const unread = Math.max(0, chat.unreadCount?.[currentUserId] ?? 0);

  return (
    <Card onPress={onPress} padded={false} accessibilityLabel={`Open chat with ${name}`}>
      <View style={styles.row}>
        <Avatar name={name} uri={otherParticipant?.avatarUrl || undefined} size="md" />

        <View style={styles.copy}>
          <View style={styles.topLine}>
            <Text style={[styles.name, unread > 0 && styles.unreadText]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.time, unread > 0 && styles.unreadText]}>{formatChatTime(chat)}</Text>
          </View>

          <View style={styles.bottomLine}>
            <Text style={[styles.preview, unread > 0 && styles.unreadText]} numberOfLines={1}>
              {chat.lastSenderId === currentUserId && chat.lastMessage ? `You: ${preview}` : preview}
            </Text>
            {unread > 0 ? (
              <View style={styles.badge} accessibilityLabel={`${unread} unread messages`}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={sizes.iconMd} color={colors.inkFaint} />
      </View>
    </Card>
  );
}

function formatChatTime(chat: Chat): string {
  const date = toDate(chat.lastMessageAt ?? chat.createdAt);
  if (!date) return 'New';
  return isToday(date) ? format(date, 'h:mm a') : format(date, 'd MMM');
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...type.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
  time: {
    ...type.caption,
    color: colors.inkMuted,
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    ...type.body,
    color: colors.inkMuted,
    flex: 1,
  },
  unreadText: {
    color: colors.ink,
    fontWeight: '700',
  },
  badge: {
    minWidth: sizes.iconMd,
    height: sizes.iconMd,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  badgeText: {
    ...type.caption,
    color: colors.inkInverse,
    fontWeight: '700',
  },
});
