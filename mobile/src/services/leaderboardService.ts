import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/firebase/config';
import type { CommunityStats } from '@/types';

/** A compact list keeps the leaderboard useful without turning it into a user directory. */
export const LEADERBOARD_LIMIT = 20;

const communityStatsCol = collection(db, 'communityStats');

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
