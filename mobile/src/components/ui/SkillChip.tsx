import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LEVEL_LABELS } from '@/constants/skills';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import type { Level } from '@/types';

type Props = {
  label: string;
  level?: Level;
  /** Passed SkillBridge's own test — the app tested them. Rendered as a filled tick. */
  verified?: boolean;
  /** Self-declared evidence the user uploaded. Rendered as an outlined document. */
  credentialCount?: number;
  onPress?: () => void;
};

/**
 * The two trust signals are deliberately drawn differently and never merged: a
 * filled tick means SkillBridge tested them, an outlined document means they
 * supplied evidence for the learner to judge (§5.1.1).
 */
export function SkillChip({ label, level, verified = false, credentialCount = 0, onPress }: Props) {
  const accessibilityLabel = [
    label,
    level ? LEVEL_LABELS[level] : null,
    verified ? 'verified by test' : null,
    credentialCount > 0 ? `${credentialCount} credentials` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const body = (
    <>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>

      {level ? (
        <>
          <Text style={styles.separator}>·</Text>
          <Text style={styles.level}>{LEVEL_LABELS[level]}</Text>
        </>
      ) : null}

      {verified ? (
        <Ionicons name="checkmark-circle" size={sizes.iconSm} color={colors.accent} />
      ) : null}

      {credentialCount > 0 ? (
        <View style={styles.credentials}>
          <Ionicons name="document-text-outline" size={sizes.iconSm} color={colors.inkMuted} />
          <Text style={styles.credentialCount}>{credentialCount}</Text>
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.chip} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: sizes.avatarSm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  pressed: {
    borderColor: colors.inkFaint,
  },
  label: {
    ...type.label,
    color: colors.ink,
  },
  separator: {
    ...type.label,
    color: colors.inkFaint,
  },
  level: {
    ...type.label,
    color: colors.inkMuted,
  },
  credentials: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  credentialCount: {
    ...type.caption,
    color: colors.inkMuted,
  },
});
