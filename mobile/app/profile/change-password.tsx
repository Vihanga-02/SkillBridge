import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { changePassword } from '@/services/authService';
import { errorMessage } from '@/utils/authErrors';
import {
  validateConfirmPassword,
  validatePassword,
  type FieldError,
} from '@/utils/validation';

/**
 * Account security screen — sits under My account, not inside Edit profile,
 * so password changes stay separate from name/bio/skills edits.
 */
export default function ChangePasswordScreen() {
  const { firebaseUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function validateCurrent(value: string): FieldError {
    if (!value) return 'Enter your current password.';
    return null;
  }

  function validateNew(value: string): FieldError {
    const base = validatePassword(value);
    if (base) return base;
    if (value === currentPassword) return 'New password must be different from the current one.';
    return null;
  }

  async function onSubmit() {
    const nextErrors: Record<string, FieldError> = {
      current: validateCurrent(currentPassword),
      next: validateNew(newPassword),
      confirm: validateConfirmPassword(newPassword, confirmPassword),
    };
    setErrors(nextErrors);
    setFormError(null);

    if (Object.values(nextErrors).some(Boolean)) return;
    if (!firebaseUser?.email) {
      setFormError('You need to be signed in with email to change your password.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setDone(true);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="Password updated" showBack />
        <View style={styles.centered}>
          <EmptyState
            icon="checkmark-circle-outline"
            title="Password changed"
            message="Use your new password the next time you log in."
            actionLabel="Back to My account"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ScreenHeader
            title="Change password"
            subtitle={
              firebaseUser?.email
                ? `Signed in as ${firebaseUser.email}`
                : 'Enter your current password, then choose a new one.'
            }
            showBack
          />

          <View style={styles.form}>
            {formError ? <Notice tone="error" message={formError} /> : null}

            <Input
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              onBlur={() => setErrors((e) => ({ ...e, current: validateCurrent(currentPassword) }))}
              error={errors.current}
              placeholder="Your current password"
              icon="lock-closed-outline"
              autoComplete="password"
              secure
              returnKeyType="next"
            />

            <Input
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              onBlur={() => setErrors((e) => ({ ...e, next: validateNew(newPassword) }))}
              error={errors.next}
              helper="At least 6 characters."
              placeholder="Choose a new password"
              icon="key-outline"
              autoComplete="new-password"
              secure
              returnKeyType="next"
            />

            <Input
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onBlur={() =>
                setErrors((e) => ({
                  ...e,
                  confirm: validateConfirmPassword(newPassword, confirmPassword),
                }))
              }
              error={errors.confirm}
              placeholder="Re-enter the new password"
              icon="key-outline"
              autoComplete="new-password"
              secure
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />

            <Button label="Update password" onPress={onSubmit} loading={submitting} />
          </View>
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
    flexGrow: 1,
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  form: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
