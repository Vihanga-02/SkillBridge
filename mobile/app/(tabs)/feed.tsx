import { EnrollmentCount } from '@/components/lesson/EnrollmentCount';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { CAREER_GOALS, type CareerGoalTag } from '@/constants/careerGoals';
import { CATEGORY_STYLE } from '@/constants/categoryStyle';
import { PAGE_SIZE } from '@/constants/config';
import { LEVEL_LABELS } from '@/constants/skills';
import { brand, colors, radius, shadow, sizes, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { enrollInLesson, getLesson, listEnrollmentIds, listLessons } from '@/services/lessonService';
import type { Lesson } from '@/types';
import { errorMessage } from '@/utils/authErrors';
import { plural } from '@/utils/format';

/** Category icon + tint for a lesson, with a neutral book for older lessons that lack one. */
function lessonStyle(lesson: Lesson) {
  return (
    (lesson.category && CATEGORY_STYLE[lesson.category]) || {
      icon: 'book' as const,
      color: brand.blue,
      surface: brand.blueSurface,
    }
  );
}

/** Lessons shown per page; scrolling or "Show more" reveals the next page. */
const LESSON_PAGE = PAGE_SIZE.lessons;

export default function FeedScreen() {
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [careerGoal, setCareerGoalState] = useState<CareerGoalTag | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(LESSON_PAGE);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** A new goal filter starts again from the first page. */
  function setCareerGoal(next: CareerGoalTag | null) {
    setCareerGoalState(next);
    setVisibleCount(LESSON_PAGE);
  }

  const load = useCallback(async (silent = false) => {
    if (!profile) return;
    // Pull-to-refresh keeps the current list on screen instead of a spinner.
    if (!silent) setLoading(true);
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

  async function refresh() {
    setRefreshing(true);
    await load(true);
    setVisibleCount(LESSON_PAGE);
    setRefreshing(false);
  }

  function showMore() {
    setVisibleCount((count) => count + LESSON_PAGE);
  }

  const learnerGoals = useMemo(
    () => new Set<string>((profile?.careerGoals ?? []).map((goal) => goal.goal)),
    [profile?.careerGoals]
  );

  /** Lessons for the learner's own career goals come first; order is otherwise unchanged. */
  const filtered = useMemo(() => {
    const rows = lessons.filter((lesson) => !careerGoal || lesson.careerGoalId === careerGoal);
    const mine = rows.filter((lesson) => learnerGoals.has(lesson.careerGoalId));
    const rest = rows.filter((lesson) => !learnerGoals.has(lesson.careerGoalId));
    return [...mine, ...rest];
  }, [lessons, careerGoal, learnerGoals]);

  const continueLessons = useMemo(
    () => lessons.filter((lesson) => enrolledIds.has(lesson.id) && !lesson.deleting),
    [lessons, enrolledIds]
  );

  /** The learner's goals lead the chip row too. */
  const goalChips = useMemo(
    () => [
      ...CAREER_GOALS.filter((goal) => learnerGoals.has(goal.tag)),
      ...CAREER_GOALS.filter((goal) => !learnerGoals.has(goal.tag)),
    ],
    [learnerGoals]
  );

  async function enroll(lesson: Lesson) {
    if (!profile) return;
    setEnrollingId(lesson.id);
    setError(null);
    try {
      await enrollInLesson(profile, lesson);
      const refreshed = await getLesson(lesson.id);
      if (refreshed) setLessons((rows) => rows.map((row) => row.id === lesson.id ? refreshed : row));
      setEnrolledIds((current) => new Set(current).add(lesson.id));
    } catch (enrollError) {
      setError(errorMessage(enrollError));
    } finally {
      setEnrollingId(null);
    }
  }

  const isLearner = !!profile && profile.role !== 'teacher';
  const subtitle = isLearner
    ? `${plural(lessons.length, 'lesson')} · ${enrolledIds.size} enrolled`
    : 'Lessons created by SkillBridge teachers.';

  function renderLesson(lesson: Lesson) {
    const isOwnLesson = lesson.teacherId === profile?.uid;
    const isEnrolled = enrolledIds.has(lesson.id);
    const canOpen = isEnrolled || (isOwnLesson && profile?.role === 'teacher');
    const canEnroll = !!profile && profile.role !== 'teacher' && !isEnrolled && !lesson.deleting;
    const style = lessonStyle(lesson);
    const isGoal = learnerGoals.has(lesson.careerGoalId);

    return (
      <Card style={isGoal ? styles.goalCard : undefined}>
        <View style={styles.cardBody}>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/lesson/details/[id]', params: { id: lesson.id } })
            }
            accessibilityRole="button"
            accessibilityLabel={`View details for ${lesson.lessonName}`}
            style={({ pressed }) => [styles.lessonTop, pressed && styles.pressed]}>
            <View style={[styles.tile, { backgroundColor: style.surface }]}>
              <Ionicons name={style.icon} size={sizes.iconLg} color={style.color} />
            </View>
            <View style={styles.lessonText}>
              {isGoal ? (
                <View style={styles.goalBadge}>
                  <Ionicons name="star" size={sizes.iconSm} color={colors.accent} />
                  <Text style={styles.goalBadgeText}>Your goal</Text>
                </View>
              ) : null}
              <Text style={styles.title} numberOfLines={2}>
                {lesson.lessonName}
              </Text>
              <Text style={styles.teacher}>By {lesson.teacherName || 'SkillBridge teacher'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={sizes.iconMd} color={colors.inkFaint} />
          </Pressable>

          <View style={styles.pillRow}>
            {lesson.careerGoalName ? (
              <InfoPill icon="flag-outline" label={lesson.careerGoalName} />
            ) : null}
            {lesson.level && LEVEL_LABELS[lesson.level] ? (
              <InfoPill icon="stats-chart-outline" label={LEVEL_LABELS[lesson.level]} />
            ) : null}
            <InfoPill
              icon="albums-outline"
              label={`${lesson.contents.length} content ${lesson.contents.length === 1 ? 'item' : 'items'}`}
            />
          </View>

          <View style={styles.enrolledRow}>
            <EnrollmentCount count={lesson.enrollmentCount} />
          </View>

          <Button
            label={isEnrolled ? 'Continue Learning' : canOpen ? 'Open lesson' : 'Enroll'}
            variant={canEnroll ? 'primary' : 'secondary'}
            icon={canOpen ? 'play-outline' : 'add-outline'}
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
    );
  }

  const visibleLessons = filtered.slice(0, visibleCount);
  const hasMore = visibleLessons.length < filtered.length;

  return (
    <View style={styles.screen}>
      <FlatList
        data={loading ? [] : visibleLessons}
        keyExtractor={(lesson) => lesson.id}
        renderItem={({ item }) => <View style={styles.padded}>{renderLesson(item)}</View>}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onEndReached={showMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <BrandHeader title="Learn" subtitle={loading ? 'Lessons created by SkillBridge teachers.' : subtitle} />

            {error ? (
              <View style={styles.padded}>
                <Notice tone="error" message={error} />
              </View>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}>
              <Chip label="All" icon="apps" selected={!careerGoal} onPress={() => setCareerGoal(null)} />
              {goalChips.map((goal) => (
                <Chip
                  key={goal.tag}
                  label={goal.label}
                  icon={learnerGoals.has(goal.tag) ? 'star' : undefined}
                  iconColor={colors.accent}
                  selected={careerGoal === goal.tag}
                  onPress={() => setCareerGoal(careerGoal === goal.tag ? null : goal.tag)}
                  showCheck={false}
                />
              ))}
            </ScrollView>

            {!loading && !careerGoal && continueLessons.length > 0 ? (
              <View style={styles.section}>
                <View style={[styles.sectionHeader, styles.padded]}>
                  <Ionicons name="play-circle" size={sizes.iconMd} color={brand.green} />
                  <Text style={styles.sectionTitle}>Continue learning</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carousel}>
                  {continueLessons.map((lesson) => {
                    const style = lessonStyle(lesson);
                    return (
                      <Pressable
                        key={lesson.id}
                        onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
                        accessibilityRole="button"
                        accessibilityLabel={`Continue ${lesson.lessonName}`}
                        style={({ pressed }) => [styles.continueCard, pressed && styles.pressedScale]}>
                        <View style={[styles.tile, { backgroundColor: style.surface }]}>
                          <Ionicons name={style.icon} size={sizes.iconLg} color={style.color} />
                        </View>
                        <Text style={styles.continueTitle} numberOfLines={2}>
                          {lesson.lessonName}
                        </Text>
                        <View style={styles.continueFooter}>
                          <Text style={styles.caption} numberOfLines={1}>
                            By {lesson.teacherName || 'SkillBridge teacher'}
                          </Text>
                          <View style={styles.playButton}>
                            <Ionicons name="play" size={sizes.iconSm} color={colors.inkInverse} />
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {!loading && filtered.length > 0 ? (
              <Text style={[styles.sectionTitle, styles.padded]}>
                {careerGoal ? 'Lessons for this goal' : learnerGoals.size > 0 ? 'Picked for your goals first' : 'All lessons'}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState label="Loading lessons..." />
          ) : (
            <EmptyState
              icon="book-outline"
              iconColor={brand.blue}
              title="No lessons here yet"
              message="Teacher-created lessons for this career goal will show up here as soon as they are published."
            />
          )
        }
        ListFooterComponent={
          !loading && filtered.length > 0 ? (
            hasMore ? (
              <Pressable
                onPress={showMore}
                accessibilityRole="button"
                style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
                <Text style={styles.moreText}>
                  Show more ({filtered.length - visibleLessons.length} left)
                </Text>
              </Pressable>
            ) : filtered.length > LESSON_PAGE ? (
              <Text style={styles.endText}>That’s every lesson for now.</Text>
            ) : null
          ) : null
        }
      />
    </View>
  );
}

function InfoPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.infoPill}>
      <Ionicons name={icon} size={sizes.iconSm} color={colors.inkMuted} />
      <Text style={styles.infoPillText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const TILE = sizes.control + spacing.xs;
const CONTINUE_WIDTH = sizes.avatarLg * 2 + spacing.lg;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: spacing.lg,
    paddingBottom: spacing.xs,
  },
  moreButton: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.accentSurface,
  },
  moreText: {
    ...type.label,
    color: colors.accent,
  },
  endText: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  filters: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.h2,
    color: colors.ink,
  },
  carousel: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  continueCard: {
    width: CONTINUE_WIDTH,
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  continueTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    minHeight: type.bodyStrong.lineHeight * 2,
  },
  continueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playButton: {
    width: sizes.avatarSm,
    height: sizes.avatarSm,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedScale: {
    transform: [{ scale: 0.97 }],
  },
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.8,
  },
  goalCard: {
    borderColor: colors.accent,
  },
  cardBody: {
    gap: spacing.md,
  },
  lessonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonText: {
    flex: 1,
    gap: spacing.xs,
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.accentSurface,
  },
  goalBadgeText: {
    ...type.caption,
    fontWeight: '600',
    color: colors.accent,
  },
  title: {
    ...type.h2,
    color: colors.ink,
  },
  teacher: {
    ...type.caption,
    color: colors.inkMuted,
  },
  caption: {
    ...type.caption,
    color: colors.inkMuted,
    flex: 1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  infoPillText: {
    ...type.caption,
    color: colors.inkMuted,
  },
  enrolledRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
