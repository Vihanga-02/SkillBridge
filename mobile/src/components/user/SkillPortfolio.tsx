import { StyleSheet, Text, View } from 'react-native';

import { SkillChip } from '@/components/ui/SkillChip';
import { colors, spacing, type } from '@/constants/theme';
import type { SkillOffered, SkillWanted, UserRole } from '@/types';

type Props = {
  skillsOffered: SkillOffered[];
  skillsWanted: SkillWanted[];
  /** When set, only the sections that match the role are shown. */
  role?: UserRole;
  /** Tapping an offered skill starts its verification test (owner only). */
  onPressOffered?: (skill: SkillOffered) => void;
};

export function SkillPortfolio({ skillsOffered, skillsWanted, role, onPressOffered }: Props) {
  const showOffered = !role || role === 'teacher' || role === 'both';
  const showWanted = !role || role === 'learner' || role === 'both';

  if (!showOffered && !showWanted) return null;

  return (
    <View style={styles.wrapper}>
      {showOffered ? (
        <View style={styles.section}>
          <Text style={styles.title}>Can teach</Text>
          {skillsOffered.length === 0 ? (
            <Text style={styles.empty}>No skills offered yet.</Text>
          ) : (
            <View style={styles.chips}>
              {skillsOffered.map((skill) => (
                <SkillChip
                  key={skill.skill}
                  label={skill.label}
                  level={skill.level}
                  verified={skill.verified}
                  credentialCount={skill.credentialCount}
                  onPress={onPressOffered ? () => onPressOffered(skill) : undefined}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}

      {showWanted ? (
        <View style={styles.section}>
          <Text style={styles.title}>Wants to learn</Text>
          {skillsWanted.length === 0 ? (
            <Text style={styles.empty}>Nothing listed yet.</Text>
          ) : (
            <View style={styles.chips}>
              {skillsWanted.map((skill) => (
                <SkillChip key={skill.skill} label={skill.label} />
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  title: {
    ...type.h1,
    color: colors.ink,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  empty: {
    ...type.body,
    color: colors.inkMuted,
  },
});
