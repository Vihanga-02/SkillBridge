import {
  FieldPath,
  FieldValue,
  Timestamp,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from 'firebase-admin/firestore';

import { adminDb } from './admin.js';
import { authorFromContribution, type ContributionKind } from './leaderboard.js';

const PAGE_SIZE = 400;
const WRITE_BATCH_SIZE = 400;

type Aggregate = {
  userId: string;
  name: string;
  avatarUrl: string;
  postCount: number;
  commentCount: number;
  replyCount: number;
  lastContributionAt: Timestamp | null;
};

function emptyAggregate(userId: string, name: string, avatarUrl: string): Aggregate {
  return {
    userId,
    name,
    avatarUrl,
    postCount: 0,
    commentCount: 0,
    replyCount: 0,
    lastContributionAt: null,
  };
}

function timestamp(value: unknown): Timestamp | null {
  return value instanceof Timestamp ? value : null;
}

function countScore(aggregate: Aggregate): number {
  return aggregate.postCount * 5 + aggregate.commentCount * 2 + aggregate.replyCount;
}

function addDocument(
  aggregates: Map<string, Aggregate>,
  snapshot: QueryDocumentSnapshot<DocumentData>,
  kind: ContributionKind
): void {
  const data = snapshot.data();
  const author = authorFromContribution(data);
  if (!author) return;

  const aggregate = aggregates.get(author.userId) ?? emptyAggregate(author.userId, author.name, author.avatarUrl);
  aggregate.name = author.name || aggregate.name;
  aggregate.avatarUrl = author.avatarUrl || aggregate.avatarUrl;
  if (kind === 'post') aggregate.postCount += 1;
  if (kind === 'comment') aggregate.commentCount += 1;
  if (kind === 'reply') aggregate.replyCount += 1;

  const createdAt = timestamp(data.createdAt);
  if (createdAt && (!aggregate.lastContributionAt || createdAt.toMillis() > aggregate.lastContributionAt.toMillis())) {
    aggregate.lastContributionAt = createdAt;
  }
  aggregates.set(author.userId, aggregate);
}

async function scanContributionQuery(
  source: Query<DocumentData>,
  kind: ContributionKind,
  aggregates: Map<string, Aggregate>
): Promise<void> {
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;

  while (true) {
    let page = source.orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor) page = page.startAfter(cursor);

    const snapshot = await page.get();
    snapshot.docs.forEach((document) => addDocument(aggregates, document, kind));
    if (snapshot.docs.length < PAGE_SIZE) return;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
}

async function commitInBatches(
  aggregates: Map<string, Aggregate>,
  existingIds: Set<string>
): Promise<void> {
  const operations: Array<(batch: WriteBatch) => void> = [];

  for (const aggregate of aggregates.values()) {
    existingIds.delete(aggregate.userId);
    operations.push((batch) => {
      batch.set(
        adminDb.collection('communityStats').doc(aggregate.userId),
        {
          ...aggregate,
          communityScore: countScore(aggregate),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  // A user with no remaining community content should disappear from the
  // leaderboard. `communityStats` is exclusively a server-owned read model.
  for (const userId of existingIds) {
    operations.push((batch) => batch.delete(adminDb.collection('communityStats').doc(userId)));
  }

  for (let start = 0; start < operations.length; start += WRITE_BATCH_SIZE) {
    const batch = adminDb.batch();
    operations.slice(start, start + WRITE_BATCH_SIZE).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

/** Rebuilds every score from source content; use once at launch or to reconcile production data. */
export async function rebuildCommunityLeaderboard(): Promise<{ users: number }> {
  const aggregates = new Map<string, Aggregate>();

  await scanContributionQuery(adminDb.collection('posts'), 'post', aggregates);
  await scanContributionQuery(adminDb.collectionGroup('comments'), 'comment', aggregates);
  await scanContributionQuery(adminDb.collectionGroup('replies'), 'reply', aggregates);

  const existing = await adminDb.collection('communityStats').get();
  await commitInBatches(aggregates, new Set(existing.docs.map((document) => document.id)));
  return { users: aggregates.size };
}

// This script intentionally needs Application Default Credentials or a local,
// uncommitted service-account key. It never accepts credentials in source code.
if (process.argv[1]?.endsWith('rebuildLeaderboard.js')) {
  rebuildCommunityLeaderboard()
    .then(({ users }) => {
      console.log(`Rebuilt leaderboard statistics for ${users} contributors.`);
    })
    .catch((error: unknown) => {
      console.error('Leaderboard backfill failed.', error);
      process.exitCode = 1;
    });
}
