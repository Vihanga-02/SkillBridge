import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, sizes, spacing, type } from '@/constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  /** Shows a back chevron. Defaults to `router.back()`. */
  onBack?: () => void;
  showBack?: boolean;
  action?: React.ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, showBack = false, action }: Props) {
  return (
    <View style={styles.header}>
      {showBack ? (
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}>
          <Ionicons name="chevron-back" size={sizes.iconLg} color={colors.ink} />
        </Pressable>
      ) : null}

      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  back: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    marginLeft: -spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...type.display,
    color: colors.ink,
  },
  subtitle: {
    ...type.body,
    color: colors.inkMuted,
  },
  action: {
    minWidth: sizes.touchMin,
    alignItems: 'flex-end',
  },
});
