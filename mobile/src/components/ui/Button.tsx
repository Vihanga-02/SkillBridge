import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radius, sizes, spacing, type } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Only one filled-accent button per screen (§13.4). */
  style?: ViewStyle;
};

const FILL: Record<ButtonVariant, { rest: string; pressed: string }> = {
  primary: { rest: colors.accent, pressed: colors.accentPressed },
  secondary: { rest: colors.surface, pressed: colors.surfaceAlt },
  ghost: { rest: 'transparent', pressed: colors.surfaceAlt },
  danger: { rest: colors.danger, pressed: colors.danger },
};

const TEXT_COLOR: Record<ButtonVariant, string> = {
  primary: colors.inkInverse,
  secondary: colors.ink,
  ghost: colors.accent,
  danger: colors.inkInverse,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  const textColor = TEXT_COLOR[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' && styles.outlined,
        { backgroundColor: pressed ? FILL[variant].pressed : FILL[variant].rest },
        isDisabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={sizes.iconMd} color={textColor} /> : null}
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.control,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlined: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...type.bodyStrong,
  },
  disabled: {
    opacity: 0.5,
  },
});
