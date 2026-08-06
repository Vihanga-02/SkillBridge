import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { CredentialCard } from '@/components/user/CredentialCard';
import { LEVEL_LABELS } from '@/constants/skills';
import { colors, sizes, spacing, type } from '@/constants/theme';
import type { Credential, SkillOffered } from '@/types';

type Props = {
  skillsOffered: SkillOffered[];
  credentials: Credential[];
  onOpen: (credential: Credential) => void;
  onEdit?: (credential: Credential) => void;
  showVisibility?: boolean;
};

/**
 * Credentials are grouped under the skill they back, never shown as one flat list
 * — that grouping *is* the design intent. A skill with zero credentials still gets
 * a row: absence is information a learner needs, and hiding it would mislead.
 */
export function CredentialsBySkill({
  skillsOffered,
  credentials,
  onOpen,
  onEdit,
  showVisibility = false,
}: Props) {
  const offeredTags = new Set(skillsOffered.map((skill) => skill.skill));

  const bySkill = new Map<string, Credential[]>();
  const unlinked: Credential[] = [];

  for (const credential of credentials) {
    if (!offeredTags.has(credential.skillTag)) {
      unlinked.push(credential);
      continue;
    }
    const existing = bySkill.get(credential.skillTag) ?? [];
    existing.push(credential);
    bySkill.set(credential.skillTag, existing);
  }

  return (
    <View style={styles.wrapper}>
      {skillsOffered.map((skill) => {
        const rows = bySkill.get(skill.skill) ?? [];

        return (
          <View key={skill.skill} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{skill.label}</Text>
              <Text style={styles.separator}>·</Text>
              <Text style={styles.groupMeta}>{LEVEL_LABELS[skill.level]}</Text>

              {skill.verified ? (
                <>
                  <Text style={styles.separator}>·</Text>
                  <Ionicons name="checkmark-circle" size={sizes.iconSm} color={colors.accent} />
                  <Text style={styles.verified}>Verified by test</Text>
                </>
              ) : null}
            </View>

            {rows.length === 0 ? (
              <Text style={styles.empty}>No credentials added</Text>
            ) : (
              <View style={styles.rows}>
                {rows.map((credential) => (
                  <CredentialCard
                    key={credential.id}
                    credential={credential}
                    onPress={() => onOpen(credential)}
                    onEdit={onEdit ? () => onEdit(credential) : undefined}
                    showVisibility={showVisibility}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}

      {unlinked.length > 0 ? (
        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <Ionicons name="unlink-outline" size={sizes.iconSm} color={colors.warning} />
            <Text style={styles.groupTitle}>Unlinked</Text>
          </View>
          <Text style={styles.empty}>
            These back a skill you no longer offer. Removing a skill never deletes its evidence —
            add the skill back to show them on your profile.
          </Text>
          <View style={styles.rows}>
            {unlinked.map((credential) => (
              <CredentialCard
                key={credential.id}
                credential={credential}
                onPress={() => onOpen(credential)}
                onEdit={onEdit ? () => onEdit(credential) : undefined}
                showVisibility={showVisibility}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xl,
  },
  group: {
    gap: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  groupTitle: {
    ...type.h2,
    color: colors.ink,
  },
  groupMeta: {
    ...type.label,
    color: colors.inkMuted,
  },
  separator: {
    ...type.label,
    color: colors.inkFaint,
  },
  verified: {
    ...type.label,
    color: colors.accent,
  },
  empty: {
    ...type.caption,
    color: colors.inkMuted,
  },
  rows: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
});
