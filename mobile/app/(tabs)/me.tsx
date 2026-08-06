import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkillPortfolio } from '@/components/user/SkillPortfolio';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
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

export default function MeScreen() {
  const { profile, firebaseUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (!profile) return <LoadingState fullScreen label="Loading your profile…" />;

  const canTeach = profile.role !== 'learner';

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
        <ScreenHeader
          title="My account"
          action={
            <Pressable
              onPress={() => router.push('/profile/edit')}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              style={styles.headerAction}>
              <Ionicons name="create-outline" size={sizes.iconLg} color={colors.ink} />
            </Pressable>
          }
        />

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

        <View style={styles.section}>
          <MenuRow
            icon="eye-outline"
            label="View my public profile"
            hint="See exactly what a learner sees"
            onPress={() => router.push(`/user/${profile.uid}`)}
          />
          <MenuRow
            icon="person-circle-outline"
            label="Edit profile & skills"
            onPress={() => router.push('/profile/edit')}
          />
          {canTeach ? (
            <MenuRow
              icon="ribbon-outline"
              label="My credentials"
              hint={profile.credentialCount > 0 ? `${profile.credentialCount} attached` : 'None yet'}
              onPress={() => router.push('/profile/credentials')}
            />
          ) : null}
          <MenuRow icon="book-outline" label="My lessons" hint="Arrives with Component 2" />
          <MenuRow icon="calendar-outline" label="My bookings" hint="Arrives with Component 3" />
        </View>

        <View style={styles.section}>
          <SkillPortfolio
            role={profile.role}
            skillsOffered={profile.skillsOffered}
            skillsWanted={profile.skillsWanted}
            onPressOffered={
              canTeach
                ? (skill) => router.push(`/profile/skill-test/${skill.skill}`)
                : undefined
            }
          />
          {canTeach && profile.skillsOffered.length > 0 ? (
            <Text style={styles.muted}>
              Tap a skill you teach to take its verification test. Passing adds a tick that says
              SkillBridge tested you — separate from any certificate you upload.
            </Text>
          ) : null}
        </View>

        <View style={styles.padded}>
          <Button label="Log out" variant="secondary" icon="log-out-outline" onPress={confirmLogout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A row without `onPress` renders disabled — the section keeps its final shape. */
function MenuRow({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress?: () => void;
}) {
  const disabled = !onPress;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.rowDisabled]}>
      <Ionicons name={icon} size={sizes.iconMd} color={colors.inkMuted} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.muted}>{hint}</Text> : null}
      </View>
      {disabled ? null : (
        <Ionicons name="chevron-forward" size={sizes.iconMd} color={colors.inkFaint} />
      )}
    </Pressable>
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
  headerAction: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.control,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowLabel: {
    ...type.bodyStrong,
    color: colors.ink,
  },
});
