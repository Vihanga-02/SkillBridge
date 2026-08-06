import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { isExpired } from '@/services/credentialService';
import type { Credential, CredentialType } from '@/types';
import { formatDate } from '@/utils/date';

const TYPE_ICON: Record<CredentialType, keyof typeof Ionicons.glyphMap> = {
  certificate: 'ribbon-outline',
  degree: 'school-outline',
  course: 'play-circle-outline',
  award: 'trophy-outline',
  work_experience: 'briefcase-outline',
  portfolio: 'folder-open-outline',
  other: 'document-text-outline',
};

export const CREDENTIAL_TYPE_LABEL: Record<CredentialType, string> = {
  certificate: 'Certificate',
  degree: 'Degree',
  course: 'Course',
  award: 'Award',
  work_experience: 'Work experience',
  portfolio: 'Portfolio',
  other: 'Other',
};

type Props = {
  credential: Credential;
  onPress: () => void;
  /** Owner-only affordances. */
  onEdit?: () => void;
  showVisibility?: boolean;
};

export function CredentialCard({ credential, onPress, onEdit, showVisibility = false }: Props) {
  const expired = isExpired(credential);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${credential.title}, issued by ${credential.issuer}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.icon}>
        <Ionicons
          name={TYPE_ICON[credential.type]}
          size={sizes.iconMd}
          color={colors.inkFaint}
        />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {credential.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {credential.issuer} · {formatDate(credential.issueDate, 'yyyy')}
        </Text>

        <View style={styles.tags}>
          <Text style={styles.tag}>{CREDENTIAL_TYPE_LABEL[credential.type]}</Text>

          {credential.fileType === 'none' ? (
            <Text style={styles.tag}>No document</Text>
          ) : (
            <Text style={styles.tag}>{credential.fileType === 'pdf' ? 'PDF' : 'Image'}</Text>
          )}

          {expired ? <Text style={[styles.tag, styles.expired]}>Expired</Text> : null}

          {showVisibility && credential.visibility === 'private' ? (
            <Text style={styles.tag}>Hidden</Text>
          ) : null}
        </View>
      </View>

      {onEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${credential.title}`}
          style={styles.edit}>
          <Ionicons name="create-outline" size={sizes.iconMd} color={colors.inkMuted} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={sizes.iconMd} color={colors.inkFaint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
  },
  icon: {
    width: sizes.avatarSm,
    height: sizes.avatarSm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  meta: {
    ...type.caption,
    color: colors.inkMuted,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    ...type.caption,
    color: colors.inkMuted,
  },
  expired: {
    color: colors.warning,
  },
  edit: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
