import { StyleSheet, Text, View } from 'react-native';

import { SkillChip } from '@/components/ui/SkillChip';
import { skillLabel } from '@/constants/skills';
import { colors, spacing, type } from '@/constants/theme';
import type { CareerGoal, SkillOffered, SkillWanted, UserRole } from '@/types';

type Props = {
  skillsOffered: SkillOffered[];
  /** Flat union of every wanted skill — the fallback rendering when `careerGoals` is empty. */
  skillsWanted: SkillWanted[];
  /** When present, "Wants to learn" groups by goal instead of one flat list. */
  careerGoals?: CareerGoal[];
  /** "No goal attached" tail, rendered under the goal groups. Ignored if `careerGoals` is empty. */
  extraSkillsWanted?: string[];
  /** When set, only the sections that match the role are shown. */
  role?: UserRole;
  /** Tapping an offered skill starts its verification test (owner only). */
  onPressOffered?: (skill: SkillOffered) => void;
};

export function SkillPortfolio({
  skillsOffered,
  skillsWanted,
  careerGoals = [],
  extraSkillsWanted = [],
  role,
  onPressOffered,
}: Props) {
  const showOffered = !role || role === 'teacher' || role === 'both';
  const showWanted = !role || role === 'learner' || role === 'both';

  if (!showOffered && !showWanted) return null;

  const hasGoals = careerGoals.length > 0;
  const isEmpty = hasGoals
    ? careerGoals.every((g) => g.skillTags.length === 0) && extraSkillsWanted.length === 0
    : skillsWanted.length === 0;

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
          {isEmpty ? (
            <Text style={styles.empty}>Nothing listed yet.</Text>
          ) : hasGoals ? (
            <View style={styles.goalGroups}>
              {careerGoals
                .filter((g) => g.skillTags.length > 0)
                .map((g) => (
                  <View key={g.goal} style={styles.goalGroup}>
                    <Text style={styles.goalLabel}>{g.label}</Text>
                    <View style={styles.chips}>
                      {g.skillTags.map((tag) => (
                        <SkillChip key={tag} label={skillLabel(tag)} />
                      ))}
                    </View>
                  </View>
                ))}

              {extraSkillsWanted.length > 0 ? (
                <View style={styles.goalGroup}>
                  <Text style={styles.goalLabel}>Other skills</Text>
                  <View style={styles.chips}>
                    {extraSkillsWanted.map((tag) => (
                      <SkillChip key={tag} label={skillLabel(tag)} />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
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
  goalGroups: {
    gap: spacing.lg,
  },
  goalGroup: {
    gap: spacing.sm,
  },
  goalLabel: {
    ...type.bodyStrong,
    color: colors.inkMuted,
  },
  empty: {
    ...type.body,
    color: colors.inkMuted,
  },
});
