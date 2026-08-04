import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { LEVEL_LABELS } from '@/constants/skills';
import { colors, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { logout } from '@/services/authService';
import type { UserRole } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import { formatDate } from '@/utils/date';

const ROLE_LABEL: Record<UserRole, string> = {
  learner: 'Learning',
  teacher: 'Teaching',
  both: 'Teaching & learning',
};

/**
 * [Shared shell] The account screen Component 0 needs so logout is reachable.
 * Member 1 extends this with the avatar upload, profile editor and the links to
 * My Credentials / My Lessons / My Bookings.
 */
export default function MeScreen() {
  const { profile, firebaseUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (!profile) return <LoadingState fullScreen label="Loading your profile…" />;

  function confirmLogout() {
    Alert.alert('Log out?', 'You can log back in with the same email and password.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (logoutError) {
            setError(errorMessage(logoutError));
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="My account" />

        {error ? (
          <View style={styles.padded}>
            <Notice tone="error" message={error} />
          </View>
        ) : null}

        <View style={styles.padded}>
          <Card>
            <View style={styles.identity}>
              <Avatar name={profile.name} uri={profile.avatarUrl || undefined} size="lg" />
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.email}>{profile.email || firebaseUser?.email}</Text>

              <View style={styles.metaRow}>
                <Chip label={ROLE_LABEL[profile.role]} icon="person-outline" />
                <Chip label={`${profile.credits} credits`} icon="sparkles-outline" />
              </View>

              {profile.location ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={sizes.iconSm} color={colors.inkMuted} />
                  <Text style={styles.muted}>{profile.location}</Text>
                </View>
              ) : null}

              <Text style={styles.muted}>Member since {formatDate(profile.createdAt)}</Text>
            </View>
          </Card>
        </View>

        <View style={styles.padded}>
          <Card>
            <View style={styles.statsRow}>
              <Stat label="Taught" value={profile.stats.sessionsTaught} />
              <Stat label="Attended" value={profile.stats.sessionsAttended} />
              <Stat label="Lessons" value={profile.stats.lessonsCompleted} />
            </View>
          </Card>
        </View>

        {profile.skillsOffered.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>I can teach</Text>
            <View style={styles.chipWrap}>
              {profile.skillsOffered.map((skill) => (
                <Chip
                  key={skill.skill}
                  label={`${skill.label} · ${LEVEL_LABELS[skill.level]}`}
                  icon={skill.verified ? 'checkmark-circle' : undefined}
                />
              ))}
            </View>
          </View>
        ) : null}

        {profile.skillsWanted.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>I want to learn</Text>
            <View style={styles.chipWrap}>
              {profile.skillsWanted.map((skill) => (
                <Chip key={skill.skill} label={skill.label} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.padded}>
          <Button label="Log out" variant="secondary" icon="log-out-outline" onPress={confirmLogout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  section: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    ...type.h1,
    color: colors.ink,
  },
  identity: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...type.h1,
    color: colors.ink,
  },
  email: {
    ...type.body,
    color: colors.inkMuted,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  muted: {
    ...type.caption,
    color: colors.inkMuted,
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
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
