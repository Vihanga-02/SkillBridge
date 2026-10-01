import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';

import { adminDb } from './admin.js';
import {
  applyContributionDelta,
  authorFromContribution,
  contributionTimestamp,
  type ContributionKind,
} from './leaderboard.js';
import { rebuildCommunityLeaderboard } from './rebuildLeaderboard.js';

async function recordCreatedContribution(
  eventId: string,
  data: DocumentData,
  kind: ContributionKind
): Promise<void> {
  const author = authorFromContribution(data);
  if (!author) return;
  await applyContributionDelta(eventId, kind, author, 1, contributionTimestamp(data));
}

async function recordDeletedContribution(
  eventId: string,
  data: DocumentData,
  kind: ContributionKind
): Promise<void> {
  const author = authorFromContribution(data);
  if (!author) return;
  await applyContributionDelta(eventId, kind, author, -1, contributionTimestamp(data));
}

/** A post is worth five all-time community contribution points. */
export const onCommunityPostCreated = onDocumentCreated('posts/{postId}', async (event) => {
  if (event.data) await recordCreatedContribution(event.id, event.data.data(), 'post');
});

export const onCommunityPostDeleted = onDocumentDeleted('posts/{postId}', async (event) => {
  if (event.data) await recordDeletedContribution(event.id, event.data.data(), 'post');
});

/** A top-level comment is worth two all-time community contribution points. */
export const onCommunityCommentCreated = onDocumentCreated(
  'posts/{postId}/comments/{commentId}',
  async (event) => {
    if (event.data) await recordCreatedContribution(event.id, event.data.data(), 'comment');
  }
);

export const onCommunityCommentDeleted = onDocumentDeleted(
  'posts/{postId}/comments/{commentId}',
  async (event) => {
    if (event.data) await recordDeletedContribution(event.id, event.data.data(), 'comment');
  }
);

/** A direct reply is worth one all-time community contribution point. */
export const onCommunityReplyCreated = onDocumentCreated(
  'posts/{postId}/comments/{commentId}/replies/{replyId}',
  async (event) => {
    if (event.data) await recordCreatedContribution(event.id, event.data.data(), 'reply');
  }
);

export const onCommunityReplyDeleted = onDocumentDeleted(
  'posts/{postId}/comments/{commentId}/replies/{replyId}',
  async (event) => {
    if (event.data) await recordDeletedContribution(event.id, event.data.data(), 'reply');
  }
);

/** Keep denormalized leaderboard identity fresh when a member edits their public profile. */
export const syncLeaderboardProfile = onDocumentUpdated('users/{userId}', async (event) => {
  if (!event.data) return;

  const before = event.data.before.data();
  const after = event.data.after.data();
  const beforeName = typeof before.name === 'string' ? before.name : '';
  const afterName = typeof after.name === 'string' ? after.name : '';
  const beforeAvatar = typeof before.avatarUrl === 'string' ? before.avatarUrl : '';
  const afterAvatar = typeof after.avatarUrl === 'string' ? after.avatarUrl : '';
  if (beforeName === afterName && beforeAvatar === afterAvatar) return;

  const statsRef = adminDb.collection('communityStats').doc(event.params.userId);
  const stats = await statsRef.get();
  if (!stats.exists) return;

  await statsRef.set(
    {
      name: afterName.trim() || 'Community member',
      avatarUrl: afterAvatar,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
});

/**
 * A manual safety-net export for release/backfill. It is not an HTTP endpoint,
 * so mobile clients cannot rewrite ranks. Run `npm run backfill:leaderboard`.
 */
export { rebuildCommunityLeaderboard };
