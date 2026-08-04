import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ONBOARDING } from '@/constants/config';
import {
  CATEGORIES,
  LEVELS,
  LEVEL_LABELS,
  SKILLS,
  skillLabel,
  type Category,
  type Level,
  type SkillTag,
} from '@/constants/skills';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { completeOnboarding, logout } from '@/services/authService';
import type { UserRole } from '@/types';
import { errorMessage } from '@/utils/authErrors';

type StepId = 'role' | 'offered' | 'wanted';

const ROLE_OPTIONS: {
  value: UserRole;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'both',
    title: 'Both',
    description: 'Teach what you know and learn what you don\u2019t. Most members pick this.',
    icon: 'swap-horizontal',
  },
  {
    value: 'learner',
    title: 'Mostly learning',
    description: 'Browse lessons and book sessions with peers.',
    icon: 'school-outline',
  },
  {
    value: 'teacher',
    title: 'Mostly teaching',
    description: 'Publish lessons and host sessions for others.',
    icon: 'easel-outline',
  },
];

export default function OnboardingScreen() {
  const { firebaseUser, profile } = useAuth();

  const [role, setRole] = useState<UserRole>('both');
  const [offered, setOffered] = useState<Record<string, Level>>({});
  const [wanted, setWanted] = useState<SkillTag[]>([]);
  const [category, setCategory] = useState<Category | 'All'>('All');
  const [stepIndex, setStepIndex] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A learner is never asked what they teach, and a teacher is never asked what
  // they want to learn — so the wizard is 2 or 3 steps depending on the role.
  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = ['role'];
    if (role !== 'learner') list.push('offered');
    if (role !== 'teacher') list.push('wanted');
    return list;
  }, [role]);

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLastStep = stepIndex >= steps.length - 1;

  const visibleSkills = useMemo(
    () => (category === 'All' ? SKILLS : SKILLS.filter((s) => s.category === category)),
    [category]
  );

  const offeredTags = Object.keys(offered) as SkillTag[];

  function toggleOffered(tag: SkillTag) {
    setFormError(null);
    setOffered((previous) => {
      if (tag in previous) {
        const next = { ...previous };
        delete next[tag];
        return next;
      }
      return { ...previous, [tag]: 'intermediate' };
    });
  }

  function toggleWanted(tag: SkillTag) {
    setFormError(null);
    setWanted((previous) =>
      previous.includes(tag) ? previous.filter((t) => t !== tag) : [...previous, tag]
    );
  }

  function onNext() {
    if (step === 'offered' && offeredTags.length < ONBOARDING.minSkillsOffered) {
      setFormError('Pick at least one skill you could teach.');
      return;
    }
    if (step === 'wanted' && wanted.length < ONBOARDING.minSkillsWanted) {
      setFormError('Pick at least one skill you want to learn.');
      return;
    }

    setFormError(null);
    if (isLastStep) {
      void onFinish();
      return;
    }
    setStepIndex((index) => index + 1);
  }

  async function onFinish() {
    if (!firebaseUser) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await completeOnboarding(firebaseUser, {
        role,
        skillsOffered: offeredTags.map((skill) => ({ skill, level: offered[skill] })),
        skillsWanted: wanted,
      });
      // The live profile listener flips onboardingComplete, and the root layout
      // guard swaps the auth group for the tabs.
    } catch (error) {
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  }

  if (!firebaseUser) return <LoadingState fullScreen label="Setting up your account…" />;

  const firstName = (profile?.name ?? firebaseUser.displayName ?? '').split(' ')[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title={firstName ? `Welcome, ${firstName}` : 'Welcome to SkillBridge'}
        subtitle={`Step ${stepIndex + 1} of ${steps.length}`}
        action={
          <Pressable
            onPress={() => void logout()}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel="Log out and use a different account">
            <Text style={styles.linkText}>Log out</Text>
          </Pressable>
        }
      />

      <View style={styles.progress} accessibilityLabel={`Step ${stepIndex + 1} of ${steps.length}`}>
        {steps.map((id, index) => (
          <View key={id} style={[styles.progressBar, index <= stepIndex && styles.progressBarDone]} />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {formError ? <Notice tone="error" message={formError} /> : null}

        {step === 'role' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How will you use SkillBridge?</Text>
            <Text style={styles.sectionHint}>
              You can change this any time in your profile — it only decides which parts of the app
              are shown first.
            </Text>

            {ROLE_OPTIONS.map((option) => {
              const selected = role === option.value;
              return (
                <Card
                  key={option.value}
                  onPress={() => {
                    setRole(option.value);
                    setStepIndex(0);
                  }}
                  accessibilityLabel={`${option.title}. ${option.description}`}
                  style={selected ? styles.roleCardSelected : undefined}>
                  <View style={styles.roleRow}>
                    <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
                      <Ionicons
                        name={option.icon}
                        size={sizes.iconMd}
                        color={selected ? colors.accent : colors.inkMuted}
                      />
                    </View>
                    <View style={styles.roleText}>
                      <Text style={styles.roleTitle}>{option.title}</Text>
                      <Text style={styles.roleDescription}>{option.description}</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={sizes.iconLg}
                      color={selected ? colors.accent : colors.inkFaint}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        ) : null}

        {step === 'offered' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What could you teach?</Text>
            <Text style={styles.sectionHint}>
              Pick the skills you would be comfortable helping a peer with, then set how strong you
              are at each.
            </Text>

            <CategoryFilter value={category} onChange={setCategory} />

            <View style={styles.chipWrap}>
              {visibleSkills.map((skill) => (
                <Chip
                  key={skill.tag}
                  label={skill.label}
                  selected={skill.tag in offered}
                  onPress={() => toggleOffered(skill.tag)}
                />
              ))}
            </View>

            {offeredTags.length > 0 ? (
              <View style={styles.levelSection}>
                <Text style={styles.sectionSubtitle}>Your level</Text>
                {offeredTags.map((tag) => (
                  <View key={tag} style={styles.levelRow}>
                    <Text style={styles.levelSkill} numberOfLines={1}>
                      {skillLabel(tag)}
                    </Text>
                    <View style={styles.levelChips}>
                      {LEVELS.map((level) => (
                        <Chip
                          key={level}
                          label={LEVEL_LABELS[level]}
                          selected={offered[tag] === level}
                          onPress={() => setOffered((prev) => ({ ...prev, [tag]: level }))}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 'wanted' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What do you want to learn?</Text>
            <Text style={styles.sectionHint}>
              We use this to pre-filter the lesson feed and session browse for you.
            </Text>

            <CategoryFilter value={category} onChange={setCategory} />

            <View style={styles.chipWrap}>
              {visibleSkills.map((skill) => (
                <Chip
                  key={skill.tag}
                  label={skill.label}
                  selected={wanted.includes(skill.tag)}
                  onPress={() => toggleWanted(skill.tag)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {stepIndex > 0 ? (
          <Button
            label="Back"
            variant="secondary"
            onPress={() => setStepIndex((index) => index - 1)}
            style={styles.footerBack}
          />
        ) : null}
        <Button
          label={isLastStep ? 'Finish setup' : 'Continue'}
          onPress={onNext}
          loading={submitting}
          style={styles.footerNext}
        />
      </View>
    </SafeAreaView>
  );
}

function CategoryFilter({
  value,
  onChange,
}: {
  value: Category | 'All';
  onChange: (next: Category | 'All') => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryRow}>
      <Chip label="All" selected={value === 'All'} onPress={() => onChange('All')} />
      {CATEGORIES.map((item) => (
        <Chip
          key={item}
          label={item}
          selected={value === item}
          onPress={() => onChange(item)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  progress: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  progressBar: {
    flex: 1,
    height: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  progressBarDone: {
    backgroundColor: colors.accent,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...type.h1,
    color: colors.ink,
  },
  sectionSubtitle: {
    ...type.h2,
    color: colors.ink,
  },
  sectionHint: {
    ...type.body,
    color: colors.inkMuted,
  },
  roleCardSelected: {
    borderColor: colors.accent,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  roleIcon: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconSelected: {
    backgroundColor: colors.accentSurface,
  },
  roleText: {
    flex: 1,
    gap: spacing.xs,
  },
  roleTitle: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  roleDescription: {
    ...type.caption,
    color: colors.inkMuted,
  },
  categoryRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  levelSection: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  levelRow: {
    gap: spacing.sm,
  },
  levelSkill: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  levelChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerBack: {
    flexBasis: '33%',
  },
  footerNext: {
    flex: 1,
  },
  linkText: {
    ...type.label,
    color: colors.accent,
  },
});
