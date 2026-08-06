import { Redirect, Stack, useSegments } from 'expo-router';

import { LoadingState } from '@/components/ui/LoadingState';
import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

/**
 * The auth group is reachable while a user is signed out AND while they are
 * signed in but have not finished onboarding — onboarding is the last step of
 * account creation, not a separate area of the app.
 *
 * While a just-signed-in profile is still loading, `profile` is null — that is
 * NOT the same as "needs onboarding". Redirecting on that gap flashes the
 * onboarding wizard at returning users for a frame. Wait for `loading` first.
 */
export default function AuthLayout() {
  const { loading, firebaseUser, profile } = useAuth();
  const segments = useSegments();

  const onOnboarding = segments[segments.length - 1] === 'onboarding';

  // Profile is still resolving after login/register — hold the current screen
  // (or a splash) rather than guessing onboarding vs tabs.
  if (loading && firebaseUser) {
    return <LoadingState fullScreen label="Signing you in…" />;
  }

  const needsOnboarding = !!firebaseUser && profile?.onboardingComplete !== true;

  if (needsOnboarding && !onOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
