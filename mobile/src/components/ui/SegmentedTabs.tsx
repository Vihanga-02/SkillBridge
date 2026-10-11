import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { brand, colors, radius, sizes, spacing, type } from '@/constants/theme';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Count shown as a small pill, e.g. unread chats. Hidden at 0. */
  badge?: number;
};

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `dark` sits on the navy `BrandHeader`; `light` on white or `bg` surfaces. */
  tone?: 'light' | 'dark';
  accessibilityLabel?: string;
};

/** One segmented control for every "switch between views" row in the app. */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  tone = 'light',
  accessibilityLabel,
}: Props<T>) {
  const dark = tone === 'dark';

  return (
    <View
      style={[styles.track, dark && styles.trackDark]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        const textColor = selected ? colors.ink : dark ? colors.inkInverseMuted : colors.inkMuted;
        const badge = option.badge ?? 0;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={badge > 0 ? `${option.label}, ${badge} new` : option.label}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && !selected && styles.segmentPressed,
            ]}>
            {option.icon ? (
              <Ionicons name={option.icon} size={sizes.iconSm} color={textColor} />
            ) : null}
            <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
              {option.label}
            </Text>
            {badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  trackDark: {
    backgroundColor: brand.onInk,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: sizes.touchMin - spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  segmentSelected: {
    backgroundColor: colors.surface,
  },
  segmentPressed: {
    opacity: 0.75,
  },
  label: {
    ...type.label,
    fontWeight: '600',
  },
  badge: {
    minWidth: spacing.lg + spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  badgeText: {
    ...type.caption,
    fontWeight: '700',
    color: colors.inkInverse,
  },
});
