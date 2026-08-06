import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { CredentialsBySkill } from '@/components/user/CredentialsBySkill';
import { ProfileHeader } from '@/components/user/ProfileHeader';
import { SkillPortfolio } from '@/components/user/SkillPortfolio';
import { colors, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { listCredentials, listPublicCredentials } from '@/services/credentialService';
import { subscribeToUser } from '@/services/userService';
import type { Credential, User } from '@/types';
import { errorMessage } from '@/utils/authErrors';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);

  const isOwnProfile = !!me && me.uid === id;

  // Live, so a rating written by Member 4's review transaction appears without a
  // manual refresh — this screen only ever reads ratingAvg and ratingCount.
  useEffect(() => {
    if (!id) return;

    setUserLoading(true);
    const unsubscribe = subscribeToUser(
      id,
      (next) => {
        setUser(next);
        setUserLoading(false);
        setUserError(null);
      },
      (error) => {
        setUserLoading(false);
        setUserError(errorMessage(error));
      }
    );

    return unsubscribe;
  }, [id]);

  const loadCredentials = useCallback(async () => {
    if (!id) return;
    setCredentialsError(null);
    try {
      // The owner sees private credentials too; everyone else must ask for public
      // ones explicitly, because the security rule is evaluated against the query.
      const rows = isOwnProfile ? await listCredentials(id) : await listPublicCredentials(id);
      setCredentials(rows);
    } catch (error) {
      setCredentialsError(errorMessage(error));
    }
  }, [id, isOwnProfile]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  if (userLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Profile" showBack />
        <LoadingState label="Loading profile…" />
      </SafeAreaView>
    );
  }

  if (userError || !user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Profile" showBack />
        <ErrorState
          message={userError ?? 'This profile could not be found. It may have been removed.'}
          onRetry={() => router.back()}
          retryLabel="Go back"
        />
      </SafeAreaView>
    );
  }

  const canManageCredentials = isOwnProfile && user.role !== 'learner';
  const canTeach = user.role === 'teacher' || user.role === 'both';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={isOwnProfile ? 'My profile' : 'Profile'} showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileHeader
          user={user}
          isOwnProfile={isOwnProfile}
          onEdit={() => router.push('/profile/edit')}
          // Booking is Component 3 and messaging is Component 4; both CTAs stay
          // visible but disabled so the profile layout does not change later.
          ctaDisabledReason={
            isOwnProfile
              ? undefined
              : 'Booking and messaging arrive with Components 3 and 4.'
          }
        />

        <View style={styles.section}>
          <Card>
            {/* Written by Members 2 and 3; Component 1 only displays them. */}
            <View style={styles.statsRow}>
              <Stat label="Taught" value={user.stats?.sessionsTaught ?? 0} />
              <Stat label="Attended" value={user.stats?.sessionsAttended ?? 0} />
              <Stat label="Lessons" value={user.stats?.lessonsCompleted ?? 0} />
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <SkillPortfolio
            role={user.role}
            skillsOffered={user.skillsOffered}
            skillsWanted={user.skillsWanted}
            careerGoals={user.careerGoals}
            extraSkillsWanted={user.extraSkillsWanted}
          />
        </View>

        {canTeach ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Credentials</Text>
              {canManageCredentials ? (
                <Button
                  label="Manage"
                  variant="ghost"
                  onPress={() => router.push('/profile/credentials')}
                />
              ) : null}
            </View>

            <View style={styles.disclaimer}>
              <Ionicons
                name="information-circle-outline"
                size={sizes.iconSm}
                color={colors.inkMuted}
              />
              <Text style={styles.disclaimerText}>
                Credentials are self-declared. SkillBridge does not verify them — read the evidence
                and judge for yourself.
              </Text>
            </View>

            {credentialsError ? (
              <ErrorState message={credentialsError} onRetry={() => void loadCredentials()} />
            ) : user.skillsOffered.length === 0 && credentials.length === 0 ? (
              <Text style={styles.empty}>
                {isOwnProfile
                  ? 'Add a skill you can teach, then attach a certificate to it.'
                  : 'This member has not listed any skills to back up yet.'}
              </Text>
            ) : (
              <CredentialsBySkill
                skillsOffered={user.skillsOffered}
                credentials={credentials}
                showVisibility={isOwnProfile}
                onOpen={(credential) =>
                  router.push({
                    pathname: '/credential/[id]',
                    params: { id: credential.id, ownerId: user.uid },
                  })
                }
              />
            )}
          </View>
        ) : null}

        {user.badges.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.badges}>
              {user.badges.map((badge) => (
                <Chip key={badge} label={badge} icon="trophy-outline" />
              ))}
            </View>
          </View>
        ) : null}

        {/*
          Three sub-components mount here once their owners build them (§6):
          <UserLessons userId />        — Member 2
          <TeacherSessionsList teacherId /> — Member 3
          <UserReviews userId />        — Member 4
          Component 1 does not query the lessons, sessions or reviews collections.
        */}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  section: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...type.h1,
    color: colors.ink,
  },
  statsRow: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...type.h1,
    color: colors.ink,
  },
  statLabel: {
    ...type.caption,
    color: colors.inkMuted,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  disclaimerText: {
    ...type.caption,
    color: colors.inkMuted,
    flex: 1,
  },
  empty: {
    ...type.body,
    color: colors.inkMuted,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
