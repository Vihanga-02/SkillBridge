import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { CAREER_GOALS, careerGoalByTag, skillsInGoal, type CareerGoalTag } from '@/constants/careerGoals';
import { FILE_LIMITS, TEXT_LIMITS } from '@/constants/config';
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
import { useMediaPicker } from '@/hooks/useMediaPicker';
import { setCareerGoals, setSkillsOffered, updateProfile, uploadAvatar } from '@/services/userService';
import type { User, UserRole } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import { validateBio, validateName, type FieldError } from '@/utils/validation';

type DraftGoal = { goal: CareerGoalTag; skillTags: SkillTag[] };

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'both', label: 'Teach & learn' },
  { value: 'learner', label: 'Learn' },
  { value: 'teacher', label: 'Teach' },
];

export default function EditProfileScreen() {
  const { profile, refreshProfile } = useAuth();

  // The form seeds its state from the profile, so it must not mount before one
  // exists — otherwise a slow read leaves the user editing empty fields.
  if (!profile) return <LoadingState fullScreen label="Loading your profile…" />;

  return <EditProfileForm profile={profile} onSaved={refreshProfile} />;
}

function EditProfileForm({ profile, onSaved }: { profile: User; onSaved: () => Promise<void> }) {
  const { pickImage, error: pickerError, clearError } = useMediaPicker();

  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location);
  const [role, setRole] = useState<UserRole>(profile.role);

  const [offered, setOffered] = useState<Record<string, Level>>(() =>
    Object.fromEntries(profile.skillsOffered.map((skill) => [skill.skill, skill.level]))
  );
  const [draftGoals, setDraftGoals] = useState<DraftGoal[]>(() =>
    (profile.careerGoals ?? []).map((g) => ({ goal: g.goal, skillTags: g.skillTags }))
  );
  const [extraWanted, setExtraWanted] = useState<SkillTag[]>(() => profile.extraSkillsWanted ?? []);
  const [addingGoal, setAddingGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<CareerGoalTag | null>(null);
  const [editingSkills, setEditingSkills] = useState<SkillTag[]>([]);

  const [category, setCategory] = useState<Category | 'All'>('All');
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canTeach = role === 'teacher' || role === 'both';
  const canLearn = role === 'learner' || role === 'both';
  const offeredTags = Object.keys(offered) as SkillTag[];
  const visibleSkills = category === 'All' ? SKILLS : SKILLS.filter((s) => s.category === category);
  const availableGoalsToAdd = CAREER_GOALS.filter(
    (g) => !draftGoals.some((d) => d.goal === g.tag)
  );

  function onRoleChange(next: UserRole) {
    setRole(next);
  }

  function toggleOffered(tag: SkillTag) {
    setOffered((previous) => {
      if (tag in previous) {
        const next = { ...previous };
        delete next[tag];
        return next;
      }
      return { ...previous, [tag]: 'intermediate' };
    });
  }

  function toggleExtraWanted(tag: SkillTag) {
    setExtraWanted((previous) =>
      previous.includes(tag) ? previous.filter((t) => t !== tag) : [...previous, tag]
    );
  }

  function pickGoalToAdd(tag: CareerGoalTag) {
    setDraftGoals((previous) => [...previous, { goal: tag, skillTags: [] }]);
    setAddingGoal(false);
    setEditingGoal(tag);
    setEditingSkills([]);
  }

  function startEditGoal(tag: CareerGoalTag) {
    const existing = draftGoals.find((d) => d.goal === tag);
    setEditingGoal(tag);
    setEditingSkills(existing?.skillTags ?? []);
  }

  function toggleEditingSkill(tag: SkillTag) {
    setEditingSkills((previous) =>
      previous.includes(tag) ? previous.filter((t) => t !== tag) : [...previous, tag]
    );
  }

  function selectAllEditingSkills() {
    if (!editingGoal) return;
    setEditingSkills(skillsInGoal(editingGoal).map((s) => s.tag));
  }

  function saveGoalSkills() {
    if (!editingGoal) return;
    setDraftGoals((previous) =>
      previous.map((d) => (d.goal === editingGoal ? { ...d, skillTags: editingSkills } : d))
    );
    setEditingGoal(null);
    setEditingSkills([]);
  }

  function cancelEditGoal() {
    const tag = editingGoal;
    // A freshly-added goal that's cancelled before picking any skills shouldn't
    // leave an empty card behind.
    if (tag) {
      setDraftGoals((previous) =>
        previous.filter((d) => !(d.goal === tag && d.skillTags.length === 0))
      );
    }
    setEditingGoal(null);
    setEditingSkills([]);
  }

  function removeGoal(tag: CareerGoalTag) {
    setDraftGoals((previous) => previous.filter((d) => d.goal !== tag));
    if (editingGoal === tag) {
      setEditingGoal(null);
      setEditingSkills([]);
    }
  }

  async function onChangeAvatar() {
    clearError();
    const picked = await pickImage({ maxBytes: FILE_LIMITS.avatar, square: true, quality: 0.5 });
    if (!picked) return;

    setUploading(true);
    setFormError(null);
    try {
      await uploadAvatar(profile.uid, picked.uri);
      await onSaved();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    const nextErrors: Record<string, FieldError> = {
      name: validateName(name),
      bio: validateBio(bio),
    };
    setErrors(nextErrors);
    setFormError(null);

    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);
    try {
      await updateProfile(profile.uid, {
        name,
        bio: bio.trim(),
        location: location.trim(),
        role,
      });

      // Persist only the sections that match the chosen role. A teacher-only
      // profile must not keep "want to learn" tags discoverable elsewhere, and
      // a learner-only profile must not appear in skill-offer searches.
      const nextOffered = canTeach
        ? offeredTags.map((skill) => ({ skill, level: offered[skill] }))
        : [];
      const nextGoals = canLearn ? draftGoals : [];
      const nextExtraWanted = canLearn ? extraWanted : [];

      await setSkillsOffered(profile.uid, nextOffered);
      await setCareerGoals(profile.uid, nextGoals, nextExtraWanted);
      await onSaved();
      router.back();
    } catch (error) {
      setFormError(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Edit profile" showBack />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {formError ? <Notice tone="error" message={formError} /> : null}
          {pickerError ? <Notice tone="error" message={pickerError} /> : null}

          <View style={styles.avatarBlock}>
            <Avatar name={profile.name} uri={profile.avatarUrl || undefined} size="lg" />
            <Pressable
              onPress={onChangeAvatar}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
              style={styles.avatarAction}>
              <Ionicons name="camera-outline" size={sizes.iconSm} color={colors.accent} />
              <Text style={styles.avatarActionText}>
                {uploading ? 'Uploading…' : 'Change photo'}
              </Text>
            </Pressable>
          </View>

          <Input
            label="Full name"
            value={name}
            onChangeText={setName}
            onBlur={() => setErrors((e) => ({ ...e, name: validateName(name) }))}
            error={errors.name}
            icon="person-outline"
            autoCapitalize="words"
          />

          <Input
            label="Bio"
            value={bio}
            onChangeText={setBio}
            onBlur={() => setErrors((e) => ({ ...e, bio: validateBio(bio) }))}
            error={errors.bio}
            helper={`${bio.length}/${TEXT_LIMITS.bio} characters`}
            placeholder="What do you enjoy teaching, and how?"
            maxLength={TEXT_LIMITS.bio}
            autoCapitalize="sentences"
            multiline
          />

          <Input
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="NSBM, Homagama"
            icon="location-outline"
            autoCapitalize="words"
          />

          <ChipSelect
            label="How you use SkillBridge"
            options={ROLE_OPTIONS}
            value={role}
            onChange={onRoleChange}
            helper={
              role === 'learner'
                ? 'Learn-only hides teaching skills and credential management.'
                : role === 'teacher'
                  ? 'Teach-only hides skills you want to learn.'
                  : 'You can list skills to teach and skills to learn.'
            }
          />

          {canTeach || canLearn ? <View style={styles.divider} /> : null}

          {canTeach || canLearn ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}>
              <Chip
                size="sm"
                label="All"
                selected={category === 'All'}
                onPress={() => setCategory('All')}
              />
              {CATEGORIES.map((item) => (
                <Chip
                  key={item}
                  size="sm"
                  label={item}
                  selected={category === item}
                  onPress={() => setCategory(item)}
                />
              ))}
            </ScrollView>
          ) : null}

          {canTeach ? (
            <View style={styles.skillSection}>
              <Text style={styles.sectionTitle}>Skills you can teach</Text>
              <View style={styles.chipWrap}>
                {visibleSkills.map((skill) => (
                  <Chip
                    key={skill.tag}
                    size="sm"
                    label={skill.label}
                    selected={skill.tag in offered}
                    onPress={() => toggleOffered(skill.tag)}
                  />
                ))}
              </View>

              {offeredTags.length > 0 ? (
                <View style={styles.levels}>
                  <Text style={styles.subTitle}>Your level</Text>
                  {offeredTags.map((tag) => (
                    <View key={tag} style={styles.levelRow}>
                      <Text style={styles.levelSkill}>{skillLabel(tag)}</Text>
                      <View style={styles.levelChips}>
                        {LEVELS.map((level) => (
                          <Chip
                            key={level}
                            size="sm"
                            label={LEVEL_LABELS[level]}
                            selected={offered[tag] === level}
                            onPress={() => setOffered((prev) => ({ ...prev, [tag]: level }))}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                  <Text style={styles.note}>
                    Removing a skill never deletes its credentials — they move to an
                    &quot;Unlinked&quot; group in My Credentials.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {canTeach && canLearn ? <View style={styles.divider} /> : null}

          {canLearn ? (
            <View style={styles.skillSection}>
              <Text style={styles.sectionTitle}>Career goals</Text>
              <Text style={styles.note}>
                Pick one or more goals — we&apos;ll suggest the skills that matter for each.
              </Text>

              {draftGoals.map((g) => {
                const def = careerGoalByTag(g.goal);
                const isEditing = editingGoal === g.goal;
                return (
                  <Card key={g.goal} style={styles.goalCard}>
                    <View style={styles.goalCardHeader}>
                      <Text style={styles.subTitle}>{def?.label ?? g.goal}</Text>
                      <View style={styles.goalCardActions}>
                        <Pressable
                          onPress={() => (isEditing ? cancelEditGoal() : startEditGoal(g.goal))}
                          hitSlop={spacing.sm}
                          accessibilityRole="button"
                          accessibilityLabel={isEditing ? 'Cancel editing skills' : 'Edit skills'}>
                          <Text style={styles.linkText}>{isEditing ? 'Cancel' : 'Edit skills'}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => removeGoal(g.goal)}
                          hitSlop={spacing.sm}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${def?.label ?? g.goal} goal`}>
                          <Text style={styles.linkTextDanger}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>

                    {isEditing ? (
                      <>
                        <View style={styles.selectAllRow}>
                          <Button label="Select all" variant="secondary" onPress={selectAllEditingSkills} />
                        </View>
                        <View style={styles.chipWrap}>
                          {skillsInGoal(g.goal).map((skill) => (
                            <Chip
                              key={skill.tag}
                              size="sm"
                              label={skill.label}
                              selected={editingSkills.includes(skill.tag)}
                              onPress={() => toggleEditingSkill(skill.tag)}
                            />
                          ))}
                        </View>
                        <Button label="Done" onPress={saveGoalSkills} style={styles.goalDone} />
                      </>
                    ) : g.skillTags.length > 0 ? (
                      <View style={styles.chipWrap}>
                        {g.skillTags.map((tag) => (
                          <Chip key={tag} size="sm" label={skillLabel(tag)} />
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.note}>No skills selected yet.</Text>
                    )}
                  </Card>
                );
              })}

              {addingGoal ? (
                <View style={styles.chipWrap}>
                  {availableGoalsToAdd.map((g) => (
                    <Chip key={g.tag} size="sm" label={g.label} onPress={() => pickGoalToAdd(g.tag)} />
                  ))}
                </View>
              ) : null}

              {availableGoalsToAdd.length > 0 ? (
                <Pressable
                  onPress={() => setAddingGoal((v) => !v)}
                  hitSlop={spacing.sm}
                  accessibilityRole="button"
                  accessibilityLabel="Add a career goal">
                  <Text style={styles.linkText}>{addingGoal ? 'Close' : '+ Add a career goal'}</Text>
                </Pressable>
              ) : null}

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>Other skills you want to learn</Text>
              <Text style={styles.note}>Skills that don&apos;t fit a specific goal above.</Text>
              <View style={styles.chipWrap}>
                {visibleSkills.map((skill) => (
                  <Chip
                    key={`want-${skill.tag}`}
                    size="sm"
                    label={skill.label}
                    selected={extraWanted.includes(skill.tag)}
                    onPress={() => toggleExtraWanted(skill.tag)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Button label="Save changes" onPress={onSave} loading={saving} style={styles.save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  avatarBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: sizes.touchMin,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  avatarActionText: {
    ...type.label,
    color: colors.accent,
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  skillSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...type.h1,
    color: colors.ink,
  },
  subTitle: {
    ...type.h2,
    color: colors.ink,
  },
  categoryRow: {
    gap: spacing.xs + 2,
    paddingRight: spacing.lg,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  levels: {
    gap: spacing.md,
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
  note: {
    ...type.caption,
    color: colors.inkMuted,
  },
  goalCard: {
    gap: spacing.md,
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  goalCardActions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  linkText: {
    ...type.label,
    color: colors.accent,
  },
  linkTextDanger: {
    ...type.label,
    color: colors.danger,
  },
  goalDone: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xl,
  },
  selectAllRow: {
    flexDirection: 'row',
  },
  save: {
    marginTop: spacing.md,
  },
});
