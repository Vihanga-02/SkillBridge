import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, spacing, type } from '@/constants/theme';

export type NoticeTone = 'error' | 'success' | 'info';

type Props = {
  tone: NoticeTone;
  message: string;
};

const TONE: Record<NoticeTone, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  error: { color: colors.danger, icon: 'alert-circle-outline' },
  success: { color: colors.success, icon: 'checkmark-circle-outline' },
  info: { color: colors.info, icon: 'information-circle-outline' },
};

/**
 * Form-level and screen-level message banner. Always pairs the colour with an
 * icon and words — meaning is never carried by colour alone (§17.6).
 */
export function Notice({ tone, message }: Props) {
  const { color, icon } = TONE[tone];

  return (
    <View style={[styles.banner, { borderColor: color }]} accessibilityRole="alert">
      <Ionicons name={icon} size={sizes.iconMd} color={color} />
      <Text style={[styles.message, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  message: {
    ...type.body,
    flex: 1,
  },
});
