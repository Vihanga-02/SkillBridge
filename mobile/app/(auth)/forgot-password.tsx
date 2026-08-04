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
import { resetPassword } from '@/services/authService';
import { errorMessage } from '@/utils/authErrors';
import { validateEmail, type FieldError } from '@/utils/validation';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<FieldError>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);
    setFormError(null);
    if (nextEmailError) return;

    setSubmitting(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="Check your email" showBack />
        <View style={styles.centered}>
          <EmptyState
            icon="mail-open-outline"
            title="Reset link sent"
            message={`We emailed a password reset link to ${email.trim()}. Open it on this device, choose a new password, then log in again.`}
            actionLabel="Back to login"
            onAction={() => router.replace('/(auth)/login')}
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            title="Reset password"
            subtitle="We'll email you a link to choose a new one."
            showBack
          />

          <View style={styles.form}>
            {formError ? <Notice tone="error" message={formError} /> : null}

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setEmailError(validateEmail(email))}
              error={emailError}
              placeholder="you@campus.lk"
              icon="mail-outline"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={onSubmit}
            />

            <Button label="Send reset link" onPress={onSubmit} loading={submitting} />
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
    paddingVertical: spacing.lg,
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
