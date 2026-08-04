import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing } from '@/constants/theme';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
  style?: ViewStyle;
};

export function Card({ children, onPress, accessibilityLabel, padded = true, style }: Props) {
  const content = [styles.card, padded && styles.padded, style];

  if (!onPress) return <View style={content}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...content, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  padded: {
    padding: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
  },
});
