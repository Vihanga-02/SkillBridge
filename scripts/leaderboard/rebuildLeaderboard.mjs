/**
 * Rebuilds every `communityStats/{uid}` document from the real posts, comments
 * and replies. The app keeps scores up to date on its own; run this once to
 * count content created before the leaderboard existed, or any time the
 * numbers look wrong.
 *
 *   node rebuildLeaderboard.mjs --dry-run   # print the result, write nothing
 *   node rebuildLeaderboard.mjs             # overwrite communityStats
 *
 * Credentials come from GOOGLE_APPLICATION_CREDENTIALS (a service-account key
 * that must never be committed). Run it while nobody is posting, because
 * contributions made during the run can be overwritten.
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldPath, FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

// Keep in sync with CONTRIBUTION_POINTS in mobile/src/services/leaderboardService.ts.
const POINTS = { post: 5, comment: 2, reply: 1 };
const COUNTER_FIELD = { post: 'postCount', comment: 'commentCount', reply: 'replyCount' };

const PAGE_SIZE = 400;
const WRITE_BATCH_SIZE = 400;
const dryRun = process.argv.includes('--dry-run');

initializeApp();
const db = getFirestore();

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function addContribution(aggregates, data, kind) {
  const userId = text(data.authorId);
  if (!userId) return;

  const aggregate = aggregates.get(userId) ?? {
    userId,
    name: '',
    avatarUrl: '',
    communityScore: 0,
    postCount: 0,
    commentCount: 0,
    replyCount: 0,
    lastContributionAt: null,
  };

  aggregate.name = text(data.authorName) || aggregate.name;
  aggregate.avatarUrl = text(data.authorAvatarUrl) || aggregate.avatarUrl;
  aggregate.communityScore += POINTS[kind];
  aggregate[COUNTER_FIELD[kind]] += 1;

  const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : null;
  if (createdAt && (!aggregate.lastContributionAt || createdAt.toMillis() > aggregate.lastContributionAt.toMillis())) {
    aggregate.lastContributionAt = createdAt;
  }

  aggregates.set(userId, aggregate);
}

/** Pages through a query so large collections never load into memory at once. */
async function scan(source, kind, aggregates) {
  let cursor;
  let total = 0;

  while (true) {
    let page = source.orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor) page = page.startAfter(cursor);

    const snapshot = await page.get();
    for (const document of snapshot.docs) {
      const data = document.data();
      // A post mid-deletion is about to disappear along with its points.
      if (kind === 'post' && data.deleting === true) continue;
      addContribution(aggregates, data, kind);
    }
    total += snapshot.size;
    if (snapshot.size < PAGE_SIZE) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  console.log(`Scanned ${total} ${kind === 'reply' ? 'replies' : `${kind}s`}.`);
}

/** Identity comes from the profile when it exists; content holds only a snapshot from when it was written. */
async function applyProfiles(aggregates) {
  const userIds = [...aggregates.keys()];
  for (let start = 0; start < userIds.length; start += 100) {
    const refs = userIds.slice(start, start + 100).map((id) => db.collection('users').doc(id));
    const profiles = await db.getAll(...refs);
    for (const profile of profiles) {
      if (!profile.exists) continue;
      const aggregate = aggregates.get(profile.id);
      aggregate.name = text(profile.get('name')) || aggregate.name;
      aggregate.avatarUrl = typeof profile.get('avatarUrl') === 'string' ? profile.get('avatarUrl') : aggregate.avatarUrl;
    }
  }
}

async function commit(aggregates, staleIds) {
  const operations = [];

  for (const aggregate of aggregates.values()) {
    // A full overwrite (no merge) also clears any drifted or negative counters.
    operations.push((batch) =>
      batch.set(db.collection('communityStats').doc(aggregate.userId), {
        ...aggregate,
        name: aggregate.name || 'Community member',
        lastContributionAt: aggregate.lastContributionAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    );
  }

  // Members with no remaining content drop off the leaderboard.
  for (const userId of staleIds) {
    operations.push((batch) => batch.delete(db.collection('communityStats').doc(userId)));
  }

  for (let start = 0; start < operations.length; start += WRITE_BATCH_SIZE) {
    const batch = db.batch();
    operations.slice(start, start + WRITE_BATCH_SIZE).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

async function main() {
  const aggregates = new Map();

  await scan(db.collection('posts'), 'post', aggregates);
  await scan(db.collectionGroup('comments'), 'comment', aggregates);
  await scan(db.collectionGroup('replies'), 'reply', aggregates);
  await applyProfiles(aggregates);

  const existing = await db.collection('communityStats').select().get();
  const staleIds = existing.docs.map((document) => document.id).filter((id) => !aggregates.has(id));

  const ranked = [...aggregates.values()].sort((a, b) => b.communityScore - a.communityScore);
  console.log('\nTop 10 after rebuild:');
  console.table(
    ranked.slice(0, 10).map(({ name, communityScore, postCount, commentCount, replyCount }) => ({
      name,
      score: communityScore,
      posts: postCount,
      comments: commentCount,
      replies: replyCount,
    }))
  );
  console.log(`${aggregates.size} contributors to write, ${staleIds.length} stale rows to delete.`);

  if (dryRun) {
    console.log('\nDry run: nothing was written. Re-run without --dry-run to apply.');
    return;
  }

  await commit(aggregates, staleIds);
  console.log('\nLeaderboard rebuilt.');
}

main().catch((error) => {
  console.error('Leaderboard backfill failed.', error);
  process.exitCode = 1;
});
