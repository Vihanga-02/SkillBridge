import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { CAREER_GOALS, skillsInGoal, type CareerGoalTag } from '@/constants/careerGoals';
import {
  CATEGORIES,
  LEVELS,
  LEVEL_LABELS,
  skillsInCategory,
  type Category,
  type Level,
  type SkillTag,
} from '@/constants/skills';
import { colors, radius, spacing, type } from '@/constants/theme';

export type RoleFilter = 'all' | 'teachers' | 'learners';
export type BrowseMode = 'category' | 'goal';

export const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'teachers', label: 'Teachers' },
  { value: 'learners', label: 'Learners' },
];

const BROWSE_MODES: { value: BrowseMode; label: string }[] = [
  { value: 'category', label: 'Category' },
  { value: 'goal', label: 'Career goal' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onClearAll: () => void;
  roleFilter: RoleFilter;
  onRoleFilter: (value: RoleFilter) => void;
  browseMode: BrowseMode;
  onBrowseMode: (value: BrowseMode) => void;
  category: Category | null;
  onCategory: (value: Category | null) => void;
  careerGoal: CareerGoalTag | null;
  onCareerGoal: (value: CareerGoalTag | null) => void;
  skillTag: SkillTag | null;
  onSkillTag: (value: SkillTag | null) => void;
  level: Level | null;
  onLevel: (value: Level | null) => void;
};

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Every Discovery filter in one bottom sheet, so the screen itself shows people, not controls. */
export function FilterSheet({
  visible,
  onClose,
  onClearAll,
  roleFilter,
  onRoleFilter,
  browseMode,
  onBrowseMode,
  category,
  onCategory,
  careerGoal,
  onCareerGoal,
  skillTag,
  onSkillTag,
  level,
  onLevel,
}: Props) {
  const insets = useSafeAreaInsets();
  const skills =
    browseMode === 'category'
      ? category
        ? skillsInCategory(category)
        : []
      : careerGoal
        ? skillsInGoal(careerGoal)
        : [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close filters" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <Pressable
            onPress={onClearAll}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters">
            <Text style={styles.clear}>Clear all</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}>
          <Section title="Show">
            <Segmented options={ROLE_FILTERS} value={roleFilter} onChange={onRoleFilter} />
          </Section>

          <Section title="Browse by">
            <Segmented options={BROWSE_MODES} value={browseMode} onChange={onBrowseMode} />
            <View style={styles.chips}>
              {browseMode === 'category' ? (
                <>
                  <Chip size="sm" label="All" selected={!category} onPress={() => onCategory(null)} />
                  {CATEGORIES.map((item) => (
                    <Chip
                      key={item}
                      size="sm"
                      label={item}
                      selected={category === item}
                      onPress={() => onCategory(category === item ? null : item)}
                    />
                  ))}
                </>
              ) : (
                <>
                  <Chip size="sm" label="All" selected={!careerGoal} onPress={() => onCareerGoal(null)} />
                  {CAREER_GOALS.map((item) => (
                    <Chip
                      key={item.tag}
                      size="sm"
                      label={item.label}
                      selected={careerGoal === item.tag}
                      onPress={() => onCareerGoal(careerGoal === item.tag ? null : item.tag)}
                    />
                  ))}
                </>
              )}
            </View>
          </Section>

          {skills.length > 0 ? (
            <Section title="Skill">
              <View style={styles.chips}>
                {skills.map((skill) => (
                  <Chip
                    key={skill.tag}
                    size="sm"
                    label={skill.label}
                    selected={skillTag === skill.tag}
                    onPress={() => onSkillTag(skillTag === skill.tag ? null : skill.tag)}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          <Section title="Level">
            <View style={styles.chips}>
              <Chip size="sm" label="Any level" selected={!level} onPress={() => onLevel(null)} />
              {LEVELS.map((item) => (
                <Chip
                  key={item}
                  size="sm"
                  label={LEVEL_LABELS[item]}
                  selected={level === item}
                  onPress={() => onLevel(level === item ? null : item)}
                />
              ))}
            </View>
          </Section>
        </ScrollView>

        <Button label="Show results" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.ink,
    opacity: 0.4,
  },
  sheet: {
    maxHeight: '85%',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  handle: {
    alignSelf: 'center',
    width: spacing.xxl + spacing.sm,
    height: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...type.h2,
    color: colors.ink,
  },
  clear: {
    ...type.label,
    color: colors.accent,
  },
  scroll: {
    flexShrink: 1,
  },
  body: {
    gap: spacing.xl,
    paddingBottom: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.label,
    color: colors.inkMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: spacing.xxl + spacing.xs,
    borderRadius: radius.sm - 2,
  },
  segmentSelected: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  segmentText: {
    ...type.label,
    color: colors.inkMuted,
  },
  segmentTextSelected: {
    color: colors.ink,
  },
});
