import { Redirect } from 'expo-router';

import { LoadingState } from '@/components/ui/LoadingState';
import { useAuth } from '@/hooks/useAuth';

/**
 * The single redirect gate (§4.5):
 *   loading                     -> splash
 *   no user                     -> /(auth)/login
 *   user + !onboardingComplete  -> /(auth)/onboarding
 *   user + onboardingComplete   -> /(tabs)/discovery
 *
 * Never treat a missing profile during load as "needs onboarding" — that flash
 * is exactly what returning users saw after email/password login.
 */
export default function IndexGate() {
  const { loading, firebaseUser, profile } = useAuth();

  if (loading) return <LoadingState fullScreen label="Signing you in…" />;
  if (!firebaseUser) return <Redirect href="/(auth)/login" />;
  if (profile?.onboardingComplete !== true) return <Redirect href="/(auth)/onboarding" />;

  return <Redirect href="/(tabs)/discovery" />;
}
