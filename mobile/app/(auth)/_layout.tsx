import { Redirect, Stack, useSegments } from 'expo-router';

import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

/**
 * The auth group is reachable while a user is signed out AND while they are
 * signed in but have not finished onboarding — onboarding is the last step of
 * account creation, not a separate area of the app.
 */
export default function AuthLayout() {
  const { firebaseUser, profile } = useAuth();
  const segments = useSegments();

  const needsOnboarding = !!firebaseUser && !profile?.onboardingComplete;
  const onOnboarding = segments[segments.length - 1] === 'onboarding';

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
