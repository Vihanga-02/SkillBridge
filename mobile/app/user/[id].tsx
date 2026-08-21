import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/lesson/ProgressBar';
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
import {
  enrollInLesson,
  listEnrollmentsByUser,
  subscribeToLessonsByTeacher,
} from '@/services/lessonService';
import { subscribeToUser } from '@/services/userService';
import type { Credential, Lesson, LessonEnrollment, User } from '@/types';
import { errorMessage } from '@/utils/authErrors';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [teacherLessons, setTeacherLessons] = useState<Lesson[]>([]);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<LessonEnrollment[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const isOwnProfile = !!me && me.uid === id;
  const viewerCanLearn = me?.role === 'learner' || me?.role === 'both';

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

  const loadTeacherLessons = useCallback(() => {
    if (!id) return () => undefined;
    setLessonError(null);
    return subscribeToLessonsByTeacher(
      id,
      (lessons) => {
        setTeacherLessons(lessons);
        setLessonError(null);
      },
      (error) => setLessonError(errorMessage(error))
    );
  }, [id]);

  useEffect(() => {
    return loadTeacherLessons();
  }, [loadTeacherLessons]);

  const loadViewerEnrollments = useCallback(async () => {
    if (!me || me.role === 'teacher') {
      setEnrollments([]);
      setEnrolledIds(new Set());
      return;
    }

    try {
      const rows = await listEnrollmentsByUser(me.uid);
      setEnrollments(rows);
      setEnrolledIds(new Set(rows.map((enrollment) => enrollment.lessonId)));
    } catch {
      setEnrollments([]);
      setEnrolledIds(new Set());
    }
  }, [me]);

  useEffect(() => {
    void loadViewerEnrollments();
  }, [loadViewerEnrollments]);

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
  const enrollmentByLesson = new Map(
    enrollments.map((enrollment) => [enrollment.lessonId, enrollment])
  );

  async function enroll(lesson: Lesson) {
    if (!me) return;
    setEnrollingId(lesson.id);
    setLessonError(null);
    try {
      await enrollInLesson(me, lesson);
      await loadViewerEnrollments();
    } catch (error) {
      setLessonError(errorMessage(error));
    } finally {
      setEnrollingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={isOwnProfile ? 'My profile' : 'Profile'} showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileHeader
          user={user}
          isOwnProfile={isOwnProfile}
          onEdit={() => router.push('/profile/edit')}
          onBook={
            !isOwnProfile && canTeach && me?.role !== 'teacher'
              ? () =>
                  router.push({
                    pathname: '/session/teacher/[id]',
                    params: { id: user.uid, teacherName: user.name },
                  })
              : undefined
          }
          // Messaging is Component 4; Book a Session is live for teachers.
          ctaDisabledReason={
            isOwnProfile
              ? undefined
              : canTeach && me?.role === 'teacher'
                ? 'Switch to Teach & learn to book. Messaging arrives with Component 4.'
                : canTeach
                  ? 'Messaging arrives with Component 4.'
                : 'This member is not offering sessions yet.'
          }
        />

        <View style={styles.section}>
          <Card>
            {/* Written by Members 2 and 3; Component 1 only displays them. */}
            <View style={styles.statsRow}>
              <Stat label="Taught" value={user.stats?.sessionsTaught ?? 0} />
              <Stat label="Attended" value={user.stats?.sessionsAttended ?? 0} />
              <Stat
                label="Lessons"
                value={canTeach ? teacherLessons.length : (user.stats?.lessonsCompleted ?? 0)}
              />
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

        {canTeach ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lessons by {user.name}</Text>

            {lessonError ? (
              <ErrorState message={lessonError} />
            ) : teacherLessons.length === 0 ? (
              <Text style={styles.empty}>No lessons available yet.</Text>
            ) : (
              <View style={styles.lessonList}>
                {teacherLessons.map((lesson) => {
                  const isOwnLesson = me?.uid === lesson.teacherId;
                  const isEnrolled = enrolledIds.has(lesson.id);
                  const enrollment = enrollmentByLesson.get(lesson.id);
                  const canEnroll = !!me && viewerCanLearn && !isOwnLesson && !isEnrolled;
                  const actionLabel = enrollment?.completed
                    ? 'Review Lesson'
                    : isEnrolled
                      ? 'Continue Learning'
                      : 'Enroll';

                  return (
                    <Card key={lesson.id}>
                      <View style={styles.lessonCard}>
                        <Text style={styles.lessonTitle}>{lesson.lessonName}</Text>
                        <Text style={styles.lessonMeta}>Career Goal: {lesson.careerGoalName}</Text>
                        <Text style={styles.lessonMeta}>
                          {lesson.contents.length} content {lesson.contents.length === 1 ? 'item' : 'items'}
                        </Text>

                        {enrollment ? (
                          <ProgressBar
                            progress={enrollment.progress}
                            completed={enrollment.completed}
                          />
                        ) : null}

                        <View style={styles.lessonActions}>
                          <Button
                            label="Course Details"
                            variant="secondary"
                            icon="information-circle-outline"
                            onPress={() =>
                              router.push({
                                pathname: '/lesson/details/[id]',
                                params: { id: lesson.id },
                              })
                            }
                            style={styles.lessonAction}
                          />
                          {isOwnLesson ? (
                            <Button
                              label="View Lesson"
                              variant="secondary"
                              icon="eye-outline"
                              onPress={() =>
                                router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })
                              }
                              style={styles.lessonAction}
                            />
                          ) : null}
                          {!isOwnLesson ? (
                            <Button
                              label={actionLabel}
                              icon={isEnrolled ? 'play-outline' : 'add-outline'}
                              variant={canEnroll ? 'primary' : 'secondary'}
                              disabled={!canEnroll && !isEnrolled}
                              loading={enrollingId === lesson.id}
                              onPress={() => {
                                if (isEnrolled) {
                                  router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } });
                                } else if (canEnroll) {
                                  void enroll(lesson);
                                }
                              }}
                              style={styles.lessonAction}
                            />
                          ) : null}
                        </View>
                      </View>
                    </Card>
                  );
                })}
              </View>
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
  lessonList: {
    gap: spacing.md,
  },
  lessonCard: {
    gap: spacing.sm,
  },
  lessonTitle: {
    ...type.h2,
    color: colors.ink,
  },
  lessonMeta: {
    ...type.body,
    color: colors.inkMuted,
  },
  lessonActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  lessonAction: {
    flex: 1,
  },
});
