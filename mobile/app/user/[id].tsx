import { EnrollmentCount } from '@/components/lesson/EnrollmentCount';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/lesson/ProgressBar';
import { UserReviews } from '@/components/community/UserReviews';
import { Avatar } from '@/components/ui/Avatar';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ErrorState } from '@/components/ui/ErrorState';
import { HeroPill } from '@/components/ui/HeroPill';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatTile } from '@/components/ui/StatTile';
import { profileShareText, shareText } from '@/utils/share';
import { CredentialsBySkill } from '@/components/user/CredentialsBySkill';
import { VerifiedExplainer } from '@/components/user/VerifiedExplainer';
import { SkillPortfolio } from '@/components/user/SkillPortfolio';
import { brand, colors, radius, sizes, spacing, type } from '@/constants/theme';
import { formatRating, plural } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import { ensureDirectChat } from '@/services/chatService';
import { listCredentials, listPublicCredentials } from '@/services/credentialService';
import {
  enrollInLesson,
  listEnrollmentsByUser,
  subscribeToLessonsByTeacher,
  subscribeToEnrollmentsByUser,
} from '@/services/lessonService';
import { subscribeToUser } from '@/services/userService';
import type { Credential, Lesson, LessonEnrollment, User } from '@/types';
import { errorMessage } from '@/utils/authErrors';

type IconName = keyof typeof Ionicons.glyphMap;

const ROLE_LABEL: Record<User['role'], string> = {
  learner: 'Here to learn',
  teacher: 'Here to teach',
  both: 'Teaches and learns',
};

export default function UserProfileScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
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
  const [ownEnrolledCount, setOwnEnrolledCount] = useState(0);

  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const reviewsOffset = useRef(0);
  const credentialsOffset = useRef(0);
  const focusedCredentials = useRef(false);

  const isOwnProfile = !!me && me.uid === id;
  const viewerCanLearn = me?.role === 'learner' || me?.role === 'both';
  useEffect(() => {
    setOwnEnrolledCount(0);
    if (!isOwnProfile || !viewerCanLearn || !id) return;
    return subscribeToEnrollmentsByUser(id,
      rows => setOwnEnrolledCount(new Set(rows.map(row => row.lessonId)).size),
      error => setLessonError(errorMessage(error)));
  }, [id, isOwnProfile, viewerCanLearn]);

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

  useFocusEffect(useCallback(() => {
    void loadViewerEnrollments();
  }, [loadViewerEnrollments]));

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
  // Keep a non-null snapshot for the async button handler. React state can be
  // cleared when a profile listener changes while the transaction is pending.
  const viewedUser = user;

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

  async function openDirectChat() {
    if (!me || isOwnProfile) return;

    setMessageError(null);
    setMessageLoading(true);

    try {
      const chatId = await ensureDirectChat(me, viewedUser);
      router.push({
        // Expo refreshes this generated route type when the dev server starts.
        // A relative path also stays type-safe while that generated file is stale.
        pathname: '../chat/[id]',
        params: { id: chatId, participantName: viewedUser.name },
      });
    } catch (error) {
      setMessageError(errorMessage(error));
    } finally {
      setMessageLoading(false);
    }
  }

  function scrollToReviews() {
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, reviewsOffset.current - spacing.lg),
      animated: true,
    });
  }

  const canBook = !isOwnProfile && canTeach && me?.role !== 'teacher';
  const ctaNote = isOwnProfile
    ? undefined
    : canTeach && me?.role === 'teacher'
      ? 'Switch to Teach & learn to book a session.'
      : canTeach
        ? undefined
        : 'This member is not offering sessions yet. You can still send a message.';
  const ratingCount = user.ratingCount ?? 0;
  const verifiedCount = (user.verifiedSkills ?? []).length;
  const credentialCount = user.credentialCount ?? 0;

  // Same stats as before, now as Me-style tiles.
  const stats: { label: string; value: number; icon: IconName; color: string; surface: string }[] = [
    { label: 'Taught', value: user.stats?.sessionsTaught ?? 0, icon: 'easel-outline', color: brand.blue, surface: brand.blueSurface },
    { label: 'Attended', value: user.stats?.sessionsAttended ?? 0, icon: 'people-outline', color: brand.green, surface: brand.greenSurface },
    ...(isOwnProfile && user.role === 'both'
      ? [
          { label: 'Created Lessons', value: teacherLessons.length, icon: 'create-outline' as IconName, color: colors.accent, surface: colors.accentSurface },
          { label: 'Enrolled Lessons', value: ownEnrolledCount, icon: 'book-outline' as IconName, color: brand.navy, surface: brand.navySurface },
        ]
      : [
          {
            label: canTeach ? 'Created Lessons' : isOwnProfile ? 'Enrolled Lessons' : 'Completed Lessons',
            value: canTeach ? teacherLessons.length : isOwnProfile ? ownEnrolledCount : (user.stats?.lessonsCompleted ?? 0),
            icon: (canTeach ? 'create-outline' : 'book-outline') as IconName,
            color: colors.accent,
            surface: colors.accentSurface,
          },
        ]),
  ];

  return (
    <View style={styles.safe}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <BrandHeader style={styles.hero}>
          <View style={styles.topBar}>
            <HeroButton icon="chevron-back" label="Go back" onPress={() => router.back()} />
            <Text style={styles.topTitle} accessibilityRole="header">
              {isOwnProfile ? 'My profile' : 'Profile'}
            </Text>
            <HeroButton
              icon="share-social-outline"
              label="Share this profile"
              onPress={() => void shareText(profileShareText(user))}
            />
          </View>

          <View style={styles.identity}>
            <View style={styles.avatarRing}>
              <Avatar name={user.name} uri={user.avatarUrl || undefined} size="lg" />
            </View>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.roleText}>{ROLE_LABEL[user.role] ?? ''}</Text>
            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

            <View style={styles.pillRow}>
              {ratingCount > 0 ? (
                <HeroPill
                  icon="star"
                  label={`${formatRating(user.ratingAvg ?? 0, ratingCount)} · ${plural(ratingCount, 'review')}`}
                  onPress={scrollToReviews}
                  accessibilityLabel={`Rated ${formatRating(user.ratingAvg ?? 0, ratingCount)} from ${plural(ratingCount, 'review')}. Show reviews`}
                />
              ) : (
                <HeroPill icon="star-outline" label="No reviews yet" />
              )}
              {user.location ? <HeroPill icon="location-outline" label={user.location} /> : null}
              {verifiedCount > 0 ? (
                <HeroPill icon="checkmark-circle" label={plural(verifiedCount, 'verified skill')} />
              ) : null}
              {credentialCount > 0 ? (
                <HeroPill icon="document-text-outline" label={plural(credentialCount, 'credential')} />
              ) : null}
            </View>
          </View>
        </BrandHeader>

        {/* Pulled up over the header's bottom edge, like Me. */}
        <View style={[styles.padded, styles.statsGrid]}>
          {stats.map((stat) => (
            <StatTile
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              color={stat.color}
              surface={stat.surface}
              half={stats.length > 3}
            />
          ))}
        </View>

        <View style={[styles.padded, styles.actionsBlock]}>
          {isOwnProfile ? (
            <Button
              label="Edit profile"
              variant="secondary"
              icon="create-outline"
              onPress={() => router.push('/profile/edit')}
            />
          ) : (
            <View style={styles.actions}>
              <Button
                label="Book a session"
                icon="calendar-outline"
                onPress={() =>
                  router.push({
                    pathname: '/session/teacher/[id]',
                    params: { id: user.uid, teacherName: user.name },
                  })
                }
                disabled={!canBook}
                style={styles.actionHalf}
              />
              <Button
                label="Message"
                variant="secondary"
                icon="chatbubble-ellipses-outline"
                onPress={() => void openDirectChat()}
                loading={messageLoading}
                disabled={!me}
                style={styles.actionHalf}
              />
            </View>
          )}
          {ctaNote ? <Text style={styles.ctaNote}>{ctaNote}</Text> : null}
          {messageError ? <Notice tone="error" message={messageError} /> : null}
        </View>

        <View
          style={styles.section}
          onLayout={(event) => {
            reviewsOffset.current = event.nativeEvent.layout.y;
          }}>
          <UserReviews userId={user.uid} />
        </View>

        <View style={styles.section}>
          <SkillPortfolio
            role={user.role}
            skillsOffered={user.skillsOffered}
            skillsWanted={user.skillsWanted}
            careerGoals={user.careerGoals}
            extraSkillsWanted={user.extraSkillsWanted}
          />
          {user.skillsOffered.length > 0 ? <VerifiedExplainer /> : null}
        </View>

        {canTeach ? (
          <View
            style={styles.section}
            onLayout={(event) => {
              credentialsOffset.current = event.nativeEvent.layout.y;
              // Opened from "View credentials" on a session: jump here once.
              if (focus === 'credentials' && !focusedCredentials.current) {
                focusedCredentials.current = true;
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({
                    y: Math.max(0, credentialsOffset.current - spacing.lg),
                    animated: true,
                  });
                }, 0);
              }
            }}>
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
                  const canEnroll =
                    !!me && viewerCanLearn && !isOwnLesson && !isEnrolled && !lesson.deleting;
                  const reviewSubmitted =
                    enrollment?.completed === true && enrollment.reviewedByLearner === true;
                  const actionLabel = reviewSubmitted
                    ? 'Review submitted'
                    : enrollment?.completed
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
                        <EnrollmentCount count={lesson.enrollmentCount} />

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
                              icon={
                                reviewSubmitted
                                  ? 'checkmark-circle-outline'
                                  : enrollment?.completed
                                    ? 'star-outline'
                                    : isEnrolled
                                      ? 'play-outline'
                                      : 'add-outline'
                              }
                              variant={canEnroll ? 'primary' : 'secondary'}
                              disabled={reviewSubmitted || (!canEnroll && !isEnrolled)}
                              loading={enrollingId === lesson.id}
                              onPress={() => {
                                if (isEnrolled) {
                                  router.push({
                                    pathname: enrollment?.completed
                                      ? '/review/lesson/[id]'
                                      : '/lesson/[id]',
                                    params: { id: lesson.id },
                                  });
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
    </View>
  );
}

/** Round white-on-navy icon button for the header's top bar. */
function HeroButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.heroButton, pressed && styles.heroButtonPressed]}>
      <Ionicons name={icon} size={sizes.iconMd} color={colors.inkInverse} />
    </Pressable>
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
  notice: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
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
  hero: {
    // Room for the stat tiles to overlap the bottom edge.
    paddingBottom: spacing.xxl + spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: {
    ...type.h2,
    color: colors.inkInverse,
  },
  heroButton: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.onInk,
  },
  heroButtonPressed: {
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
  roleText: {
    ...type.label,
    color: colors.inkInverseMuted,
  },
  bio: {
    ...type.body,
    color: colors.inkInverse,
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: -(spacing.xxl + spacing.lg),
  },
  actionsBlock: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionHalf: {
    flex: 1,
  },
  ctaNote: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: 'center',
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
