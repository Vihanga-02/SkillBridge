import { Redirect } from 'expo-router';

import { LoadingState } from '@/components/ui/LoadingState';
import { useAuth } from '@/hooks/useAuth';

/**
 * The single redirect gate (§4.5):
 *   loading                     -> splash
 *   no user                     -> /(auth)/login
 *   user + !onboardingComplete  -> /(auth)/onboarding
 *   user + onboardingComplete   -> /(tabs)/discovery
 */
export default function IndexGate() {
  const { loading, firebaseUser, profile } = useAuth();

  if (loading) return <LoadingState fullScreen />;
  if (!firebaseUser) return <Redirect href="/(auth)/login" />;
  if (!profile?.onboardingComplete) return <Redirect href="/(auth)/onboarding" />;

  return <Redirect href="/(tabs)/discovery" />;
}
