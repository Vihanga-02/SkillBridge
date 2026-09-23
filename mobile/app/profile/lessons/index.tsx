import { DeleteLessonButton } from '@/components/lesson/DeleteLessonButton';
import { EnrollmentCount } from '@/components/lesson/EnrollmentCount';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/lesson/ProgressBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radius, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { deleteLesson, listEnrollmentsByUser, listLessonsByTeacher } from '@/services/lessonService';
import type { Lesson, LessonEnrollment } from '@/types';
import { errorMessage } from '@/utils/authErrors';

type LessonTab = 'created' | 'enrolled';

export default function MyLessonsScreen() {
  const { profile } = useAuth();
  const [createdLessons, setCreatedLessons] = useState<Lesson[]>([]);
  const [enrollments, setEnrollments] = useState<LessonEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletionInFlight = useRef(false);
  const [failedDeletions, setFailedDeletions] = useState<Set<string>>(() => new Set());
  const [activeTab, setActiveTab] = useState<LessonTab>('created');

  const canTeach = profile?.role === 'teacher' || profile?.role === 'both';
  const canLearn = profile?.role === 'learner' || profile?.role === 'both';
  const dualRole = canTeach && canLearn;
  const showCreated = canTeach && (!dualRole || activeTab === 'created');
  const showEnrolled = canLearn && (!dualRole || activeTab === 'enrolled');

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const [createdRows, enrolledRows] = await Promise.all([
        canTeach ? listLessonsByTeacher(profile.uid) : Promise.resolve([]),
        canLearn ? listEnrollmentsByUser(profile.uid) : Promise.resolve([]),
      ]);
      setCreatedLessons(createdRows);
      setEnrollments(enrolledRows.filter((enrollment) => enrollment.teacherId !== profile.uid));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [canLearn, canTeach, profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!profile) return <LoadingState fullScreen label="Loading..." />;

  function confirmDelete(lesson: Lesson) {
    Alert.alert(
      'Delete Lesson?',
      'Are you sure you want to delete this lesson? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (deletionInFlight.current) return;
            deletionInFlight.current = true;
            setDeletingId(lesson.id);
            setError(null);
            try {
              await deleteLesson(profile!.uid, lesson.id);
              setCreatedLessons((current) => current.filter((item) => item.id !== lesson.id));
            } catch (deleteError) {
              setError(errorMessage(deleteError));
              setFailedDeletions((current) => new Set(current).add(lesson.id));
            } finally {
              deletionInFlight.current = false;
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }

  const showGlobalEmpty =
    !dualRole && !loading && createdLessons.length === 0 && enrollments.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="My lessons"
          subtitle={canTeach ? 'Manage teaching and learning in one place.' : 'Continue lessons you enrolled in.'}
          showBack
          action={
            canTeach ? (
              <Pressable
                onPress={() => router.push('/profile/lessons/form')}
                hitSlop={spacing.sm}
                accessibilityRole="button"
                accessibilityLabel="Create lesson"
                style={styles.headerAction}>
                <Ionicons name="add-circle" size={sizes.iconLg} color={colors.accent} />
              </Pressable>
            ) : undefined
          }
        />

        {dualRole ? (
          <View style={styles.padded}>
            <View style={styles.tabs}>
              <TabButton
                label="Created by Me"
                active={activeTab === 'created'}
                onPress={() => setActiveTab('created')}
              />
              <TabButton
                label="Enrolled Lessons"
                active={activeTab === 'enrolled'}
                onPress={() => setActiveTab('enrolled')}
              />
            </View>
          </View>
        ) : null}

        {showCreated ? (
          <View style={styles.padded}>
            <Button
              label="Create lesson"
              icon="add-outline"
              onPress={() => router.push('/profile/lessons/form')}
            />
          </View>
        ) : null}

        <View style={styles.padded}>
          {error ? <Notice tone="error" message={error} /> : null}
        </View>

        {loading ? (
          <LoadingState label="Loading lessons..." />
        ) : showGlobalEmpty ? (
          <EmptyState
            icon="book-outline"
            title={canTeach ? "You haven't created or enrolled in any lessons yet." : "You haven't enrolled in any lessons yet."}
            message={canTeach ? 'Create your first lesson or enroll from Learn.' : 'Enroll from Learn to start studying.'}
            actionLabel={canTeach ? 'Create lesson' : 'Browse Learn'}
            onAction={() => (canTeach ? router.push('/profile/lessons/form') : router.push('/(tabs)/feed'))}
          />
        ) : (
          <>
            {showCreated ? (
              <View style={styles.section}>
                {!dualRole ? <Text style={styles.sectionTitle}>Created by Me</Text> : null}
                {createdLessons.length === 0 ? (
                  <EmptyState
                    icon="create-outline"
                    title="No lessons created yet"
                    message="Create your first lesson to start teaching."
                    actionLabel="Create lesson"
                    onAction={() => router.push('/profile/lessons/form')}
                  />
                ) : (
                  <View style={styles.list}>
                    {createdLessons.map((lesson) => (
                      <Card key={lesson.id}>
                        <View style={styles.cardBody}>
                          <Text style={styles.title}>{lesson.lessonName}</Text>
                          <Text style={styles.meta}>Career Goal: {lesson.careerGoalName}</Text>
                          <Text style={styles.meta}>
                            {lesson.contents.length} content {lesson.contents.length === 1 ? 'item' : 'items'}
                          </Text>
                          <EnrollmentCount lessonId={lesson.id} />

                          <View style={styles.actions}>
                            <Button
                              label="Edit"
                              variant="secondary"
                              icon="create-outline"
                              onPress={() =>
                                router.push({
                                  pathname: '/profile/lessons/form',
                                  params: { lessonId: lesson.id },
                                })
                              }
                              style={styles.actionButton}
                            />
                            <DeleteLessonButton
                              lessonId={lesson.id}
                              loading={deletingId === lesson.id}
                              retry={lesson.deleting === true || failedDeletions.has(lesson.id)}
                              onPress={() => confirmDelete(lesson)}
                              style={styles.actionButton}
                            />
                          </View>
                        </View>
                      </Card>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            {showEnrolled ? (
              <View style={styles.section}>
                {!dualRole ? <Text style={styles.sectionTitle}>Enrolled Lessons</Text> : null}
                {enrollments.length === 0 ? (
                  <EmptyState
                    icon="school-outline"
                    title="No enrolled lessons yet"
                    message="Lessons you enroll in will appear here."
                  />
                ) : (
                  <View style={styles.list}>
                    {enrollments.map((enrollment) => (
                      <Card key={enrollment.id}>
                        <View style={styles.cardBody}>
                          <Text style={styles.title}>{enrollment.lessonName}</Text>
                          <Text style={styles.meta}>Career Goal: {enrollment.careerGoalName}</Text>
                          <Text style={styles.meta}>By {enrollment.teacherName || 'SkillBridge teacher'}</Text>
                          <Text style={styles.meta}>
                            {enrollment.contentCount} content {enrollment.contentCount === 1 ? 'item' : 'items'}
                          </Text>
                          <EnrollmentCount lessonId={enrollment.lessonId} />
                          <ProgressBar
                            progress={enrollment.progress}
                            completed={enrollment.completed}
                          />
                          <Button
                            label={enrollment.completed ? 'Review Lesson' : 'Continue Learning'}
                            icon="play-outline"
                            onPress={() =>
                              router.push({ pathname: '/lesson/[id]', params: { id: enrollment.lessonId } })
                            }
                          />
                        </View>
                      </Card>
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && !active && styles.tabPressed,
      ]}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
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
  tabs: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabPressed: {
    backgroundColor: colors.surface,
  },
  tabLabel: {
    ...type.label,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.inkInverse,
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
  sectionTitle: {
    ...type.h2,
    color: colors.ink,
  },
  list: {
    gap: spacing.md,
  },
  cardBody: {
    gap: spacing.sm,
  },
  title: {
    ...type.h2,
    color: colors.ink,
  },
  meta: {
    ...type.body,
    color: colors.inkMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
