import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { CredentialsBySkill } from '@/components/user/CredentialsBySkill';
import { colors, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { listCredentials, recountCredentials } from '@/services/credentialService';
import type { Credential } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import { plural } from '@/utils/format';

export default function MyCredentialsScreen() {
  const { profile, refreshProfile } = useAuth();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recounting, setRecounting] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    try {
      setCredentials(await listCredentials(profile.uid));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // Reload on focus so returning from the add form shows the new credential.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function onRecount() {
    if (!profile) return;
    setRecounting(true);
    setNotice(null);
    try {
      await recountCredentials(profile.uid);
      await refreshProfile();
      await load();
      setNotice('Counts rebuilt from your credentials.');
    } catch (recountError) {
      setError(errorMessage(recountError));
    } finally {
      setRecounting(false);
    }
  }

  if (!profile) return <LoadingState fullScreen label="Loading…" />;

  /**
   * Gated on the live `profile.role`, not a value captured at mount, so switching
   * role in the editor takes effect immediately.
   */
  if (profile.role === 'learner') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="My credentials" showBack />
        <EmptyState
          icon="school-outline"
          title="Credentials are for teaching"
          message="Switch your profile to Teach or Teach & learn to attach evidence to the skills you offer."
          actionLabel="Edit profile"
          onAction={() => router.push('/profile/edit')}
        />
      </SafeAreaView>
    );
  }

  const hasSkills = profile.skillsOffered.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="My credentials"
        subtitle={`${plural(credentials.length, 'credential')} · self-declared`}
        showBack
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {notice ? <Notice tone="success" message={notice} /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {loading ? (
          <LoadingState label="Loading your credentials…" />
        ) : !hasSkills ? (
          <EmptyState
            icon="pricetags-outline"
            title="Add a skill first"
            message="A credential has to back one of the skills you offer, so pick your skills before adding evidence."
            actionLabel="Choose skills"
            onAction={() => router.push('/profile/edit')}
          />
        ) : credentials.length === 0 ? (
          <EmptyState
            icon="ribbon-outline"
            title="No credentials yet"
            message="Attach a certificate, transcript or portfolio to a skill so learners can judge your evidence before booking."
            actionLabel="Add a credential"
            onAction={() => router.push('/profile/credentials/add')}
          />
        ) : (
          <>
            <CredentialsBySkill
              skillsOffered={profile.skillsOffered}
              credentials={credentials}
              showVisibility
              onOpen={(credential) =>
                router.push({
                  pathname: '/credential/[id]',
                  params: { id: credential.id, ownerId: profile.uid },
                })
              }
              onEdit={(credential) =>
                router.push({
                  pathname: '/profile/credentials/add',
                  params: { credentialId: credential.id },
                })
              }
            />

            <View style={styles.footer}>
              <Text style={styles.footerNote}>
                Counts on your profile are stored, not calculated. If a &quot;📄 2&quot; ever looks
                wrong, rebuild it from the credentials themselves.
              </Text>
              <Button
                label="Recount"
                variant="ghost"
                icon="refresh-outline"
                loading={recounting}
                onPress={() =>
                  Alert.alert(
                    'Rebuild counts?',
                    'This re-reads your credentials and rewrites the counters on your profile.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Recount', onPress: () => void onRecount() },
                    ]
                  )
                }
              />
            </View>
          </>
        )}
      </ScrollView>

      {hasSkills ? (
        <View style={styles.addBar}>
          <Button
            label="Add a credential"
            icon="add"
            onPress={() => router.push('/profile/credentials/add')}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  footerNote: {
    ...type.caption,
    color: colors.inkMuted,
  },
  addBar: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
});
