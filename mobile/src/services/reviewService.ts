//Component 4 — session-based reviews.

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { TEXT_LIMITS } from '@/constants/config';
import { db } from '@/firebase/config';
import type { Booking, Review, User } from '@/types';

export type LearnerReviewer = Pick<User, 'uid' | 'name' | 'avatarUrl'>;

/** Stable values stored in Firestore; labels are only for the review form UI. */
export const REVIEW_TAGS = [
  { value: 'punctual', label: 'Punctual' },
  { value: 'explained-clearly', label: 'Explained clearly' },
  { value: 'helpful', label: 'Helpful' },
  { value: 'friendly', label: 'Friendly' },
] as const;

export type ReviewTag = (typeof REVIEW_TAGS)[number]['value'];

const REVIEW_TAG_VALUES = new Set<string>(REVIEW_TAGS.map((tag) => tag.value));

function validateReviewTags(rawTags: readonly string[]): ReviewTag[] {
  const tags = [...new Set(rawTags.map((tag) => tag.trim()).filter(Boolean))];

  if (tags.some((tag) => !REVIEW_TAG_VALUES.has(tag))) {
    throw new Error('Choose feedback tags from the available options.');
  }

  return tags as ReviewTag[];
}

/** One learner can review a session once, even if they retry the submission. */
export const reviewIdFor = (sessionId: string, reviewerId: string): string =>
  `${sessionId}_${reviewerId}`;

/**
 * Allows the booked learner to review the session's teacher after completion.
 * The review document, booking flag, and teacher aggregate rating are committed
 * together so partial writes can never leave the reputation data inconsistent.
 */
export async function submitLearnerReview(
  bookingId: string,
  reviewer: LearnerReviewer,
  rating: number,
  rawComment: string,
  rawTags: readonly string[] = []
): Promise<string> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Choose a rating from 1 to 5 stars.');
  }

  const comment = rawComment.trim();
  if (comment.length > TEXT_LIMITS.reviewComment) {
    throw new Error(`Your review must be ${TEXT_LIMITS.reviewComment} characters or fewer.`);
  }
  const tags = validateReviewTags(rawTags);

  const bookingRef = doc(db, 'bookings', bookingId);
  let reviewId = '';

  await runTransaction(db, async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);
    if (!bookingSnapshot.exists()) {
      throw new Error('This booking is no longer available.');
    }

    const booking = bookingSnapshot.data() as Booking;
    if (booking.learnerId !== reviewer.uid || booking.teacherId === reviewer.uid) {
      throw new Error('Only the learner who attended this session can leave this review.');
    }
    if (booking.status !== 'completed') {
      throw new Error('You can leave a review after the session is marked completed.');
    }
    if (booking.reviewedByLearner) {
      throw new Error('You have already reviewed this session.');
    }

    reviewId = reviewIdFor(booking.sessionId, reviewer.uid);
    const reviewRef = doc(db, 'reviews', reviewId);
    const existingReview = await transaction.get(reviewRef);
    if (existingReview.exists()) {
      throw new Error('You have already reviewed this session.');
    }

    const teacherRef = doc(db, 'users', booking.teacherId);
    const teacherSnapshot = await transaction.get(teacherRef);
    if (!teacherSnapshot.exists()) {
      throw new Error('This teacher profile is no longer available.');
    }

    const teacher = teacherSnapshot.data() as Pick<User, 'ratingAvg' | 'ratingCount'>;
    const currentCount =
      Number.isSafeInteger(teacher.ratingCount) && teacher.ratingCount > 0
        ? teacher.ratingCount
        : 0;
    const currentAverage =
      currentCount > 0 && Number.isFinite(teacher.ratingAvg) && teacher.ratingAvg >= 0
        ? teacher.ratingAvg
        : 0;
    const nextCount = currentCount + 1;
    const nextAverage = (currentAverage * currentCount + rating) / nextCount;

    const review: Omit<Review, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
      id: reviewId,
      bookingId: booking.id,
      sessionId: booking.sessionId,
      skillTag: booking.skillTag,
      fromUserId: reviewer.uid,
      fromUserName: reviewer.name,
      fromUserAvatarUrl: reviewer.avatarUrl,
      toUserId: booking.teacherId,
      rating,
      comment,
      tags,
      role: 'learner_to_teacher',
      createdAt: serverTimestamp(),
    };

    transaction.set(reviewRef, review);
    transaction.update(bookingRef, {
      reviewedByLearner: true,
      updatedAt: serverTimestamp(),
    });
    transaction.update(teacherRef, {
      ratingAvg: nextAverage,
      ratingCount: nextCount,
      updatedAt: serverTimestamp(),
    });
  });

  return reviewId;
}
