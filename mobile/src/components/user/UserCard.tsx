import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { RatingStars } from '@/components/ui/RatingStars';
import { SkillChip } from '@/components/ui/SkillChip';
import { brand, colors, radius, sizes, spacing, type } from '@/constants/theme';
import type { User, UserRole } from '@/types';
import { plural } from '@/utils/format';
import type { PeerMatch } from '@/utils/peerMatch';

const MAX_VISIBLE_SKILLS = 3;

const ROLE_LABEL: Record<UserRole, string> = {
  teacher: 'Teacher',
  learner: 'Learner',
  both: 'Teaches & learns',
};

type Props = {
  user: User;
  onPress: () => void;
  /** Set when the viewer is learning: why this peer suits them. */
  match?: PeerMatch;
};

/** One Discovery row. Reads only denormalized fields, so no extra query per card. */
export function UserCard({ user, onPress, match }: Props) {
  const isMatch = !!match && match.score > 0;

  // Skills the viewer wants come first, so the reason for the match is visible.
  const matched = new Set<string>(match?.matchedTags ?? []);
  const skills = isMatch
    ? [
        ...user.skillsOffered.filter((skill) => matched.has(skill.skill)),
        ...user.skillsOffered.filter((skill) => !matched.has(skill.skill)),
      ]
    : user.skillsOffered;
  const visible = skills.slice(0, MAX_VISIBLE_SKILLS);
  const hidden = skills.length - visible.length;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${user.name}'s profile`}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card style={isMatch ? styles.matchCard : undefined}>
        <View style={styles.row}>
          <View style={[styles.avatarRing, isMatch && styles.avatarRingMatch]}>
            <Avatar name={user.name} uri={user.avatarUrl || undefined} />
          </View>

          <View style={styles.main}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {user.name}
              </Text>
              <View style={[styles.roleBadge, user.role !== 'learner' && styles.roleBadgeTeach]}>
                <Text
                  style={[styles.roleText, user.role !== 'learner' && styles.roleTextTeach]}
                  numberOfLines={1}>
                  {ROLE_LABEL[user.role]}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <RatingStars rating={user.ratingAvg} count={user.ratingCount} />
              {user.credentialCount > 0 ? (
                <View style={styles.inline}>
                  <Ionicons
                    name="document-text-outline"
                    size={sizes.iconSm}
                    color={colors.inkMuted}
                  />
                  <Text style={styles.meta}>{user.credentialCount}</Text>
                </View>
              ) : null}
            </View>

            {user.location ? (
              <View style={styles.inline}>
                <Ionicons name="location-outline" size={sizes.iconSm} color={colors.inkFaint} />
                <Text style={styles.meta} numberOfLines={1}>
                  {user.location}
                </Text>
              </View>
            ) : null}
          </View>

          <Ionicons name="chevron-forward" size={sizes.iconMd} color={colors.inkFaint} />
        </View>

        {isMatch ? (
          <View style={styles.matchLine}>
            <Ionicons name="sparkles" size={sizes.iconSm} color={colors.accent} />
            <Text style={styles.matchText} numberOfLines={2}>
              Teaches {plural(match.matchedLabels.length, 'skill')} you want:{' '}
              {match.matchedLabels.join(', ')}
            </Text>
          </View>
        ) : null}

        {visible.length > 0 ? (
          <View style={styles.skills}>
            {visible.map((skill) => (
              <SkillChip
                key={skill.skill}
                label={skill.label}
                level={skill.level}
                verified={skill.verified}
                credentialCount={skill.credentialCount}
              />
            ))}
            {hidden > 0 ? <Text style={styles.meta}>+{hidden} more</Text> : null}
          </View>
        ) : (
          <Text style={[styles.meta, styles.noSkills]}>
            Not offering any skills yet
            {user.skillsWanted.length > 0
              ? ` · wants to learn ${plural(user.skillsWanted.length, 'skill')}`
              : ''}
          </Text>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  matchCard: {
    borderColor: colors.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarRing: {
    padding: 2,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: brand.blue,
  },
  avatarRingMatch: {
    borderColor: brand.green,
  },
  main: {
    flex: 1,
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...type.bodyStrong,
    color: colors.ink,
    flexShrink: 1,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  roleBadgeTeach: {
    backgroundColor: colors.accentSurface,
  },
  roleText: {
    ...type.caption,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  roleTextTeach: {
    color: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  meta: {
    ...type.caption,
    color: colors.inkMuted,
  },
  matchLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSurface,
  },
  matchText: {
    ...type.label,
    color: colors.accent,
    flex: 1,
  },
  skills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  noSkills: {
    paddingTop: spacing.md,
  },
});
