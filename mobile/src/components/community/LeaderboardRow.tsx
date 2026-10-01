import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { colors, radius, shadow, sizes, spacing, type } from '@/constants/theme';
import type { CommunityStats } from '@/types';

type Props = {
  entry: CommunityStats;
  rank: number;
  currentUserId: string;
  onOpenProfile: () => void;
};

const TOP_RANK_ICON: Partial<Record<number, keyof typeof Ionicons.glyphMap>> = {
  1: 'trophy',
  2: 'medal-outline',
  3: 'ribbon-outline',
};

function contributionSummary(entry: CommunityStats): string {
  const parts = [
    entry.postCount ? `${entry.postCount} ${entry.postCount === 1 ? 'post' : 'posts'}` : '',
    entry.commentCount ? `${entry.commentCount} ${entry.commentCount === 1 ? 'comment' : 'comments'}` : '',
    entry.replyCount ? `${entry.replyCount} ${entry.replyCount === 1 ? 'reply' : 'replies'}` : '',
  ].filter(Boolean);

  return parts.join(' · ') || 'Community contributor';
}

/** One accessible leaderboard result. Top-three and the signed-in user receive a clear visual emphasis. */
export function LeaderboardRow({ entry, rank, currentUserId, onOpenProfile }: Props) {
  const topRankIcon = TOP_RANK_ICON[rank];
  const isTopRank = Boolean(topRankIcon);
  const isCurrentUser = entry.userId === currentUserId;

  return (
    <Pressable
      onPress={onOpenProfile}
      accessibilityRole="button"
      accessibilityLabel={`Rank ${rank}, ${entry.name}, ${entry.communityScore} points. Open profile.`}
      style={({ pressed }) => [
        styles.row,
        isTopRank && styles.topRow,
        rank === 1 && styles.firstPlace,
        isCurrentUser && styles.currentUser,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.rank, isTopRank && styles.topRank, rank === 1 && styles.firstRank]}>
        {topRankIcon ? (
          <Ionicons
            name={topRankIcon}
            size={sizes.iconMd}
            color={rank === 1 ? colors.warning : colors.inkMuted}
          />
        ) : (
          <Text style={styles.rankText}>{rank}</Text>
        )}
      </View>

      <Avatar name={entry.name} uri={entry.avatarUrl || undefined} size="md" />

      <View style={styles.copy}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.name}
          </Text>
          {isCurrentUser ? <Text style={styles.you}>You</Text> : null}
        </View>
        <Text style={styles.summary} numberOfLines={1}>
          {contributionSummary(entry)}
        </Text>
      </View>

      <View style={styles.score}>
        <Text style={styles.scoreValue}>{entry.communityScore}</Text>
        <Text style={styles.scoreLabel}>points</Text>
      </View>

      <Ionicons name="chevron-forward" size={sizes.iconSm} color={colors.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.control + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  topRow: {
    borderColor: colors.accent,
  },
  firstPlace: {
    backgroundColor: colors.accentSurface,
  },
  currentUser: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.76,
  },
  rank: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  topRank: {
    backgroundColor: colors.accentSurface,
  },
  firstRank: {
    backgroundColor: colors.surface,
  },
  rankText: {
    ...type.bodyStrong,
    color: colors.inkMuted,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...type.bodyStrong,
    flexShrink: 1,
    color: colors.ink,
  },
  you: {
    ...type.caption,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    color: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  summary: {
    ...type.caption,
    color: colors.inkMuted,
  },
  score: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    ...type.h2,
    color: colors.accent,
  },
  scoreLabel: {
    ...type.caption,
    color: colors.inkMuted,
  },
});
