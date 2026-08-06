import { StyleSheet, View } from 'react-native';

import { colors, radius, sizes, spacing } from '@/constants/theme';

/**
 * Skeletons shaped like the real content, not a bare spinner — the list stops
 * jumping when the data lands because the placeholder already had its height.
 */
export function SkeletonUserCard() {
  return (
    <View style={styles.card}>
      <View style={styles.avatar} />
      <View style={styles.lines}>
        <View style={[styles.line, styles.lineTitle]} />
        <View style={[styles.line, styles.lineMeta]} />
        <View style={styles.chipRow}>
          <View style={styles.chip} />
          <View style={styles.chip} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.list} accessibilityLabel="Loading results">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonUserCard key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  avatar: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  lines: {
    flex: 1,
    gap: spacing.sm,
  },
  line: {
    height: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  lineTitle: {
    width: '55%',
  },
  lineMeta: {
    width: '35%',
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  chip: {
    width: sizes.avatarLg,
    height: sizes.avatarSm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
});
