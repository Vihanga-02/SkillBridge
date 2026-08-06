import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { DateField } from '@/components/ui/DateField';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { CREDENTIAL_TYPE_LABEL } from '@/components/user/CredentialCard';
import { FILE_LIMITS, TEXT_LIMITS } from '@/constants/config';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useMediaPicker, type PickedFile } from '@/hooks/useMediaPicker';
import {
  addCredential,
  deleteCredential,
  getCredential,
  toCredentialInput,
  updateCredential,
  type CredentialInput,
} from '@/services/credentialService';
import type { Credential, CredentialType, SkillTag } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import { formatFileSize } from '@/utils/format';
import { validateHttpsUrl, type FieldError } from '@/utils/validation';

const TYPE_OPTIONS = (
  ['certificate', 'degree', 'course', 'award', 'work_experience', 'portfolio', 'other'] as const
).map((value) => ({ value, label: CREDENTIAL_TYPE_LABEL[value] }));

const VISIBILITY_OPTIONS = [
  { value: 'public' as const, label: 'Visible to everyone' },
  { value: 'private' as const, label: 'Only me' },
];

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): CredentialInput => ({
  skillTag: '' as SkillTag,
  type: 'certificate',
  title: '',
  issuer: '',
  issueDate: '',
  expiryDate: '',
  referenceNo: '',
  verifyUrl: '',
  description: '',
  visibility: 'public',
});

export default function CredentialFormScreen() {
  const { credentialId } = useLocalSearchParams<{ credentialId?: string }>();
  const { profile, refreshProfile } = useAuth();
  const { pickImage, pickPdf, error: pickerError, clearError } = useMediaPicker();

  const isEditing = !!credentialId;

  const [form, setForm] = useState<CredentialInput>(emptyForm);
  const [existing, setExisting] = useState<Credential | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!credentialId || !profile) return;

    let active = true;
    (async () => {
      try {
        const credential = await getCredential(profile.uid, credentialId);
        if (!active) return;
        if (!credential) {
          setFormError('That credential no longer exists.');
        } else {
          setExisting(credential);
          setForm(toCredentialInput(credential));
        }
      } catch (error) {
        if (active) setFormError(errorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [credentialId, profile]);

  if (!profile) return <LoadingState fullScreen label="Loading…" />;

  const set = <K extends keyof CredentialInput>(key: K, value: CredentialInput[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  // A credential must back a skill the user actually offers — a picker, never free text.
  const skillOptions = profile.skillsOffered.map((skill) => ({
    value: skill.skill,
    label: skill.label,
  }));

  if (skillOptions.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Add a credential" showBack />
        <EmptyState
          icon="pricetags-outline"
          title="Pick a skill first"
          message="Every credential backs one of the skills you offer, so choose your skills before attaching evidence."
          actionLabel="Choose skills"
          onAction={() => router.replace('/profile/edit')}
        />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Edit credential" showBack />
        <LoadingState label="Loading credential…" />
      </SafeAreaView>
    );
  }

  function validate(): boolean {
    const title = form.title.trim();
    const issuer = form.issuer.trim();
    const { credentialTitle, credentialIssuer, credentialDescription } = TEXT_LIMITS;

    const next: Record<string, FieldError> = {
      skillTag: form.skillTag ? null : 'Choose the skill this backs.',
      title:
        title.length < credentialTitle.min || title.length > credentialTitle.max
          ? `Title must be ${credentialTitle.min}–${credentialTitle.max} characters.`
          : null,
      issuer:
        issuer.length < credentialIssuer.min || issuer.length > credentialIssuer.max
          ? `Issuer must be ${credentialIssuer.min}–${credentialIssuer.max} characters.`
          : null,
      issueDate: form.issueDate ? null : 'An issue date is required.',
      expiryDate:
        form.expiryDate && form.issueDate && form.expiryDate <= form.issueDate
          ? 'Expiry must be after the issue date.'
          : null,
      verifyUrl: validateHttpsUrl(form.verifyUrl),
      description:
        form.description.length > credentialDescription
          ? `Description must be under ${credentialDescription} characters.`
          : null,
    };

    setErrors(next);
    return !Object.values(next).some(Boolean);
  }

  async function onPickImage() {
    clearError();
    const picked = await pickImage({ maxBytes: FILE_LIMITS.credential, quality: 0.7 });
    if (picked) setFile(picked);
  }

  async function onPickPdf() {
    clearError();
    const picked = await pickPdf(FILE_LIMITS.credential);
    if (picked) setFile(picked);
  }

  async function onSave() {
    setFormError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const upload = file ? { uri: file.uri, contentType: file.contentType, kind: file.kind } : undefined;

      if (isEditing && credentialId) {
        await updateCredential(profile!.uid, credentialId, form, upload);
      } else {
        await addCredential(profile!.uid, form, upload);
      }

      // The counters live on the user document, which the profile reads.
      await refreshProfile();
      router.back();
    } catch (error) {
      setFormError(errorMessage(error));
      setSaving(false);
    }
  }

  function onDelete() {
    Alert.alert(
      'Delete this credential?',
      'The document and its details are removed permanently. Your skill stays on your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteCredential(profile!.uid, credentialId!);
              await refreshProfile();
              router.back();
            } catch (error) {
              setFormError(errorMessage(error));
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  const attachedLabel = file
    ? `${file.name}${file.sizeBytes > 0 ? ` · ${formatFileSize(file.sizeBytes)}` : ''}`
    : existing && existing.fileType !== 'none'
      ? `${existing.fileType === 'pdf' ? 'PDF' : 'Image'} · ${formatFileSize(existing.fileSizeBytes)}`
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={isEditing ? 'Edit credential' : 'Add a credential'} showBack />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {formError ? <Notice tone="error" message={formError} /> : null}
          {pickerError ? <Notice tone="error" message={pickerError} /> : null}

          <Notice
            tone="info"
            message="SkillBridge does not check credentials. Yours will be shown to learners as self-declared evidence."
          />

          <ChipSelect
            label="Skill it backs"
            options={skillOptions}
            value={form.skillTag || null}
            onChange={(value) => set('skillTag', value as SkillTag)}
            error={errors.skillTag}
          />

          <ChipSelect
            label="Type"
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(value) => set('type', value as CredentialType)}
          />

          <Input
            label="Title"
            value={form.title}
            onChangeText={(value) => set('title', value)}
            error={errors.title}
            placeholder="Google IT Support Professional Certificate"
            maxLength={TEXT_LIMITS.credentialTitle.max}
            autoCapitalize="words"
          />

          <Input
            label="Issuer"
            value={form.issuer}
            onChangeText={(value) => set('issuer', value)}
            error={errors.issuer}
            placeholder="Coursera / Google"
            maxLength={TEXT_LIMITS.credentialIssuer.max}
            autoCapitalize="words"
          />

          <DateField
            label="Issue date"
            value={form.issueDate}
            onChange={(value) => set('issueDate', value)}
            error={errors.issueDate}
            maxDate={today()}
            helper="Cannot be in the future."
          />

          <DateField
            label="Expiry date (optional)"
            value={form.expiryDate}
            onChange={(value) => set('expiryDate', value)}
            error={errors.expiryDate}
            minDate={form.issueDate || undefined}
            clearable
            helper="An expired credential is marked, never hidden."
          />

          <Input
            label="Reference number (optional)"
            value={form.referenceNo}
            onChangeText={(value) => set('referenceNo', value)}
            placeholder="ABC-12345"
            autoCapitalize="characters"
          />

          <Input
            label="Verification link (optional)"
            value={form.verifyUrl}
            onChangeText={(value) => set('verifyUrl', value)}
            error={errors.verifyUrl}
            placeholder="https://coursera.org/verify/…"
            keyboardType="url"
            autoCapitalize="none"
          />

          <Input
            label="Description (optional)"
            value={form.description}
            onChangeText={(value) => set('description', value)}
            error={errors.description}
            helper={`${form.description.length}/${TEXT_LIMITS.credentialDescription} characters`}
            placeholder="What did it cover, and what can you teach from it?"
            maxLength={TEXT_LIMITS.credentialDescription}
            multiline
          />

          <View style={styles.fileBlock}>
            <Text style={styles.label}>Document (optional)</Text>
            <Text style={styles.helper}>
              An image or PDF up to {formatFileSize(FILE_LIMITS.credential)}. A credential with no
              document tells the learner something too.
            </Text>

            {attachedLabel ? (
              <View style={styles.attached}>
                <Ionicons name="document-attach-outline" size={sizes.iconMd} color={colors.accent} />
                <Text style={styles.attachedText} numberOfLines={1}>
                  {attachedLabel}
                </Text>
                {file ? (
                  <Pressable
                    onPress={() => setFile(null)}
                    hitSlop={spacing.md}
                    accessibilityRole="button"
                    accessibilityLabel="Remove selected file">
                    <Ionicons name="close-circle" size={sizes.iconMd} color={colors.inkMuted} />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={styles.helper}>No document attached.</Text>
            )}

            <View style={styles.fileActions}>
              <Button
                label="Photo"
                variant="secondary"
                icon="image-outline"
                onPress={onPickImage}
                style={styles.fileButton}
              />
              <Button
                label="PDF"
                variant="secondary"
                icon="document-outline"
                onPress={onPickPdf}
                style={styles.fileButton}
              />
            </View>
          </View>

          <ChipSelect
            label="Visibility"
            options={VISIBILITY_OPTIONS}
            value={form.visibility}
            onChange={(value) => set('visibility', value)}
          />

          <Button
            label={isEditing ? 'Save changes' : 'Add credential'}
            onPress={onSave}
            loading={saving}
            style={styles.save}
          />

          {isEditing ? (
            <Button
              label="Delete credential"
              variant="ghost"
              icon="trash-outline"
              loading={deleting}
              onPress={onDelete}
            />
          ) : null}
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
  fileBlock: {
    gap: spacing.sm,
  },
  label: {
    ...type.label,
    color: colors.ink,
  },
  helper: {
    ...type.caption,
    color: colors.inkMuted,
  },
  attached: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.accentSurface,
    borderRadius: radius.sm,
  },
  attachedText: {
    ...type.label,
    color: colors.ink,
    flex: 1,
  },
  fileActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fileButton: {
    flex: 1,
  },
  save: {
    marginTop: spacing.md,
  },
});
