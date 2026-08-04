import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, spacing, type } from '@/constants/theme';

type Props = {
  tagline?: string;
};

/** The wordmark used on the auth screens and the splash gate. */
export function BrandMark({ tagline }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.badge}>
        <Ionicons name="swap-horizontal" size={sizes.iconLg} color={colors.inkInverse} />
      </View>
      <Text style={styles.name}>SkillBridge</Text>
      {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: sizes.avatarMd + spacing.md,
    height: sizes.avatarMd + spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...type.display,
    color: colors.ink,
  },
  tagline: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
