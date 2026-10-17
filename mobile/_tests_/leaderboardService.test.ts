jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ path: 'communityStats' })),
  doc: jest.fn((_: unknown, id: string) => ({ id })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  increment: jest.fn((amount: number) => ({ increment: amount })),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(() => ({ serverTimestamp: true })),
  updateDoc: jest.fn(),
  where: jest.fn(),
}));

jest.mock('@/firebase/config', () => ({ db: {} }));

import {
  CONTRIBUTION_POINTS,
  contributionCreatedFields,
  contributionRemovedFields,
} from '@/services/leaderboardService';

const author = { uid: 'kasun', name: 'Kasun Perera', avatarUrl: 'https://example.com/kasun.jpg' };

describe('community leaderboard points', () => {
  it('assigns the agreed points to posts, comments, and replies', () => {
    expect(CONTRIBUTION_POINTS).toEqual({ post: 5, comment: 2, reply: 1 });
  });

  it('adds a post contribution to the author score and post count', () => {
    expect(contributionCreatedFields('post', author)).toMatchObject({
      userId: 'kasun',
      name: 'Kasun Perera',
      avatarUrl: 'https://example.com/kasun.jpg',
      communityScore: { increment: 5 },
      postCount: { increment: 1 },
      lastContributionAt: { serverTimestamp: true },
      updatedAt: { serverTimestamp: true },
    });
  });

  it('adds the correct counter for comments and replies only', () => {
    expect(contributionCreatedFields('comment', author)).toMatchObject({
      communityScore: { increment: 2 },
      commentCount: { increment: 1 },
    });
    expect(contributionCreatedFields('reply', author)).toMatchObject({
      communityScore: { increment: 1 },
      replyCount: { increment: 1 },
    });
  });

  it('removes the correct total when community content is deleted', () => {
    expect(contributionRemovedFields('kasun', 'comment', 3)).toMatchObject({
      userId: 'kasun',
      communityScore: { increment: -6 },
      commentCount: { increment: -3 },
    });
  });
});
