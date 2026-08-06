import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { RatingStars } from '@/components/ui/RatingStars';
import { SkillChip } from '@/components/ui/SkillChip';
import { colors, sizes, spacing, type } from '@/constants/theme';
import type { User } from '@/types';
import { plural } from '@/utils/format';

const MAX_VISIBLE_SKILLS = 3;

type Props = {
  user: User;
  onPress: () => void;
};

/** One Discovery row. Reads only denormalized fields, so no extra query per card. */
export function UserCard({ user, onPress }: Props) {
  const visible = user.skillsOffered.slice(0, MAX_VISIBLE_SKILLS);
  const hidden = user.skillsOffered.length - visible.length;

  return (
    <Card onPress={onPress} accessibilityLabel={`Open ${user.name}'s profile`}>
      <View style={styles.row}>
        <Avatar name={user.name} uri={user.avatarUrl || undefined} />

        <View style={styles.main}>
          <Text style={styles.name} numberOfLines={1}>
            {user.name}
          </Text>

          <View style={styles.metaRow}>
            <RatingStars rating={user.ratingAvg} count={user.ratingCount} />
            {user.credentialCount > 0 ? (
              <View style={styles.credentials}>
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
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={sizes.iconSm} color={colors.inkFaint} />
              <Text style={styles.meta} numberOfLines={1}>
                {user.location}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

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
        <Text style={styles.meta}>
          Not offering any skills yet
          {user.skillsWanted.length > 0
            ? ` · wants to learn ${plural(user.skillsWanted.length, 'skill')}`
            : ''}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  main: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  credentials: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  meta: {
    ...type.caption,
    color: colors.inkMuted,
  },
  skills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
