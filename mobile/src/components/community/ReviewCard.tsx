import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { RatingStars } from '@/components/ui/RatingStars';
import { SkillChip } from '@/components/ui/SkillChip';
import { skillLabel } from '@/constants/skills';
import { colors, spacing, type } from '@/constants/theme';
import { REVIEW_TAGS } from '@/services/reviewService';
import type { Review } from '@/types';
import { formatDate } from '@/utils/date';

type Props = {
  review: Review;
};

const TAG_LABELS = new Map<string, string>(REVIEW_TAGS.map((tag) => [tag.value, tag.label]));

const reviewTagLabel = (tag: string): string =>
  TAG_LABELS.get(tag) ?? tag.replace(/-/g, ' ');

/** One public learner-to-teacher review, including its rating and optional feedback tags. */
export function ReviewCard({ review }: Props) {
  return (
    <Card>
      <View style={styles.header}>
        <Avatar
          name={review.fromUserName}
          uri={review.fromUserAvatarUrl || undefined}
          size="sm"
        />

        <View style={styles.author}>
          <Text style={styles.name} numberOfLines={1}>
            {review.fromUserName}
          </Text>
          <RatingStars rating={review.rating} count={1} />
        </View>

        <Text style={styles.date}>{formatDate(review.createdAt)}</Text>
      </View>

      <SkillChip label={skillLabel(review.skillTag)} />

      {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}

      {review.tags?.length ? (
        <View style={styles.tags}>
          {review.tags.map((tag) => (
            <Chip key={tag} label={reviewTagLabel(tag)} size="sm" />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  author: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  date: {
    ...type.caption,
    color: colors.inkMuted,
  },
  comment: {
    ...type.body,
    color: colors.ink,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
