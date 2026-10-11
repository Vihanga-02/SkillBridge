import { NavigationContext, useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useContext } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { brand, colors, radius, sizes, spacing, type } from '@/constants/theme';

type Props = {
  title?: string;
  subtitle?: string;
  /** Right side of the title row — keep it white or `onInk` to read on navy. */
  action?: React.ReactNode;
  /** Anything below the title: search, tabs, an identity block. */
  children?: React.ReactNode;
  style?: ViewStyle;
};

/**
 * The navy top panel every tab shares: the tab bar's colour with the logo's
 * colours as soft shapes behind. It owns the top safe-area inset and switches
 * the status bar to light while its screen is focused.
 */
export function BrandHeader({ title, subtitle, action, children, style }: Props) {
  // Outside a navigator (component tests) there is no focus to follow.
  const navigation = useContext(NavigationContext);

  return (
    <SafeAreaView edges={['top']} style={[styles.hero, style]}>
      {navigation ? <LightStatusBarWhileFocused /> : null}

      {/* Decorative logo-colour shapes; purely visual, hidden from screen readers. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}>
        <View style={[styles.blob, styles.blobBlue]} />
        <View style={[styles.blob, styles.blobGreen]} />
        <View style={[styles.dot, styles.dotYellow]} />
      </View>

      {title ? (
        <View style={styles.titleRow}>
          <View style={styles.titles}>
            <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      ) : null}

      {children}
    </SafeAreaView>
  );
}

/**
 * Tabs stay mounted, so a plain light `StatusBar` would leak onto every other
 * screen. Mounting it only while focused lets the root's dark one return.
 */
function LightStatusBarWhileFocused() {
  const isFocused = useIsFocused();
  return isFocused ? <StatusBar style="light" /> : null;
}

const titleText = { ...type.h1, color: colors.inkInverse };
const subtitleText = { ...type.body, color: colors.inkInverseMuted };

/** Text styles for custom content inside the header, so it matches the title row. */
export const brandHeaderText = StyleSheet.create({ title: titleText, subtitle: subtitleText });

const BLOB = sizes.avatarLg * 2;
const DOT = sizes.avatarMd;

const styles = StyleSheet.create({
  hero: {
    gap: spacing.lg,
    // SafeAreaView adds the top inset on top of this.
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.ink,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: BLOB,
    height: BLOB,
    borderRadius: radius.full,
    opacity: 0.22,
  },
  blobBlue: {
    backgroundColor: brand.blue,
    top: -BLOB / 3,
    right: -BLOB / 4,
  },
  blobGreen: {
    backgroundColor: brand.green,
    bottom: -BLOB / 2,
    left: -BLOB / 3,
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: radius.full,
    opacity: 0.5,
  },
  dotYellow: {
    backgroundColor: brand.yellow,
    top: spacing.xxl * 2,
    right: spacing.xxl * 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titles: {
    flex: 1,
    gap: spacing.xs,
  },
  title: titleText,
  subtitle: subtitleText,
  action: {
    minWidth: sizes.touchMin,
    alignItems: 'flex-end',
  },
});
