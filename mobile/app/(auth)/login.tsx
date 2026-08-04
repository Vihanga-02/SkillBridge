import { Link, router } from 'expo-router';
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

import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { colors, spacing, type } from '@/constants/theme';
import { login } from '@/services/authService';
import { errorMessage } from '@/utils/authErrors';
import { validateEmail, validatePassword, type FieldError } from '@/utils/validation';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<FieldError>(null);
  const [passwordError, setPasswordError] = useState<FieldError>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    const nextEmailError = validateEmail(email);
    const nextPasswordError = validatePassword(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError(null);

    if (nextEmailError || nextPasswordError) return;

    setSubmitting(true);
    try {
      await login(email, password);
      // Routing is handled by the guards in app/_layout.tsx once the profile loads.
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
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
          <BrandMark tagline="Trade skills with your campus community." />

          <View style={styles.form}>
            <Text style={styles.heading}>Welcome back</Text>

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
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              onBlur={() => setPasswordError(validatePassword(password))}
              error={passwordError}
              placeholder="Your password"
              icon="lock-closed-outline"
              autoComplete="current-password"
              secure
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />

            <Pressable
              onPress={() => router.push('/(auth)/forgot-password')}
              hitSlop={spacing.sm}
              accessibilityRole="link"
              style={styles.forgot}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>

            <Button label="Log in" onPress={onSubmit} loading={submitting} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to SkillBridge? </Text>
            <Link href="/(auth)/register" style={styles.link}>
              Create an account
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
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.lg,
  },
  heading: {
    ...type.h1,
    color: colors.ink,
  },
  form: {
    gap: spacing.lg,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -spacing.sm,
  },
  link: {
    ...type.label,
    color: colors.accent,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    ...type.body,
    color: colors.inkMuted,
  },
});
