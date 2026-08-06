import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, spacing, type } from '@/constants/theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  /** Compact pills for dense filter rows on small screens. */
  size?: 'md' | 'sm';
  /** Selected checkmark — off by default on `sm` to keep filters short. */
  showCheck?: boolean;
};

/** Selectable pill used for skills, categories and list filters. */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  disabled = false,
  size = 'md',
  showCheck,
}: Props) {
  const tint = selected ? colors.accent : colors.inkMuted;
  const compact = size === 'sm';
  const withCheck = showCheck ?? !compact;

  const body = (
    <View style={styles.content}>
      {icon ? (
        <Ionicons name={icon} size={compact ? 12 : sizes.iconSm} color={tint} />
      ) : null}
      <Text style={[compact ? styles.labelSm : styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
      {selected && withCheck ? (
        <Ionicons name="checkmark" size={compact ? 12 : sizes.iconSm} color={colors.accent} />
      ) : null}
    </View>
  );

  const chipStyle = [compact ? styles.chipSm : styles.chip, selected && styles.selected];

  if (!onPress) return <View style={chipStyle}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      hitSlop={spacing.xs}
      style={({ pressed }) => [
        ...chipStyle,
        pressed && !selected && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: sizes.avatarSm,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  chipSm: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  selected: {
    backgroundColor: colors.accentSurface,
    borderColor: colors.accent,
  },
  pressed: {
    borderColor: colors.inkFaint,
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...type.label,
  },
  labelSm: {
    ...type.caption,
    fontWeight: '500',
  },
});
