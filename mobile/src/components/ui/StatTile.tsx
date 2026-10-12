import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow, sizes, spacing, type } from '@/constants/theme';
import { nonNegativeCount } from '@/utils/counts';

type Props = {
  label: string;
  value: number | undefined;
  icon: keyof typeof Ionicons.glyphMap;
  /** Icon colour and the light tint behind it. */
  color: string;
  surface: string;
  /** Two-per-row width, for grids of four. */
  half?: boolean;
};

/** A raised number tile with a tinted icon — the stats row on Me and profiles. */
export function StatTile({ label, value, icon, color, surface, half = false }: Props) {
  const count = nonNegativeCount(value);
  return (
    <View style={[styles.tile, half && styles.half]} accessibilityLabel={`${label}: ${count}`}>
      <View style={[styles.icon, { backgroundColor: surface }]}>
        <Ionicons name={icon} size={sizes.iconMd} color={color} />
      </View>
      <Text style={styles.value}>{count}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  half: {
    flexBasis: '45%',
  },
  icon: {
    width: sizes.touchMin - spacing.xs,
    height: sizes.touchMin - spacing.xs,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...type.h1,
    color: colors.ink,
  },
  label: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
