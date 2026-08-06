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
import { Chip } from '@/components/ui/Chip';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
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
import {
  setSkillsOffered,
  setSkillsWanted,
  updateProfile,
  uploadAvatar,
} from '@/services/userService';
import type { User, UserRole } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import { validateBio, validateName, type FieldError } from '@/utils/validation';

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
  const [wanted, setWanted] = useState<SkillTag[]>(() =>
    profile.skillsWanted.map((skill) => skill.skill)
  );

  const [category, setCategory] = useState<Category | 'All'>('All');
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canTeach = role === 'teacher' || role === 'both';
  const canLearn = role === 'learner' || role === 'both';
  const offeredTags = Object.keys(offered) as SkillTag[];
  const visibleSkills = category === 'All' ? SKILLS : SKILLS.filter((s) => s.category === category);

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

  function toggleWanted(tag: SkillTag) {
    setWanted((previous) =>
      previous.includes(tag) ? previous.filter((t) => t !== tag) : [...previous, tag]
    );
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
      const nextWanted = canLearn ? wanted : [];

      await setSkillsOffered(profile.uid, nextOffered);
      await setSkillsWanted(profile.uid, nextWanted);
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
              <Text style={styles.sectionTitle}>Skills you want to learn</Text>
              <View style={styles.chipWrap}>
                {visibleSkills.map((skill) => (
                  <Chip
                    key={`want-${skill.tag}`}
                    size="sm"
                    label={skill.label}
                    selected={wanted.includes(skill.tag)}
                    onPress={() => toggleWanted(skill.tag)}
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
  save: {
    marginTop: spacing.md,
  },
});
