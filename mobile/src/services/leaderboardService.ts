import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/firebase/config';
import type { CommunityStats, User } from '@/types';

/** A compact list keeps the leaderboard useful without turning it into a user directory. */
export const LEADERBOARD_LIMIT = 20;

export type ContributionKind = 'post' | 'comment' | 'reply';

/**
 * Points per community action. Likes and reactions are deliberately not
 * counted: they are easy to farm and measure popularity, not contribution.
 * Keep in sync with `scripts/leaderboard/rebuildLeaderboard.mjs`.
 */
export const CONTRIBUTION_POINTS: Record<ContributionKind, number> = {
  post: 5,
  comment: 2,
  reply: 1,
};

const COUNTER_FIELD: Record<ContributionKind, 'postCount' | 'commentCount' | 'replyCount'> = {
  post: 'postCount',
  comment: 'commentCount',
  reply: 'replyCount',
};

const communityStatsCol = collection(db, 'communityStats');

export function communityStatsRef(uid: string) {
  return doc(communityStatsCol, uid);
}

/**
 * Fields to merge into the author's `communityStats` doc in the same
 * transaction that creates their post, comment or reply.
 */
export function contributionCreatedFields(
  kind: ContributionKind,
  author: Pick<User, 'uid' | 'name' | 'avatarUrl'>
): DocumentData {
  return {
    userId: author.uid,
    name: author.name,
    avatarUrl: author.avatarUrl ?? '',
    communityScore: increment(CONTRIBUTION_POINTS[kind]),
    [COUNTER_FIELD[kind]]: increment(1),
    lastContributionAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Fields to merge when `count` items of one kind by the same author are
 * deleted. `lastContributionAt` is left alone so deleting old content never
 * makes a member look newly active.
 */
export function contributionRemovedFields(
  userId: string,
  kind: ContributionKind,
  count = 1
): DocumentData {
  return {
    userId,
    communityScore: increment(-CONTRIBUTION_POINTS[kind] * count),
    [COUNTER_FIELD[kind]]: increment(-count),
    updatedAt: serverTimestamp(),
  };
}

/** Copies a member's new name/avatar onto their leaderboard row, if they have one. */
export async function syncLeaderboardIdentity(
  uid: string,
  identity: Partial<Pick<User, 'name' | 'avatarUrl'>>
): Promise<void> {
  const ref = communityStatsRef(uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;

  await updateDoc(ref, {
    ...(identity.name !== undefined ? { name: identity.name.trim() || 'Community member' } : {}),
    ...(identity.avatarUrl !== undefined ? { avatarUrl: identity.avatarUrl } : {}),
    updatedAt: serverTimestamp(),
  });
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function leaderboardEntry(snapshot: QueryDocumentSnapshot<DocumentData>): CommunityStats {
  const data = snapshot.data();

  return {
    userId: typeof data.userId === 'string' && data.userId ? data.userId : snapshot.id,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Community member',
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
    communityScore: nonNegativeInteger(data.communityScore),
    postCount: nonNegativeInteger(data.postCount),
    commentCount: nonNegativeInteger(data.commentCount),
    replyCount: nonNegativeInteger(data.replyCount),
    lastContributionAt: data.lastContributionAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function leaderboardQuery(maxEntries: number) {
  const safeLimit = Math.max(1, Math.min(maxEntries, LEADERBOARD_LIMIT));

  return query(
    communityStatsCol,
    where('communityScore', '>', 0),
    orderBy('communityScore', 'desc'),
    orderBy('lastContributionAt', 'desc'),
    limit(safeLimit)
  );
}

/** Gets the current all-time top contributors once. */
export async function getLeaderboard(maxEntries = LEADERBOARD_LIMIT): Promise<CommunityStats[]> {
  const snapshot = await getDocs(leaderboardQuery(maxEntries));
  return snapshot.docs.map(leaderboardEntry);
}

/** Keeps the visible leaderboard in sync when community activity changes. */
export function subscribeToLeaderboard(
  callback: (entries: CommunityStats[]) => void,
  onError?: (error: Error) => void,
  maxEntries = LEADERBOARD_LIMIT
): Unsubscribe {
  return onSnapshot(
    leaderboardQuery(maxEntries),
    (snapshot) => callback(snapshot.docs.map(leaderboardEntry)),
    (error) => onError?.(error)
  );
}
