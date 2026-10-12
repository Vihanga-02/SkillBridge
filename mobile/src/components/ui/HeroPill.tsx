import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { brand, colors, radius, sizes, spacing, type } from '@/constants/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Makes the pill tappable — e.g. jump to reviews. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** A light chip for facts on the navy `BrandHeader` (role, credits, rating…). */
export function HeroPill({ icon, label, onPress, accessibilityLabel }: Props) {
  const body = (
    <>
      <Ionicons name={icon} size={sizes.iconSm} color={brand.yellow} />
      <Text style={styles.text}>{label}</Text>
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.pill} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: brand.onInk,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: brand.onInkBorder,
  },
  pressed: {
    backgroundColor: brand.onInkBorder,
  },
  text: {
    ...type.label,
    color: colors.inkInverse,
  },
});
