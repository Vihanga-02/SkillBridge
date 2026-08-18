/**
 * Component 4 — session-based reviews.
 *
 * SCRUM-79 only records an eligible learner's review. SCRUM-80 extends this
 * transaction with the teacher's aggregate rating update.
 */

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { TEXT_LIMITS } from '@/constants/config';
import { db } from '@/firebase/config';
import type { Booking, Review, User } from '@/types';

export type LearnerReviewer = Pick<User, 'uid' | 'name' | 'avatarUrl'>;

/** One learner can review a session once, even if they retry the submission. */
export const reviewIdFor = (sessionId: string, reviewerId: string): string =>
  `${sessionId}_${reviewerId}`;

/**
 * Allows the booked learner to review the session's teacher after completion.
 * The review document and booking flag are committed together so the UI never
 * claims a review was submitted when no corresponding document exists.
 */
export async function submitLearnerReview(
  bookingId: string,
  reviewer: LearnerReviewer,
  rating: number,
  rawComment: string
): Promise<string> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Choose a rating from 1 to 5 stars.');
  }

  const comment = rawComment.trim();
  if (comment.length > TEXT_LIMITS.reviewComment) {
    throw new Error(`Your review must be ${TEXT_LIMITS.reviewComment} characters or fewer.`);
  }

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
      tags: [],
      role: 'learner_to_teacher',
      createdAt: serverTimestamp(),
    };

    transaction.set(reviewRef, review);
    transaction.update(bookingRef, {
      reviewedByLearner: true,
      updatedAt: serverTimestamp(),
    });
  });

  return reviewId;
}
