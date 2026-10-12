import { StyleSheet, View } from 'react-native';

import { brand, radius, sizes, spacing } from '@/constants/theme';

/**
 * Soft logo-colour shapes behind a light screen (sign-in, sign-up, onboarding).
 * Decorative only: hidden from screen readers and never catches touches. Put it
 * first inside a container that has `overflow: 'hidden'`.
 */
export function BrandBackdrop() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}>
      <View style={[styles.blob, styles.blue]} />
      <View style={[styles.blob, styles.green]} />
      <View style={styles.dot} />
    </View>
  );
}

const BLOB = sizes.avatarLg * 3;
const DOT = sizes.avatarMd;

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    width: BLOB,
    height: BLOB,
    borderRadius: radius.full,
  },
  blue: {
    backgroundColor: brand.blue,
    opacity: 0.08,
    top: -BLOB / 3,
    right: -BLOB / 3,
  },
  green: {
    backgroundColor: brand.green,
    opacity: 0.08,
    bottom: -BLOB / 3,
    left: -BLOB / 3,
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: radius.full,
    backgroundColor: brand.yellow,
    opacity: 0.35,
    top: spacing.xxl * 4,
    left: spacing.xl,
  },
});
