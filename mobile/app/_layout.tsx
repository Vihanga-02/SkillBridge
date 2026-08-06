import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
    // Needed by the pinch-to-zoom credential viewer, and by the gestures every
    // other component's lists will use.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="dark" />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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

      {/*
        Every signed-in screen is declared inside this guard. A route left
        undeclared is still reachable by deep link regardless of auth state, so
        omitting one here would open a hole the security rules then have to close.
      */}
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="credential/[id]" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="profile/credentials/index" />
        <Stack.Screen name="profile/credentials/add" />
        <Stack.Screen name="profile/skill-test/[skill]" />
      </Stack.Protected>

      <Stack.Screen name="+not-found" options={{ headerShown: true, title: 'Not found' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
});
