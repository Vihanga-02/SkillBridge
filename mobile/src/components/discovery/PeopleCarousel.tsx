import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { brand, colors, radius, shadow, sizes, spacing, type } from '@/constants/theme';
import type { User } from '@/types';
import { formatRating } from '@/utils/format';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Already in rank order — the first user is #1. */
  users: User[];
  onPressUser: (user: User) => void;
};

/**
 * A short, low row of standout people above the main list. Cards lie on their
 * side (avatar left, details right) so the row stays about one card-line tall.
 */
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
        {users.map((user, index) => {
          const rank = index + 1;
          const first = rank === 1;

          return (
            <Pressable
              key={user.uid}
              onPress={() => onPressUser(user)}
              accessibilityRole="button"
              accessibilityLabel={`Number ${rank}, ${user.name}, rated ${formatRating(user.ratingAvg, user.ratingCount)}. Open profile`}
              style={({ pressed }) => [
                styles.card,
                first && styles.cardFirst,
                pressed && styles.cardPressed,
              ]}>
              <View>
                <View style={[styles.avatarRing, first && styles.avatarRingFirst]}>
                  <Avatar name={user.name} uri={user.avatarUrl || undefined} />
                </View>
                <View style={[styles.rank, first && styles.rankFirst]}>
                  <Text style={[styles.rankText, first && styles.rankTextFirst]}>{rank}</Text>
                </View>
              </View>

              <View style={styles.details}>
                <Text style={styles.name} numberOfLines={1}>
                  {user.name}
                </Text>
                <View style={styles.rating}>
                  <Ionicons name="star" size={sizes.iconSm} color={brand.yellow} />
                  <Text style={styles.ratingValue}>{user.ratingAvg.toFixed(1)}</Text>
                  <Text style={styles.ratingCount}>({user.ratingCount})</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const CARD_WIDTH = sizes.avatarLg * 2 - spacing.sm;
const RANK = spacing.lg + spacing.xs;

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
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
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  card: {
    width: CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardFirst: {
    borderColor: brand.yellow,
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
  },
  avatarRing: {
    padding: 2,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: brand.blue,
  },
  avatarRingFirst: {
    borderColor: brand.yellow,
  },
  rank: {
    position: 'absolute',
    right: -spacing.xs,
    bottom: -spacing.xs,
    minWidth: RANK,
    height: RANK,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankFirst: {
    backgroundColor: brand.yellow,
  },
  rankText: {
    ...type.caption,
    fontWeight: '700',
    color: colors.inkInverse,
  },
  rankTextFirst: {
    color: colors.ink,
  },
  details: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingValue: {
    ...type.label,
    fontWeight: '700',
    color: colors.ink,
  },
  ratingCount: {
    ...type.caption,
    color: colors.inkMuted,
  },
});
