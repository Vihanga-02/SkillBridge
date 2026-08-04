import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
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

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, sizes, spacing, type } from '@/constants/theme';
import { register } from '@/services/authService';
import { errorMessage } from '@/utils/authErrors';
import {
  validateConfirmPassword,
  validateEmail,
  validateName,
  validatePassword,
  type FieldError,
} from '@/utils/validation';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);

  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setFieldError = (field: string, error: FieldError) =>
    setErrors((previous) => ({ ...previous, [field]: error }));

  async function onSubmit() {
    const nextErrors: Record<string, FieldError> = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: validateConfirmPassword(password, confirm),
    };
    setErrors(nextErrors);
    setFormError(null);

    if (Object.values(nextErrors).some(Boolean)) return;
    if (!accepted) {
      setFormError('Please accept the terms to create an account.');
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password, name);
      // The account now exists with onboardingComplete: false, so the auth group
      // layout sends the user straight into the onboarding wizard.
    } catch (error) {
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
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
            title="Create account"
            subtitle="Teach what you know, learn what you don't."
            showBack
          />

          <View style={styles.form}>
            {formError ? <Notice tone="error" message={formError} /> : null}

            <Input
              label="Full name"
              value={name}
              onChangeText={setName}
              onBlur={() => setFieldError('name', validateName(name))}
              error={errors.name}
              placeholder="Chamath Perera"
              icon="person-outline"
              autoCapitalize="words"
              autoComplete="name"
            />

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setFieldError('email', validateEmail(email))}
              error={errors.email}
              placeholder="you@campus.lk"
              icon="mail-outline"
              keyboardType="email-address"
              autoComplete="email"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              onBlur={() => setFieldError('password', validatePassword(password))}
              error={errors.password}
              helper="At least 6 characters."
              placeholder="Create a password"
              icon="lock-closed-outline"
              autoComplete="new-password"
              secure
            />

            <Input
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              onBlur={() => setFieldError('confirm', validateConfirmPassword(password, confirm))}
              error={errors.confirm}
              placeholder="Re-enter your password"
              icon="lock-closed-outline"
              autoComplete="new-password"
              secure
            />

            <Pressable
              onPress={() => setAccepted((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              accessibilityLabel="Accept the community guidelines and privacy terms"
              style={styles.terms}>
              <Ionicons
                name={accepted ? 'checkbox' : 'square-outline'}
                size={sizes.iconLg}
                color={accepted ? colors.accent : colors.inkMuted}
              />
              <Text style={styles.termsText}>
                I agree to the community guidelines and to SkillBridge storing my profile and
                learning activity.
              </Text>
            </Pressable>

            <Button label="Create account" onPress={onSubmit} loading={submitting} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.link}>
              Log in
            </Link>
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
  terms: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: sizes.touchMin,
  },
  termsText: {
    ...type.caption,
    color: colors.inkMuted,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  footerText: {
    ...type.body,
    color: colors.inkMuted,
  },
  link: {
    ...type.label,
    color: colors.accent,
  },
});
