import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { CAREER_GOALS, type CareerGoalTag } from '@/constants/careerGoals';
import { colors, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { enrollInLesson, listEnrollmentIds, listLessons } from '@/services/lessonService';
import type { Lesson } from '@/types';
import { errorMessage } from '@/utils/authErrors';

export default function FeedScreen() {
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [careerGoal, setCareerGoal] = useState<CareerGoalTag | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const [lessonRows, enrollmentRows] = await Promise.all([
        listLessons(),
        profile.role !== 'teacher' ? listEnrollmentIds(profile.uid) : Promise.resolve(new Set<string>()),
      ]);
      setLessons(lessonRows);
      setEnrolledIds(enrollmentRows);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(
    () => lessons.filter((lesson) => !careerGoal || lesson.careerGoalId === careerGoal),
    [lessons, careerGoal]
  );

  const learnerGoals = new Set((profile?.careerGoals ?? []).map((goal) => goal.goal));

  async function enroll(lesson: Lesson) {
    if (!profile) return;
    setEnrollingId(lesson.id);
    setError(null);
    try {
      await enrollInLesson(profile, lesson);
      setEnrolledIds((current) => new Set(current).add(lesson.id));
    } catch (enrollError) {
      setError(errorMessage(enrollError));
    } finally {
      setEnrollingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Learn" subtitle="Lessons created by SkillBridge teachers." />

        {error ? (
          <View style={styles.padded}>
            <Notice tone="error" message={error} />
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}>
          <Chip size="sm" label="All" selected={!careerGoal} onPress={() => setCareerGoal(null)} />
          {CAREER_GOALS.map((goal) => (
            <Chip
              key={goal.tag}
              size="sm"
              label={goal.label}
              selected={careerGoal === goal.tag}
              onPress={() => setCareerGoal(careerGoal === goal.tag ? null : goal.tag)}
            />
          ))}
        </ScrollView>

        {loading ? (
          <LoadingState label="Loading lessons..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title="No lessons yet"
            message="Teacher-created lessons for this career goal will appear here."
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((lesson) => {
              const isOwnLesson = lesson.teacherId === profile?.uid;
              const isEnrolled = enrolledIds.has(lesson.id);
              const canOpen = isOwnLesson || isEnrolled;
              const canEnroll = !!profile && profile.role !== 'teacher' && !isOwnLesson && !isEnrolled;

              return (
                <Pressable
                  key={lesson.id}
                  onPress={
                    canOpen
                      ? () => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })
                      : undefined
                  }
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canOpen }}
                  accessibilityLabel={`Open ${lesson.lessonName}`}
                  style={({ pressed }) => pressed && canOpen && styles.pressed}>
                <Card>
                  <View style={styles.cardBody}>
                    <View style={styles.lessonTop}>
                      <View style={styles.lessonText}>
                        <Text style={styles.title}>{lesson.lessonName}</Text>
                        <Text style={styles.meta}>Career Goal: {lesson.careerGoalName}</Text>
                        <Text style={styles.teacher}>By {lesson.teacherName || 'SkillBridge teacher'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={sizes.iconMd} color={colors.inkFaint} />
                    </View>

                    <View style={styles.metaRow}>
                      <Ionicons name="albums-outline" size={sizes.iconSm} color={colors.inkMuted} />
                      <Text style={styles.caption}>
                        {lesson.contents.length} content {lesson.contents.length === 1 ? 'item' : 'items'}
                      </Text>
                      {learnerGoals.has(lesson.careerGoalId) ? (
                        <Text style={styles.match}>Your goal</Text>
                      ) : null}
                    </View>

                    <Button
                      label={isOwnLesson ? 'Open lesson' : isEnrolled ? 'Continue Learning' : 'Enroll'}
                      variant={canEnroll ? 'primary' : 'secondary'}
                      icon={isEnrolled || isOwnLesson ? 'play-outline' : 'add-outline'}
                      loading={enrollingId === lesson.id}
                      disabled={!canOpen && !canEnroll}
                      onPress={() => {
                        if (canEnroll) void enroll(lesson);
                        else if (canOpen) {
                          router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } });
                        }
                      }}
                    />
                  </View>
                </Card>
              </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  filters: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.8,
  },
  cardBody: {
    gap: spacing.md,
  },
  lessonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  lessonText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...type.h2,
    color: colors.ink,
  },
  meta: {
    ...type.body,
    color: colors.inkMuted,
  },
  teacher: {
    ...type.caption,
    color: colors.inkMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  caption: {
    ...type.caption,
    color: colors.inkMuted,
    flex: 1,
  },
  match: {
    ...type.caption,
    color: colors.accent,
  },
});
