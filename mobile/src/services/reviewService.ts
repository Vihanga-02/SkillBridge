//Component 4 — session-based reviews.

import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { PAGE_SIZE, TEXT_LIMITS } from '@/constants/config';
import { db } from '@/firebase/config';
import { enrollmentIdFor } from '@/services/lessonService';
import type { Booking, Lesson, LessonEnrollment, Review, User } from '@/types';

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
const reviewsCol = collection(db, 'reviews');

export type ReviewCursor = QueryDocumentSnapshot<DocumentData> | null;

export type ListReviewsOptions = {
  pageSize?: number;
  cursor?: ReviewCursor;
};

export type ReviewPage = {
  reviews: Review[];
  cursor: ReviewCursor;
};

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

/** Lesson IDs are prefixed so they can never collide with the legacy session IDs. */
export const lessonReviewIdFor = (lessonId: string, reviewerId: string): string =>
  `lesson_${lessonId}_${reviewerId}`;

const toReview = (snapshot: QueryDocumentSnapshot<DocumentData>): Review => {
  const data = snapshot.data();
  // Reviews written before lesson support did not have a source field. They are
  // session reviews, so normalize them while the existing records are retained.
  return {
    ...data,
    id: snapshot.id,
    source: data.source === 'lesson' ? 'lesson' : 'session',
  } as Review;
};

function validateReviewInput(
  rating: number,
  rawComment: string,
  rawTags: readonly string[]
): { comment: string; tags: ReviewTag[] } {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Choose a rating from 1 to 5 stars.');
  }

  const comment = rawComment.trim();
  if (comment.length > TEXT_LIMITS.reviewComment) {
    throw new Error(`Your review must be ${TEXT_LIMITS.reviewComment} characters or fewer.`);
  }

  return { comment, tags: validateReviewTags(rawTags) };
}

function nextTeacherRating(
  teacher: Pick<User, 'ratingAvg' | 'ratingCount'>,
  rating: number
): { ratingAvg: number; ratingCount: number } {
  const currentCount =
    Number.isSafeInteger(teacher.ratingCount) && teacher.ratingCount > 0
      ? teacher.ratingCount
      : 0;
  const currentAverage =
    currentCount > 0 && Number.isFinite(teacher.ratingAvg) && teacher.ratingAvg >= 0
      ? teacher.ratingAvg
      : 0;
  const ratingCount = currentCount + 1;

  return {
    ratingCount,
    ratingAvg: (currentAverage * currentCount + rating) / ratingCount,
  };
}

/**
 * Gets a user's reviews newest-first. The next cursor is returned only when
 * another page exists, so callers can safely offer a "Load older reviews" action.
 *
 * Requires the `reviews.toUserId ASC + createdAt DESC` composite index.
 */
export async function getReviewsForUser(
  userId: string,
  { pageSize = PAGE_SIZE.reviews, cursor = null }: ListReviewsOptions = {}
): Promise<ReviewPage> {
  if (!userId) return { reviews: [], cursor: null };

  const safePageSize = Math.max(1, Math.min(pageSize, PAGE_SIZE.reviews));
  const constraints: QueryConstraint[] = [
    where('toUserId', '==', userId),
    orderBy('createdAt', 'desc'),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(safePageSize + 1));

  const snapshot = await getDocs(query(reviewsCol, ...constraints));
  const visible = snapshot.docs.slice(0, safePageSize);

  return {
    reviews: visible.map(toReview),
    cursor: snapshot.docs.length > safePageSize ? visible[visible.length - 1] ?? null : null,
  };
}

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
  const { comment, tags } = validateReviewInput(rating, rawComment, rawTags);

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

    const nextRating = nextTeacherRating(
      teacherSnapshot.data() as Pick<User, 'ratingAvg' | 'ratingCount'>,
      rating
    );

    const review: Omit<Review, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
      id: reviewId,
      source: 'session',
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
      ratingAvg: nextRating.ratingAvg,
      ratingCount: nextRating.ratingCount,
      updatedAt: serverTimestamp(),
    });
  });

  return reviewId;
}

/**
 * Allows an enrolled learner to review the lesson's teacher after completing
 * every lesson item. The review, enrollment flag, and teacher aggregate are
 * committed together, matching the completed-session review guarantee.
 */
export async function submitLessonReview(
  lessonId: string,
  reviewer: LearnerReviewer,
  rating: number,
  rawComment: string,
  rawTags: readonly string[] = []
): Promise<string> {
  const { comment, tags } = validateReviewInput(rating, rawComment, rawTags);
  const enrollmentRef = doc(db, 'enrollments', enrollmentIdFor(reviewer.uid, lessonId));
  const lessonRef = doc(db, 'lessons', lessonId);
  let reviewId = '';

  await runTransaction(db, async (transaction) => {
    const [enrollmentSnapshot, lessonSnapshot] = await Promise.all([
      transaction.get(enrollmentRef),
      transaction.get(lessonRef),
    ]);
    if (!enrollmentSnapshot.exists() || !lessonSnapshot.exists()) {
      throw new Error('This completed lesson is no longer available for review.');
    }

    const enrollment = enrollmentSnapshot.data() as LessonEnrollment;
    const lesson = lessonSnapshot.data() as Lesson;
    if (
      enrollment.userId !== reviewer.uid ||
      enrollment.lessonId !== lessonId ||
      enrollment.teacherId === reviewer.uid
    ) {
      throw new Error('Only the learner enrolled in this lesson can leave this review.');
    }
    if (lesson.teacherId !== enrollment.teacherId) {
      throw new Error('This lesson teacher has changed. Please contact support before reviewing.');
    }
    if (!enrollment.completed) {
      throw new Error('You can leave a review after completing every lesson item.');
    }
    if (enrollment.reviewedByLearner) {
      throw new Error('You have already reviewed this lesson.');
    }

    reviewId = lessonReviewIdFor(lessonId, reviewer.uid);
    const reviewRef = doc(db, 'reviews', reviewId);
    const existingReview = await transaction.get(reviewRef);
    if (existingReview.exists()) {
      throw new Error('You have already reviewed this lesson.');
    }

    const teacherRef = doc(db, 'users', enrollment.teacherId);
    const teacherSnapshot = await transaction.get(teacherRef);
    if (!teacherSnapshot.exists()) {
      throw new Error('This teacher profile is no longer available.');
    }
    const nextRating = nextTeacherRating(
      teacherSnapshot.data() as Pick<User, 'ratingAvg' | 'ratingCount'>,
      rating
    );

    const review: Omit<Review, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
      id: reviewId,
      source: 'lesson',
      lessonId,
      skillTag: lesson.skillTag,
      fromUserId: reviewer.uid,
      fromUserName: reviewer.name,
      fromUserAvatarUrl: reviewer.avatarUrl,
      toUserId: enrollment.teacherId,
      rating,
      comment,
      tags,
      role: 'learner_to_teacher',
      createdAt: serverTimestamp(),
    };

    transaction.set(reviewRef, review);
    transaction.update(enrollmentRef, {
      reviewedByLearner: true,
      updatedAt: serverTimestamp(),
    });
    transaction.update(teacherRef, {
      ratingAvg: nextRating.ratingAvg,
      ratingCount: nextRating.ratingCount,
      updatedAt: serverTimestamp(),
    });
  });

  return reviewId;
}
