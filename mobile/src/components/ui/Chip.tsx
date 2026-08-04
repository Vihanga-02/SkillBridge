import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, spacing, type } from '@/constants/theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
};

/** Selectable pill used for skills, categories and list filters. */
export function Chip({ label, selected = false, onPress, icon, disabled = false }: Props) {
  const tint = selected ? colors.accent : colors.inkMuted;

  const body = (
    <View style={styles.content}>
      {icon ? <Ionicons name={icon} size={sizes.iconSm} color={tint} /> : null}
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={sizes.iconSm} color={colors.accent} /> : null}
    </View>
  );

  if (!onPress) return <View style={[styles.chip, selected && styles.selected]}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      hitSlop={spacing.xs}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
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
});
