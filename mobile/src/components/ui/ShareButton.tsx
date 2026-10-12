import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, sizes, spacing } from '@/constants/theme';

type Props = {
  onPress: () => void;
  /** What is shared, for screen readers — e.g. "Share this lesson". */
  accessibilityLabel: string;
};

/** Header-sized share icon. Pair it with a helper from `utils/share`. */
export function ShareButton({ onPress, accessibilityLabel }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons name="share-social-outline" size={sizes.iconLg} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
  },
});
