import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/ui/BrandMark';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { colors, spacing } from '@/constants/theme';
import { AuthProvider } from '@/context/AuthContext';
import { useAuth } from '@/hooks/useAuth';

/**
 * Every guard failure falls back to `index`, which re-reads the auth state and
 * redirects — so there is exactly one place that decides where a user belongs.
 */
export const unstable_settings = {
  anchor: 'index',
};

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { loading, firebaseUser, profile, error, refreshProfile } = useAuth();

  // Only the very first resolve blocks the UI. Later auth changes are handled by
  // the guards below, so logging in or out never flashes the splash again.
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (!loading && !bootstrapped) {
      setBootstrapped(true);
      void SplashScreen.hideAsync();
    }
  }, [loading, bootstrapped]);

  if (!bootstrapped) {
    return (
      <View style={styles.splash}>
        <BrandMark tagline="Peer learning for your campus." />
        <LoadingState />
      </View>
    );
  }

  // A signed-in user whose profile cannot be read is not a routing decision —
  // it is a failure the user has to be told about, with a way out.
  if (firebaseUser && !profile && error) {
    return (
      <View style={styles.splash}>
        <ErrorState message={error} onRetry={() => void refreshProfile()} />
      </View>
    );
  }

  const onboarded = !loading && !!firebaseUser && profile?.onboardingComplete === true;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="index" />

      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>

      <Stack.Screen name="+not-found" options={{ headerShown: true, title: 'Not found' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
});
