import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { brand, colors, radius, sizes, spacing, type } from '@/constants/theme';

type Props = {
  name: string;
  avatarUrl?: string;
  search: string;
  onSearchChange: (text: string) => void;
  filterCount: number;
  onOpenFilters: () => void;
  onPressAvatar: () => void;
};

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The first thing a signed-in user sees: a navy panel (the tab bar's colour)
 * with the logo's colours as soft shapes behind a personal greeting and search.
 */
export function DiscoverHero({
  name,
  avatarUrl,
  search,
  onSearchChange,
  filterCount,
  onOpenFilters,
  onPressAvatar,
}: Props) {
  const insets = useSafeAreaInsets();
  const firstName = name.trim().split(/\s+/)[0] || 'there';

  return (
    <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
      {/* Decorative logo-colour shapes; purely visual, hidden from screen readers. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}>
        <View style={[styles.blob, styles.blobBlue]} />
        <View style={[styles.blob, styles.blobGreen]} />
        <View style={[styles.dot, styles.dotYellow]} />
      </View>

      <View style={styles.topRow}>
        <View style={styles.titles}>
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting(new Date().getHours())}, {firstName}
          </Text>
          <Text style={styles.subtitle}>Find someone to learn from today.</Text>
        </View>
        <Pressable
          onPress={onPressAvatar}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          style={styles.avatarRing}>
          <Avatar name={name} uri={avatarUrl || undefined} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={sizes.iconMd} color={colors.inkMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={onSearchChange}
            placeholder="Search people by name"
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search people by name"
          />
          {search.length > 0 ? (
            <Pressable
              onPress={() => onSearchChange('')}
              hitSlop={spacing.md}
              accessibilityRole="button"
              accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={sizes.iconMd} color={colors.inkMuted} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={onOpenFilters}
          accessibilityRole="button"
          accessibilityLabel={
            filterCount > 0 ? `Filters, ${filterCount} active` : 'Filters'
          }
          style={({ pressed }) => [styles.filterButton, pressed && styles.filterButtonPressed]}>
          <Ionicons name="options-outline" size={sizes.iconLg} color={colors.ink} />
          {filterCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const BLOB = sizes.avatarLg * 2;
const DOT = sizes.avatarMd;

const styles = StyleSheet.create({
  hero: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.ink,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: BLOB,
    height: BLOB,
    borderRadius: radius.full,
    opacity: 0.22,
  },
  blobBlue: {
    backgroundColor: brand.blue,
    top: -BLOB / 3,
    right: -BLOB / 4,
  },
  blobGreen: {
    backgroundColor: brand.green,
    bottom: -BLOB / 2,
    left: -BLOB / 3,
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: radius.full,
    opacity: 0.5,
  },
  dotYellow: {
    backgroundColor: brand.yellow,
    top: spacing.xxl * 2,
    right: spacing.xxl * 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titles: {
    flex: 1,
    gap: spacing.xs,
  },
  greeting: {
    ...type.h1,
    color: colors.inkInverse,
  },
  subtitle: {
    ...type.body,
    color: colors.inkInverseMuted,
  },
  avatarRing: {
    padding: 2,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: brand.yellow,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.control,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  searchInput: {
    flex: 1,
    ...type.body,
    color: colors.ink,
    paddingVertical: spacing.sm,
  },
  filterButton: {
    width: sizes.control,
    height: sizes.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  filterButtonPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  badge: {
    position: 'absolute',
    top: -spacing.xs,
    right: -spacing.xs,
    minWidth: spacing.xl - spacing.xs,
    height: spacing.xl - spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...type.caption,
    fontWeight: '700',
    color: colors.inkInverse,
  },
});
