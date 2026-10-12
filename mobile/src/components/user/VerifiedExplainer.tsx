import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { colors, sizes, spacing, type } from '@/constants/theme';

export const VERIFIED_EXPLANATION =
  'A filled ✓ tick means this member passed SkillBridge’s own skill test for that skill and level.\n\n' +
  'A document icon means they uploaded a certificate or other proof. Uploaded credentials are self-declared — SkillBridge does not check them, so open them and judge for yourself.';

/**
 * "What does verified mean?" — sits under a skill portfolio and explains the
 * two trust signals, which are deliberately shown differently (§5.1.1).
 */
export function VerifiedExplainer() {
  function explain() {
    Alert.alert('What “verified” means', VERIFIED_EXPLANATION, [
      { text: 'Learn more', onPress: () => router.push('/help' as Href) },
      { text: 'Got it', style: 'cancel' },
    ]);
  }

  return (
    <Pressable
      onPress={explain}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel="What does verified mean?"
      style={styles.link}>
      <Ionicons name="information-circle-outline" size={sizes.iconSm} color={colors.accent} />
      <Text style={styles.text}>What do ✓ verified and 📄 credentials mean?</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  text: {
    ...type.label,
    color: colors.accent,
  },
});
