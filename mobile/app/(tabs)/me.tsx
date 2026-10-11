import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { SkillPortfolio } from '@/components/user/SkillPortfolio';
import { brand, colors, radius, shadow, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { logout } from '@/services/authService';
import { subscribeToEnrollmentsByUser, subscribeToLessonsByTeacher } from '@/services/lessonService';
import type { UserRole } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import { formatDate } from '@/utils/date';
import { getProfileCompleteness } from '@/utils/profileCompleteness';
import { nonNegativeCount } from '@/utils/counts';

type IconName = keyof typeof Ionicons.glyphMap;

const ROLE_LABEL: Record<UserRole, string> = {
  learner: 'Learning',
  teacher: 'Teaching',
  both: 'Teaching & learning',
};

/** Icon tints for stat tiles and menu rows — logo colours on their light surfaces. */
const TINT = {
  blue: { color: brand.blue, surface: brand.blueSurface },
  green: { color: brand.green, surface: brand.greenSurface },
  teal: { color: colors.accent, surface: colors.accentSurface },
  navy: { color: brand.navy, surface: brand.navySurface },
} as const;

type Tint = (typeof TINT)[keyof typeof TINT];

export default function MeScreen() {
  const { profile, firebaseUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [createdLessonCount, setCreatedLessonCount] = useState(0);
  const [enrolledLessonCount, setEnrolledLessonCount] = useState(0);

  const canTeach = profile?.role === 'teacher' || profile?.role === 'both';
  const canLearn = profile?.role === 'learner' || profile?.role === 'both';
  const profileUid = profile?.uid;

  useEffect(() => {
    setCreatedLessonCount(0);
    if (!profileUid || !canTeach) {
      return;
    }

    return subscribeToLessonsByTeacher(
      profileUid,
      (lessons) => setCreatedLessonCount(lessons.length),
      (lessonError) => setError(errorMessage(lessonError))
    );
  }, [canTeach, profileUid]);

  useEffect(() => {
    setEnrolledLessonCount(0);
    if (!profileUid || !canLearn) return;
    return subscribeToEnrollmentsByUser(profileUid,
      rows => setEnrolledLessonCount(new Set(rows.map(row => row.lessonId)).size),
      enrollmentError => setError(errorMessage(enrollmentError)));
  }, [canLearn, profileUid]);

  if (!profile) return <LoadingState fullScreen label="Loading your profile…" />;

  const profileCompleteness = getProfileCompleteness(profile);

  function openCompletenessAction() {
    if (profileCompleteness.nextItem?.destination === 'credentials') {
      router.push('/profile/credentials');
      return;
    }

    router.push('/profile/edit');
  }

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

  // Same stats as before: sessions for everyone, then created and/or enrolled lessons by role.
  const stats: { label: string; value: number | undefined; icon: IconName; tint: Tint }[] = [
    { label: 'Taught', value: profile.stats?.sessionsTaught, icon: 'easel-outline', tint: TINT.blue },
    { label: 'Attended', value: profile.stats?.sessionsAttended, icon: 'people-outline', tint: TINT.green },
    ...(canTeach
      ? [{ label: 'Created Lessons', value: createdLessonCount, icon: 'create-outline' as IconName, tint: TINT.teal }]
      : []),
    ...(canLearn
      ? [{ label: 'Enrolled Lessons', value: enrolledLessonCount, icon: 'book-outline' as IconName, tint: TINT.navy }]
      : []),
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandHeader
          title="My account"
          style={styles.header}
          action={
            <Pressable
              onPress={() => router.push('/profile/edit')}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              style={({ pressed }) => [styles.headerAction, pressed && styles.headerActionPressed]}>
              <Ionicons name="create-outline" size={sizes.iconMd} color={colors.inkInverse} />
            </Pressable>
          }>
          <View style={styles.identity}>
            <View style={styles.avatarRing}>
              <Avatar name={profile.name} uri={profile.avatarUrl || undefined} size="lg" />
            </View>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.email}>{profile.email || firebaseUser?.email}</Text>

            <View style={styles.pillRow}>
              <HeaderPill icon="person-outline" label={ROLE_LABEL[profile.role]} />
              <HeaderPill
                icon="sparkles-outline"
                label={`${nonNegativeCount(profile.credits)} credits`}
              />
            </View>

            <View style={styles.headerMeta}>
              {profile.location ? (
                <View style={styles.inline}>
                  <Ionicons name="location-outline" size={sizes.iconSm} color={colors.inkInverseMuted} />
                  <Text style={styles.headerMetaText}>{profile.location}</Text>
                </View>
              ) : null}
              <Text style={styles.headerMetaText}>Member since {formatDate(profile.createdAt)}</Text>
            </View>
          </View>
        </BrandHeader>

        {/* Pulled up over the header's bottom edge. */}
        <View style={[styles.padded, styles.statsGrid]}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={[styles.statTile, stats.length > 3 && styles.statTileHalf]}
              accessibilityLabel={`${stat.label}: ${nonNegativeCount(stat.value)}`}>
              <IconCircle icon={stat.icon} tint={stat.tint} />
              <Text style={styles.statValue}>{nonNegativeCount(stat.value)}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {error ? (
          <View style={styles.padded}>
            <Notice tone="error" message={error} />
          </View>
        ) : null}

        <View style={styles.padded}>
          <Card>
            <View style={styles.completeness}>
              <View style={styles.completenessHeader}>
                <View style={styles.completenessHeading}>
                  <Text style={styles.cardTitle}>Profile completeness</Text>
                  <Text style={styles.muted}>
                    {profileCompleteness.completedCount} of {profileCompleteness.items.length} complete
                  </Text>
                </View>
                <View style={styles.percentBadge}>
                  <Text style={styles.completenessPercent}>{profileCompleteness.percentage}%</Text>
                </View>
              </View>

              <View
                style={styles.completenessTrack}
                accessibilityRole="progressbar"
                accessibilityLabel="Profile completeness"
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: profileCompleteness.percentage,
                }}>
                <View
                  style={[
                    styles.completenessFill,
                    { width: `${profileCompleteness.percentage}%` },
                  ]}
                />
              </View>

              <View style={styles.checklist}>
                {profileCompleteness.items.map((item) => (
                  <View key={item.id} style={styles.checklistRow}>
                    <Ionicons
                      name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                      size={sizes.iconMd}
                      color={item.completed ? colors.success : colors.inkFaint}
                    />
                    <Text style={[styles.checklistLabel, item.completed && styles.checklistDone]}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>

              {profileCompleteness.nextItem ? (
                <Button
                  label={profileCompleteness.nextItem.actionLabel}
                  variant="secondary"
                  icon="arrow-forward-outline"
                  onPress={openCompletenessAction}
                />
              ) : (
                <Notice
                  tone="success"
                  message="Your profile is complete and ready to build trust with other learners."
                />
              )}
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menu}>
            <MenuRow
              icon="eye-outline"
              tint={TINT.blue}
              label="View my public profile"
              hint="See exactly what a learner sees"
              onPress={() => router.push(`/user/${profile.uid}`)}
            />
            <MenuRow
              icon="person-circle-outline"
              tint={TINT.green}
              label="Edit profile & skills"
              onPress={() => router.push('/profile/edit')}
            />
            <MenuRow
              icon="lock-closed-outline"
              tint={TINT.navy}
              label="Change password"
              hint="Update the password you use to sign in"
              onPress={() => router.push('/profile/change-password' as Href)}
            />
            {canTeach ? (
              <MenuRow
                icon="ribbon-outline"
                tint={TINT.teal}
                label="My credentials"
                hint={profile.credentialCount > 0 ? `${profile.credentialCount} attached` : 'None yet'}
                onPress={() => router.push('/profile/credentials')}
              />
            ) : null}
            <MenuRow
              icon="book-outline"
              tint={TINT.blue}
              label="My Lessons"
              hint={profile.role === 'both' ? 'Created and enrolled lessons' : canTeach ? 'Lessons you created' : 'Lessons you enrolled in'}
              onPress={() => router.push('/profile/lessons' as Href)}
            />
            <MenuRow
              icon="calendar-outline"
              tint={TINT.green}
              label="My bookings"
              hint="Track requests and teaching"
              onPress={() => router.push('/(tabs)/sessions')}
              last
            />
          </View>
        </View>

        <View style={styles.section}>
          <SkillPortfolio
            role={profile.role}
            skillsOffered={profile.skillsOffered}
            skillsWanted={profile.skillsWanted}
            careerGoals={profile.careerGoals}
            extraSkillsWanted={profile.extraSkillsWanted}
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
          <Pressable
            onPress={confirmLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            style={({ pressed }) => [styles.logout, pressed && styles.rowPressed]}>
            <Ionicons name="log-out-outline" size={sizes.iconMd} color={colors.danger} />
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function HeaderPill({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={sizes.iconSm} color={brand.yellow} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function IconCircle({ icon, tint }: { icon: IconName; tint: Tint }) {
  return (
    <View style={[styles.iconCircle, { backgroundColor: tint.surface }]}>
      <Ionicons name={icon} size={sizes.iconMd} color={tint.color} />
    </View>
  );
}

/** A row without `onPress` renders disabled — the section keeps its final shape. */
function MenuRow({
  icon,
  tint,
  label,
  hint,
  onPress,
  last = false,
}: {
  icon: IconName;
  tint: Tint;
  label: string;
  hint?: string;
  onPress?: () => void;
  /** Drops the divider under the final row. */
  last?: boolean;
}) {
  const disabled = !onPress;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowDivider,
        pressed && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}>
      <IconCircle icon={icon} tint={tint} />
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    // Room for the stat tiles to overlap the bottom edge.
    paddingBottom: spacing.xxl + spacing.xl,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  headerAction: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.onInk,
  },
  headerActionPressed: {
    backgroundColor: brand.onInkBorder,
  },
  identity: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarRing: {
    padding: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: brand.yellow,
    marginBottom: spacing.xs,
  },
  name: {
    ...type.h1,
    color: colors.inkInverse,
    textAlign: 'center',
  },
  email: {
    ...type.body,
    color: colors.inkInverseMuted,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: brand.onInk,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: brand.onInkBorder,
  },
  pillText: {
    ...type.label,
    color: colors.inkInverse,
  },
  headerMeta: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerMetaText: {
    ...type.caption,
    color: colors.inkInverseMuted,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: -(spacing.xxl + spacing.lg),
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  statTileHalf: {
    flexBasis: '45%',
  },
  statValue: {
    ...type.h1,
    color: colors.ink,
  },
  statLabel: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  iconCircle: {
    width: sizes.touchMin - spacing.xs,
    height: sizes.touchMin - spacing.xs,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    ...type.caption,
    color: colors.inkMuted,
  },
  completeness: {
    gap: spacing.lg,
  },
  completenessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  completenessHeading: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    ...type.h2,
    color: colors.ink,
  },
  percentBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.accentSurface,
  },
  completenessPercent: {
    ...type.h1,
    color: colors.accent,
  },
  completenessTrack: {
    height: spacing.sm + 2,
    overflow: 'hidden',
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  completenessFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  checklist: {
    gap: spacing.sm,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checklistLabel: {
    ...type.body,
    color: colors.ink,
    flex: 1,
  },
  checklistDone: {
    color: colors.inkMuted,
  },
  section: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    ...type.h2,
    color: colors.ink,
  },
  menu: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.control + spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: colors.border,
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
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: sizes.control,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  logoutText: {
    ...type.bodyStrong,
    color: colors.danger,
  },
});
