import { EnrollmentCount } from '@/components/lesson/EnrollmentCount';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { enrollInLesson, getEnrollment, getLesson } from '@/services/lessonService';
import type { Lesson, LessonEnrollment } from '@/types';
import { errorMessage } from '@/utils/authErrors';

export default function LessonDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [enrollment, setEnrollment] = useState<LessonEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !profile) return;
    setLoading(true);
    setError(null);
    try {
      const row = await getLesson(id);
      if (!row || (row.published === false && row.teacherId !== profile.uid)) {
        setLesson(null);
        setEnrollment(null);
        setError('That lesson is not available.');
        return;
      }

      setLesson(row);
      setEnrollment(
        profile.role === 'teacher'
          ? null
          : await getEnrollment(profile.uid, row.id)
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function enroll() {
    if (!profile || !lesson) return;
    setEnrolling(true);
    setError(null);
    try {
      await enrollInLesson(profile, lesson);
      setEnrollment(await getEnrollment(profile.uid, lesson.id));
      setLesson(await getLesson(lesson.id));
    } catch (enrollError) {
      setError(errorMessage(enrollError));
    } finally {
      setEnrolling(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Course Details" showBack />
        <LoadingState label="Loading course details..." />
      </SafeAreaView>
    );
  }

  const isOwnLesson = !!profile && lesson?.teacherId === profile.uid;
  const canLearn = profile?.role === 'learner' || profile?.role === 'both';
  const videoCount = lesson?.contents.filter((item) => item.type === 'youtube').length ?? 0;
  const pdfCount = lesson?.contents.filter((item) => item.type === 'pdf').length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Course Details" showBack />
        {error ? <Notice tone="error" message={error} /> : null}

        {lesson ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.title}>{lesson.lessonName}</Text>
              <Text style={styles.goal}>{lesson.careerGoalName || 'Career goal not specified'}</Text>
            </View>

            <Card>
              <View style={styles.infoCard}>
                <EnrollmentCount count={lesson.enrollmentCount} />
                <InfoRow icon="flag-outline" label="Career Goal" value={lesson.careerGoalName || 'Not specified'} />
                <Pressable
                  onPress={() => router.push({ pathname: '/user/[id]', params: { id: lesson.teacherId } })}
                  accessibilityRole="link"
                  accessibilityLabel={`View ${lesson.teacherName || 'teacher'} profile`}
                  style={styles.teacherLink}>
                  <InfoRow
                    icon="person-outline"
                    label="Created by"
                    value={lesson.teacherName || 'SkillBridge teacher'}
                  />
                  <Ionicons name="chevron-forward" size={sizes.iconMd} color={colors.inkFaint} />
                </Pressable>
                {lesson.level ? (
                  <InfoRow icon="stats-chart-outline" label="Level" value={capitalize(lesson.level)} />
                ) : null}
              </View>
            </Card>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this lesson</Text>
              <Text style={styles.description}>
                {lesson.description?.trim() || 'No description provided.'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Learning materials</Text>
              <Card>
                <View style={styles.materials}>
                  <Text style={styles.materialTotal}>
                    {lesson.contents.length} learning {lesson.contents.length === 1 ? 'material' : 'materials'}
                  </Text>
                  {videoCount > 0 ? (
                    <MaterialRow icon="play-circle-outline" count={videoCount} label="YouTube video" />
                  ) : null}
                  {pdfCount > 0 ? (
                    <MaterialRow icon="document-text-outline" count={pdfCount} label="PDF document" />
                  ) : null}
                  <Text style={styles.protectedHint}>
                    Enroll to open videos, PDFs, quizzes, flashcards, and progress tracking.
                  </Text>
                </View>
              </Card>
            </View>

            {isOwnLesson ? (
              <View style={styles.actions}>
                <Notice tone="info" message={enrollment ? 'Your lesson ? Enrolled as a learner' : 'Your lesson'} />
                {canLearn && !enrollment ? (
                  <Button label="Enroll as learner" icon="add-outline" loading={enrolling}
                    disabled={lesson.deleting} onPress={() => void enroll()} />
                ) : null}
                <Button
                  label="View Lesson"
                  icon="eye-outline"
                  onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
                />
                <Button
                  label="Edit Lesson"
                  variant="secondary"
                  icon="create-outline"
                  onPress={() =>
                    router.push({
                      pathname: '/profile/lessons/form',
                      params: { lessonId: lesson.id },
                    })
                  }
                />
              </View>
            ) : enrollment ? (
              <View style={styles.actions}>
                <Notice
                  tone="success"
                  message={enrollment.completed ? '✓ Completed' : '✓ Enrolled'}
                />
                <Button
                  label={enrollment.completed ? 'Review Lesson' : 'Continue Learning'}
                  icon="play-outline"
                  onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
                />
              </View>
            ) : canLearn ? (
              <Button
                label="Enroll"
                icon="add-outline"
                loading={enrolling}
                disabled={lesson.deleting}
                onPress={() => void enroll()}
              />
            ) : (
              <Notice
                tone="info"
                message="Teacher-only accounts can view course details but cannot enroll."
              />
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={sizes.iconMd} color={colors.accent} />
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function MaterialRow({ icon, count, label }: { icon: keyof typeof Ionicons.glyphMap; count: number; label: string }) {
  return (
    <View style={styles.materialRow}>
      <Ionicons name={icon} size={sizes.iconMd} color={colors.accent} />
      <Text style={styles.materialText}>{count} {label}{count === 1 ? '' : 's'}</Text>
    </View>
  );
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.lg, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg },
  hero: { gap: spacing.xs },
  title: { ...type.display, color: colors.ink },
  goal: { ...type.bodyStrong, color: colors.accent },
  infoCard: { gap: spacing.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  infoText: { gap: spacing.xs, flex: 1 },
  infoLabel: { ...type.caption, color: colors.inkMuted },
  infoValue: { ...type.bodyStrong, color: colors.ink },
  teacherLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    margin: -spacing.sm,
    borderRadius: radius.sm,
  },
  section: { gap: spacing.sm },
  sectionTitle: { ...type.h2, color: colors.ink },
  description: { ...type.body, color: colors.inkMuted },
  materials: { gap: spacing.md },
  materialTotal: { ...type.bodyStrong, color: colors.ink },
  materialRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  materialText: { ...type.body, color: colors.ink },
  protectedHint: { ...type.caption, color: colors.inkMuted },
  actions: { gap: spacing.md },
});
