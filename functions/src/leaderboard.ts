import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore';

import { adminDb } from './admin.js';

export type ContributionKind = 'post' | 'comment' | 'reply';

const POINTS: Record<ContributionKind, number> = {
  post: 5,
  comment: 2,
  reply: 1,
};

const COUNTER_FIELD: Record<ContributionKind, 'postCount' | 'commentCount' | 'replyCount'> = {
  post: 'postCount',
  comment: 'commentCount',
  reply: 'replyCount',
};

export type ContributionAuthor = {
  userId: string;
  name: string;
  avatarUrl: string;
};

function positiveInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/** Reads author fields that already exist on posts, comments and replies. */
export function authorFromContribution(data: DocumentData): ContributionAuthor | null {
  const userId = text(data.authorId);
  if (!userId) return null;

  return {
    userId,
    name: text(data.authorName, 'Community member'),
    avatarUrl: text(data.authorAvatarUrl),
  };
}

/**
 * Applies one source-document creation/deletion exactly once.
 *
 * Firestore event delivery is at-least-once, so the event document and ranking
 * update must live in the same transaction. `leaderboardEvents` is server-only
 * data and should receive a Firestore TTL policy during Firebase setup.
 */
export async function applyContributionDelta(
  eventId: string,
  kind: ContributionKind,
  author: ContributionAuthor,
  delta: 1 | -1,
  occurredAt?: Timestamp | null
): Promise<void> {
  const eventRef = adminDb.collection('leaderboardEvents').doc(eventId);
  const statsRef = adminDb.collection('communityStats').doc(author.userId);
  const counterField = COUNTER_FIELD[kind];

  await adminDb.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);
    if (eventSnapshot.exists) return;

    const statsSnapshot = await transaction.get(statsRef);
    const current = statsSnapshot.exists ? statsSnapshot.data() ?? {} : {};
    const nextCounter = Math.max(0, positiveInteger(current[counterField]) + delta);
    const nextScore = Math.max(0, positiveInteger(current.communityScore) + POINTS[kind] * delta);

    const updates: DocumentData = {
      userId: author.userId,
      name: author.name || text(current.name, 'Community member'),
      avatarUrl: author.avatarUrl || text(current.avatarUrl),
      communityScore: nextScore,
      [counterField]: nextCounter,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Deleting old content must never make a member look newly active. The
    // ranking's tie-breaker only moves on genuine contribution creation.
    if (delta > 0) {
      updates.lastContributionAt = occurredAt ?? FieldValue.serverTimestamp();
    }

    transaction.set(statsRef, updates, { merge: true });
    transaction.create(eventRef, {
      kind,
      userId: author.userId,
      delta,
      processedAt: FieldValue.serverTimestamp(),
    });
  });
}

export function contributionTimestamp(data: DocumentData): Timestamp | null {
  return data.createdAt instanceof Timestamp ? data.createdAt : null;
}
