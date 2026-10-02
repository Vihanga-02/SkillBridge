import { Ionicons } from '@expo/vector-icons';
import { format, isToday } from 'date-fns';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { SkillChip } from '@/components/ui/SkillChip';
import { skillLabel } from '@/constants/skills';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import type { Post } from '@/types';
import { toDate } from '@/utils/date';
import { plural } from '@/utils/format';

type Props = {
  post: Post;
  currentUserId: string;
  onOpen?: () => void;
  onOpenAuthor?: () => void;
  onToggleLike: () => void;
  liking?: boolean;
};

const POST_META: Record<Post['type'], { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  achievement: { label: 'Achievement', icon: 'trophy-outline' },
  tip: { label: 'Tip', icon: 'bulb-outline' },
  question: { label: 'Question', icon: 'help-circle-outline' },
};

/** A feed card with a single post, like action and link into its comments. */
export function PostCard({
  post,
  currentUserId,
  onOpen,
  onOpenAuthor,
  onToggleLike,
  liking = false,
}: Props) {
  const meta = POST_META[post.type];
  const liked = post.likedBy?.includes(currentUserId) ?? false;

  return (
    <Card padded={false}>
      <Pressable
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? 'button' : undefined}
        accessibilityLabel={onOpen ? `Open ${meta.label.toLowerCase()} by ${post.authorName}` : undefined}
        style={({ pressed }) => [styles.content, pressed && onOpen && styles.pressed]}>
        <View style={styles.header}>
          <Pressable
            onPress={onOpenAuthor}
            disabled={!onOpenAuthor}
            accessibilityRole={onOpenAuthor ? 'button' : undefined}
            accessibilityLabel={onOpenAuthor ? `Open ${post.authorName}'s profile` : undefined}
            style={styles.author}>
            <Avatar name={post.authorName} uri={post.authorAvatarUrl || undefined} size="sm" />
            <View style={styles.authorCopy}>
              <Text style={styles.authorName} numberOfLines={1}>
                {post.authorName}
              </Text>
              <Text style={styles.time}>{formatPostTime(post)}</Text>
            </View>
          </Pressable>

          <View style={styles.typePill}>
            <Ionicons name={meta.icon} size={sizes.iconSm} color={colors.accent} />
            <Text style={styles.typeText}>{meta.label}</Text>
          </View>
        </View>

        <Text style={styles.body}>{post.text}</Text>
        {post.imageUrl ? (
          <Image
            source={{ uri: post.imageUrl }}
            contentFit="cover"
            accessibilityLabel={`Image attached to ${meta.label.toLowerCase()} by ${post.authorName}`}
            style={styles.image}
          />
        ) : null}
        {post.skillTag ? <SkillChip label={skillLabel(post.skillTag)} /> : null}
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={onToggleLike}
          disabled={liking}
          accessibilityRole="button"
          accessibilityLabel={`${liked ? 'Unlike' : 'Like'} this post`}
          accessibilityState={{ selected: liked, busy: liking }}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed, liking && styles.disabled]}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={sizes.iconMd}
            color={liked ? colors.danger : colors.inkMuted}
          />
          <Text style={[styles.actionText, liked && styles.likedText]}>{plural(post.likeCount ?? 0, 'like')}</Text>
        </Pressable>

        <Pressable
          onPress={onOpen}
          disabled={!onOpen}
          accessibilityRole="button"
          accessibilityLabel="Open comments"
          style={({ pressed }) => [styles.action, pressed && onOpen && styles.actionPressed]}>
          <Ionicons name="chatbubble-outline" size={sizes.iconMd} color={colors.inkMuted} />
          <Text style={styles.actionText}>{plural(post.commentCount ?? 0, 'comment')}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function formatPostTime(post: Post): string {
  const date = toDate(post.createdAt);
  if (!date) return 'Posting…';
  return isToday(date) ? format(date, 'h:mm a') : format(date, 'd MMM');
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  author: {
    flex: 1,
    minHeight: sizes.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  authorCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  authorName: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  time: {
    ...type.caption,
    color: colors.inkMuted,
  },
  typePill: {
    minHeight: sizes.avatarSm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.accentSurface,
  },
  typeText: {
    ...type.caption,
    color: colors.accent,
  },
  body: {
    ...type.body,
    color: colors.ink,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  action: {
    minHeight: sizes.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionText: {
    ...type.label,
    color: colors.inkMuted,
  },
  likedText: {
    color: colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
});
