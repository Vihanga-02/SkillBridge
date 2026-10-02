import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { RatingStars } from '@/components/ui/RatingStars';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TEXT_LIMITS } from '@/constants/config';
import { colors, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { getEnrollment, getLesson } from '@/services/lessonService';
import { REVIEW_TAGS, submitLessonReview, type ReviewTag } from '@/services/reviewService';
import type { Lesson, LessonEnrollment } from '@/types';
import { errorMessage } from '@/utils/authErrors';

/** Learner feedback form shown only after every item in a lesson is completed. */
export default function LeaveLessonReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [enrollment, setEnrollment] = useState<LessonEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<ReviewTag[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    if (!id || !profile) {
      setLoadError('Missing lesson.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [lessonRow, enrollmentRow] = await Promise.all([
        getLesson(id),
        getEnrollment(profile.uid, id),
      ]);
      setLesson(lessonRow);
      setEnrollment(enrollmentRow);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitReview() {
    if (!lesson || !profile || rating === 0) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitLessonReview(lesson.id, profile, rating, comment, selectedTags);
      setSubmitted(true);
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleTag(tag: ReviewTag) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]
    );
    setSubmitError(null);
  }

  if (!profile || loading) {
    return <LoadingState fullScreen label="Loading review..." />;
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Review teacher" showBack />
        <ErrorState message={loadError} onRetry={() => void load()} />
      </SafeAreaView>
    );
  }

  if (!lesson || !enrollment) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Review teacher" showBack />
        <ErrorState message="This lesson enrollment could not be found." onRetry={() => router.back()} />
      </SafeAreaView>
    );
  }

  const isEligible =
    enrollment.completed &&
    enrollment.userId === profile.uid &&
    enrollment.lessonId === lesson.id &&
    enrollment.teacherId === lesson.teacherId &&
    lesson.teacherId !== profile.uid;

  if (!isEligible) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Review teacher" showBack />
        <ErrorState
          message="Only the learner can review a completed lesson."
          onRetry={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (submitted || enrollment.reviewedByLearner) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Review teacher" showBack />
        <View style={styles.success}>
          <EmptyState
            icon="checkmark-circle-outline"
            title="Review submitted"
            message="Thank you for sharing feedback about this lesson."
            actionLabel="Back to lesson"
            onAction={() => router.replace({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Review teacher" showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.teacherRow}>
            <Avatar name={lesson.teacherName} uri={lesson.teacherAvatarUrl || undefined} size="md" />
            <View style={styles.teacherText}>
              <Text style={styles.teacherName}>{lesson.teacherName}</Text>
              <Text style={styles.lessonTitle}>{lesson.lessonName}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <View style={styles.formSection}>
            <Text style={styles.label}>Your rating</Text>
            <RatingStars
              mode="input"
              rating={rating}
              onChange={(nextRating) => {
                setRating(nextRating);
                setSubmitError(null);
              }}
            />
            <Text style={styles.helper}>
              {rating > 0 ? `You selected ${rating} out of 5 stars.` : 'Select a rating from 1 to 5 stars.'}
            </Text>
          </View>
        </Card>

        <Card>
          <View style={styles.formSection}>
            <Text style={styles.label}>What stood out? (optional)</Text>
            <View style={styles.tags}>
              {REVIEW_TAGS.map((tag) => (
                <Chip
                  key={tag.value}
                  label={tag.label}
                  selected={selectedTags.includes(tag.value)}
                  disabled={submitting}
                  onPress={() => toggleTag(tag.value)}
                />
              ))}
            </View>
            <Text style={styles.helper}>Select all feedback tags that apply.</Text>
          </View>
        </Card>

        <Input
          label="Share feedback (optional)"
          value={comment}
          onChangeText={setComment}
          placeholder="What went well? What could be improved?"
          multiline
          maxLength={TEXT_LIMITS.reviewComment}
          helper={`${comment.length}/${TEXT_LIMITS.reviewComment}`}
          editable={!submitting}
        />

        {submitError ? <Notice tone="error" message={submitError} /> : null}

        <Button
          label="Submit review"
          icon="star-outline"
          onPress={() => void submitReview()}
          loading={submitting}
          disabled={rating === 0}
        />
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  teacherText: {
    flex: 1,
    gap: spacing.xs,
  },
  teacherName: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  lessonTitle: {
    ...type.label,
    color: colors.inkMuted,
  },
  formSection: {
    gap: spacing.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  label: {
    ...type.label,
    color: colors.ink,
  },
  helper: {
    ...type.caption,
    color: colors.inkMuted,
  },
  success: {
    flex: 1,
    justifyContent: 'center',
  },
});
