import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/lesson/ProgressBar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { brand, colors, radius, shadow, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToEnrollmentsByUser } from '@/services/lessonService';
import type { LessonEnrollment } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import { nonNegativeCount } from '@/utils/counts';
import { currentStreak, localDay } from '@/utils/streak';

type IconName = keyof typeof Ionicons.glyphMap;

/** Same estimate the lesson service stores as `minutesSpent`: 5 minutes per finished item. */
const MINUTES_PER_ITEM = 5;

/**
 * Progress dashboard (§5.2): streak, lessons, time learned and goal progress.
 * Read-only — it derives everything from the profile and live enrollments.
 */
export default function ProgressScreen() {
  const { profile } = useAuth();
  const [enrollments, setEnrollments] = useState<LessonEnrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uid = profile?.uid;

  useEffect(() => {
    if (!uid) return;
    return subscribeToEnrollmentsByUser(
      uid,
      (rows) => setEnrollments(rows),
      (loadError) => setError(errorMessage(loadError))
    );
  }, [uid]);

  const summary = useMemo(() => {
    const rows = enrollments ?? [];
    const completed = rows.filter((row) => row.completed);
    const inProgress = rows.filter((row) => !row.completed);
    const minutes = rows.reduce(
      (total, row) => total + (row.completedContentIds?.length ?? 0) * MINUTES_PER_ITEM,
      0
    );

    const goals = new Map<string, { name: string; done: number; total: number }>();
    for (const row of rows) {
      const name = row.careerGoalName || 'Other lessons';
      const goal = goals.get(name) ?? { name, done: 0, total: 0 };
      goal.total += 1;
      if (row.completed) goal.done += 1;
      goals.set(name, goal);
    }

    return {
      completed: completed.length,
      inProgress: inProgress.sort((a, b) => b.progress - a.progress),
      minutes,
      goals: [...goals.values()].sort((a, b) => b.total - a.total),
    };
  }, [enrollments]);

  if (!profile) return <LoadingState fullScreen label="Loading your progress…" />;

  const today = localDay();
  const streak = currentStreak(profile.streak, profile.lastActiveDate, today);
  const learnedToday = profile.lastActiveDate === today;

  const tiles: { label: string; value: string; icon: IconName; color: string; surface: string }[] = [
    { label: 'Lessons completed', value: String(summary.completed), icon: 'checkmark-done', color: brand.green, surface: brand.greenSurface },
    { label: 'Minutes learned', value: String(summary.minutes), icon: 'time-outline', color: brand.blue, surface: brand.blueSurface },
    { label: 'Sessions attended', value: String(nonNegativeCount(profile.stats?.sessionsAttended)), icon: 'people-outline', color: colors.accent, surface: colors.accentSurface },
    { label: 'Sessions taught', value: String(nonNegativeCount(profile.stats?.sessionsTaught)), icon: 'easel-outline', color: brand.navy, surface: brand.navySurface },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="My progress" showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? <Notice tone="error" message={error} /> : null}

        <View
          style={styles.streakCard}
          accessibilityLabel={`Learning streak: ${streak} ${streak === 1 ? 'day' : 'days'}`}>
          <View style={styles.flame}>
            <Ionicons name="flame" size={sizes.iconLg * 1.5} color={brand.yellow} />
          </View>
          <View style={styles.streakText}>
            <Text style={styles.streakNumber}>
              {streak} {streak === 1 ? 'day' : 'days'}
            </Text>
            <Text style={styles.streakLabel}>Learning streak</Text>
            <Text style={styles.streakHint}>
              {learnedToday
                ? 'You learned today — come back tomorrow to keep it going.'
                : streak > 0
                  ? 'Finish a lesson material today to keep your streak alive.'
                  : 'Finish a lesson material to start a new streak.'}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          {tiles.map((tile) => (
            <View key={tile.label} style={styles.tile} accessibilityLabel={`${tile.label}: ${tile.value}`}>
              <View style={[styles.tileIcon, { backgroundColor: tile.surface }]}>
                <Ionicons name={tile.icon} size={sizes.iconMd} color={tile.color} />
              </View>
              <Text style={styles.tileValue}>{tile.value}</Text>
              <Text style={styles.tileLabel}>{tile.label}</Text>
            </View>
          ))}
        </View>

        {enrollments === null && !error ? (
          <LoadingState label="Loading lessons…" />
        ) : enrollments && enrollments.length === 0 ? (
          <EmptyState
            icon="book-outline"
            iconColor={brand.blue}
            title="No lessons yet"
            message="Enroll in a lesson from the Learn tab and your progress will show up here."
            actionLabel="Browse lessons"
            onAction={() => router.push('/(tabs)/feed')}
          />
        ) : (
          <>
            {summary.goals.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>By career goal</Text>
                <Card>
                  <View style={styles.goals}>
                    {summary.goals.map((goal) => (
                      <View key={goal.name} style={styles.goalRow}>
                        <View style={styles.goalHeader}>
                          <Text style={styles.goalName} numberOfLines={1}>
                            {goal.name}
                          </Text>
                          <Text style={styles.goalCount}>
                            {goal.done} / {goal.total} lessons
                          </Text>
                        </View>
                        <View style={styles.track}>
                          <View
                            style={[styles.fill, { width: `${goal.total ? (goal.done / goal.total) * 100 : 0}%` }]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </Card>
              </View>
            ) : null}

            {summary.inProgress.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Keep going</Text>
                {summary.inProgress.map((row) => (
                  <Pressable
                    key={row.id}
                    onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: row.lessonId } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Continue ${row.lessonName}, ${row.progress}% complete`}
                    style={({ pressed }) => [styles.lessonCard, pressed && styles.pressed]}>
                    <View style={styles.lessonHeader}>
                      <Text style={styles.lessonName} numberOfLines={1}>
                        {row.lessonName}
                      </Text>
                      <Ionicons name="play-circle" size={sizes.iconLg} color={colors.accent} />
                    </View>
                    <ProgressBar progress={row.progress} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        )}

        {profile.badges.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <View style={styles.badges}>
              {profile.badges.map((badge) => (
                <View key={badge} style={styles.badge}>
                  <Ionicons name="ribbon" size={sizes.iconSm} color={brand.yellow} />
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.lg, padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
  },
  flame: {
    width: sizes.avatarLg - spacing.lg,
    height: sizes.avatarLg - spacing.lg,
    borderRadius: radius.full,
    backgroundColor: brand.onInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakText: { flex: 1, gap: spacing.xs },
  streakNumber: { ...type.display, color: colors.inkInverse },
  streakLabel: { ...type.label, color: brand.yellow, textTransform: 'uppercase', letterSpacing: 0.5 },
  streakHint: { ...type.caption, color: colors.inkInverseMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    flexBasis: '45%',
    flexGrow: 1,
    gap: spacing.xs,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  tileIcon: {
    width: sizes.touchMin - spacing.sm,
    height: sizes.touchMin - spacing.sm,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  tileValue: { ...type.h1, color: colors.ink },
  tileLabel: { ...type.caption, color: colors.inkMuted },
  section: { gap: spacing.md },
  sectionTitle: { ...type.h2, color: colors.ink },
  goals: { gap: spacing.lg },
  goalRow: { gap: spacing.sm },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalName: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  goalCount: { ...type.caption, color: colors.inkMuted },
  track: { height: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: brand.green },
  lessonCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  lessonHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lessonName: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
  },
  badgeText: { ...type.label, color: colors.inkInverse },
});
