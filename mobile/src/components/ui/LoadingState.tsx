import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type } from '@/constants/theme';

type Props = {
  /** Give the spinner a real label — "Loading…" tells the user nothing. */
  label?: string;
  /** Fills the screen. Used as the splash gate while auth resolves. */
  fullScreen?: boolean;
};

export function LoadingState({ label, fullScreen = false }: Props) {
  return (
    <View style={[styles.wrapper, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={colors.accent} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  label: {
    ...type.body,
    color: colors.inkMuted,
  },
});
