import { format, isToday } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { colors, spacing, type } from '@/constants/theme';
import type { Comment } from '@/types';
import { toDate } from '@/utils/date';

type Props = { comment: Comment };

/** One compact comment row for a post detail screen. */
export function CommentRow({ comment }: Props) {
  return (
    <View style={styles.row}>
      <Avatar name={comment.authorName} uri={comment.authorAvatarUrl || undefined} size="sm" />
      <View style={styles.copy}>
        <View style={styles.meta}>
          <Text style={styles.author} numberOfLines={1}>
            {comment.authorName}
          </Text>
          <Text style={styles.time}>{formatCommentTime(comment)}</Text>
        </View>
        <Text style={styles.text}>{comment.text}</Text>
      </View>
    </View>
  );
}

function formatCommentTime(comment: Comment): string {
  const date = toDate(comment.createdAt);
  if (!date) return 'Posting…';
  return isToday(date) ? format(date, 'h:mm a') : format(date, 'd MMM');
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
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
});
