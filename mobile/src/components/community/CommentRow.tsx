import { Ionicons } from '@expo/vector-icons';
import { format, isToday } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { COMMENT_REACTIONS } from '@/services/postService';
import type { Comment, CommentReaction } from '@/types';
import { toDate } from '@/utils/date';

type Props = {
  comment: Comment;
  currentUserId: string;
  isReply?: boolean;
  reacting?: boolean;
  onReply?: () => void;
  onReact?: (reaction: CommentReaction) => void;
};

/** A comment or one-level reply, with quick reactions and an optional Reply action. */
export function CommentRow({
  comment,
  currentUserId,
  isReply = false,
  reacting = false,
  onReply,
  onReact,
}: Props) {
  return (
    <View style={[styles.row, isReply && styles.replyRow]}>
      <Avatar name={comment.authorName} uri={comment.authorAvatarUrl || undefined} size="sm" />
      <View style={styles.copy}>
        <View style={styles.meta}>
          <Text style={styles.author} numberOfLines={1}>
            {comment.authorName}
          </Text>
          <Text style={styles.time}>{formatCommentTime(comment)}</Text>
        </View>
        <Text style={styles.text}>{comment.text}</Text>

        <View style={styles.actions}>
          {onReply ? (
            <Pressable
              onPress={onReply}
              accessibilityRole="button"
              accessibilityLabel={`Reply to ${comment.authorName}`}
              style={({ pressed }) => [styles.replyAction, pressed && styles.actionPressed]}>
              <Ionicons name="arrow-undo-outline" size={sizes.iconSm} color={colors.inkMuted} />
              <Text style={styles.replyLabel}>Reply</Text>
            </Pressable>
          ) : null}

          {COMMENT_REACTIONS.map((reaction) => {
            const count = comment.reactions?.[reaction.value]?.length ?? 0;
            const selected = comment.reactions?.[reaction.value]?.includes(currentUserId) ?? false;

            return (
              <Pressable
                key={reaction.value}
                onPress={() => onReact?.(reaction.value)}
                disabled={!onReact || reacting}
                accessibilityRole="button"
                accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${reaction.label} reaction`}
                accessibilityState={{ selected, busy: reacting }}
                style={({ pressed }) => [
                  styles.reaction,
                  selected && styles.reactionSelected,
                  pressed && !reacting && styles.actionPressed,
                  reacting && styles.actionDisabled,
                ]}>
                <Text style={styles.emoji}>{reaction.emoji}</Text>
                {count > 0 ? (
                  <Text style={[styles.reactionCount, selected && styles.reactionCountSelected]}>{count}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function formatCommentTime(comment: Comment): string {
  const date = toDate(comment.createdAt);
  if (!date) return 'Posting...';
  return isToday(date) ? format(date, 'h:mm a') : format(date, 'd MMM');
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  replyRow: {
    marginLeft: sizes.avatarSm + spacing.sm,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  author: {
    ...type.label,
    color: colors.ink,
    flex: 1,
  },
  time: {
    ...type.caption,
    color: colors.inkMuted,
  },
  text: {
    ...type.body,
    color: colors.ink,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  replyAction: {
    minHeight: sizes.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  replyLabel: {
    ...type.caption,
    color: colors.inkMuted,
  },
  reaction: {
    minHeight: sizes.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  reactionSelected: {
    backgroundColor: colors.accentSurface,
  },
  emoji: {
    fontSize: 14,
  },
  reactionCount: {
    ...type.caption,
    color: colors.inkMuted,
  },
  reactionCountSelected: {
    color: colors.accent,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionDisabled: {
    opacity: 0.5,
  },
});
