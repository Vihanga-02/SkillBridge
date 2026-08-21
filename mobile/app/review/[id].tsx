import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
import { getBooking } from '@/services/bookingService';
import { submitLearnerReview } from '@/services/reviewService';
import type { Booking } from '@/types';
import { errorMessage } from '@/utils/authErrors';

export default function LeaveReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoadError('Missing booking.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      setBooking(await getBooking(id));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitReview() {
    if (!booking || !profile || rating === 0) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitLearnerReview(booking.id, profile, rating, comment);
      setSubmitted(true);
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (!profile || loading) {
    return <LoadingState fullScreen label="Loading review…" />;
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Review teacher" showBack />
        <ErrorState message={loadError} onRetry={() => void load()} />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Review teacher" showBack />
        <ErrorState message="This booking could not be found." onRetry={() => router.back()} />
      </SafeAreaView>
    );
  }

  const isEligible =
    booking.status === 'completed' &&
    booking.learnerId === profile.uid &&
    booking.teacherId !== profile.uid;

  if (!isEligible) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Review teacher" showBack />
        <ErrorState message="Only the learner can review a completed session." onRetry={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (submitted || booking.reviewedByLearner) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Review teacher" showBack />
        <View style={styles.success}>
          <EmptyState
            icon="checkmark-circle-outline"
            title="Review submitted"
            message="Thank you for sharing feedback about this teaching session."
            actionLabel="Back to booking"
            onAction={() => router.replace(`/booking/${booking.id}`)}
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
            <Avatar name={booking.teacherName} uri={booking.teacherAvatarUrl || undefined} size="md" />
            <View style={styles.teacherText}>
              <Text style={styles.teacherName}>{booking.teacherName}</Text>
              <Text style={styles.sessionTitle}>{booking.sessionTitle}</Text>
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
  sessionTitle: {
    ...type.label,
    color: colors.inkMuted,
  },
  formSection: {
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
