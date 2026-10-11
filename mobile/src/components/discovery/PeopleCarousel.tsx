import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { brand, colors, radius, shadow, sizes, spacing, type } from '@/constants/theme';
import type { User } from '@/types';
import { formatRating } from '@/utils/format';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  users: User[];
  onPressUser: (user: User) => void;
};

/** A short horizontal row of standout people, shown above the main list. */
export function PeopleCarousel({ title, icon, users, onPressUser }: Props) {
  if (users.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Ionicons name={icon} size={sizes.iconMd} color={brand.blue} />
        <Text style={styles.title}>{title}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {users.map((user) => {
          const topSkill = user.skillsOffered[0]?.label;
          return (
            <Pressable
              key={user.uid}
              onPress={() => onPressUser(user)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${user.name}'s profile`}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <Avatar name={user.name} uri={user.avatarUrl || undefined} size="lg" />
              <Text style={styles.name} numberOfLines={1}>
                {user.name}
              </Text>
              {topSkill ? (
                <Text style={styles.skill} numberOfLines={1}>
                  {topSkill}
                </Text>
              ) : null}
              <View style={styles.rating}>
                <Ionicons name="star" size={sizes.iconSm} color={colors.accent} />
                <Text style={styles.ratingText}>
                  {formatRating(user.ratingAvg, user.ratingCount)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const CARD_WIDTH = sizes.avatarLg + spacing.xxl * 2;

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...type.h2,
    color: colors.ink,
  },
  row: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  card: {
    width: CARD_WIDTH,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
  },
  name: {
    ...type.bodyStrong,
    color: colors.ink,
    marginTop: spacing.xs,
  },
  skill: {
    ...type.caption,
    color: colors.inkMuted,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingText: {
    ...type.label,
    color: colors.ink,
  },
});
