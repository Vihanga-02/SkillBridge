import type { SkillTag } from '@/constants/skills';
import type { User } from '@/types';

/** Why a peer suits the viewer: the skills they teach that the viewer wants. */
export type PeerMatch = {
  score: number;
  matchedTags: SkillTag[];
  matchedLabels: string[];
};

type Viewer = Pick<User, 'skillTagsWanted' | 'careerGoals'>;
type Peer = Pick<User, 'skillsOffered' | 'ratingAvg' | 'ratingCount'>;

/**
 * One wanted skill outweighs any bonus, so a peer teaching two wanted skills
 * always ranks above one teaching a single wanted skill.
 */
const WEIGHT = { match: 10, goal: 2, verified: 1 } as const;

const NO_MATCH: PeerMatch = { score: 0, matchedTags: [], matchedLabels: [] };

/**
 * `skillTagsWanted` is already the union of the viewer's career-goal skills and
 * their extra picks; a match that serves one of their goals scores a little more.
 */
export function scorePeer(viewer: Viewer, peer: Peer): PeerMatch {
  const wanted = new Set<string>(viewer.skillTagsWanted);
  if (wanted.size === 0) return NO_MATCH;

  const goalTags = new Set<string>(viewer.careerGoals.flatMap((goal) => goal.skillTags));
  const matched = peer.skillsOffered.filter((skill) => wanted.has(skill.skill));
  if (matched.length === 0) return NO_MATCH;

  const score = matched.reduce(
    (total, skill) =>
      total +
      WEIGHT.match +
      (goalTags.has(skill.skill) ? WEIGHT.goal : 0) +
      (skill.verified ? WEIGHT.verified : 0),
    0
  );

  return {
    score,
    matchedTags: matched.map((skill) => skill.skill),
    matchedLabels: matched.map((skill) => skill.label),
  };
}

export type RankedPeer<T> = { user: T; match: PeerMatch };

/**
 * Ranks each page on its own and keeps earlier pages in place, so cards already
 * on screen never jump when the next page lands. `batchSize` must be the page
 * size the list was fetched with — every page but the last is exactly that long.
 */
export function rankInBatches<T extends Peer>(
  items: T[],
  viewer: Viewer,
  batchSize: number
): RankedPeer<T>[] {
  const ranked: RankedPeer<T>[] = [];

  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items
      .slice(start, start + batchSize)
      .map((user, index) => ({ user, match: scorePeer(viewer, user), index }));

    batch.sort(
      (a, b) =>
        b.match.score - a.match.score ||
        b.user.ratingAvg - a.user.ratingAvg ||
        b.user.ratingCount - a.user.ratingCount ||
        a.index - b.index
    );

    for (const { user, match } of batch) ranked.push({ user, match });
  }

  return ranked;
}
