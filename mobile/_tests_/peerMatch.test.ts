import type { SkillTag } from '../src/constants/skills';
import type { CareerGoal, SkillOffered, User } from '../src/types';
import { rankInBatches, scorePeer } from '../src/utils/peerMatch';

type Viewer = Pick<User, 'skillTagsWanted' | 'careerGoals'>;
type Peer = Pick<User, 'uid' | 'skillsOffered' | 'ratingAvg' | 'ratingCount'>;

const offered = (skill: SkillTag, verified = false): SkillOffered => ({
  skill,
  label: skill,
  level: 'intermediate',
  verified,
  credentialCount: 0,
});

const peer = (uid: string, skills: SkillOffered[], ratingAvg = 0, ratingCount = 0): Peer => ({
  uid,
  skillsOffered: skills,
  ratingAvg,
  ratingCount,
});

const goal: CareerGoal = {
  goal: 'software-engineer',
  label: 'Software Engineer',
  skillTags: ['javascript'],
};

const viewer: Viewer = {
  skillTagsWanted: ['javascript', 'python', 'figma'],
  careerGoals: [goal],
};

const uids = (ranked: { user: Peer }[]) => ranked.map((entry) => entry.user.uid);

describe('scorePeer', () => {
  it('returns no match when the viewer wants nothing', () => {
    const result = scorePeer({ skillTagsWanted: [], careerGoals: [] }, peer('a', [offered('python')]));
    expect(result.score).toBe(0);
    expect(result.matchedTags).toEqual([]);
  });

  it('returns no match when the peer teaches nothing the viewer wants', () => {
    expect(scorePeer(viewer, peer('a', [offered('java')])).score).toBe(0);
  });

  it('lists the matched skills in the order the peer offers them', () => {
    const result = scorePeer(viewer, peer('a', [offered('figma'), offered('java'), offered('python')]));
    expect(result.matchedTags).toEqual(['figma', 'python']);
    expect(result.matchedLabels).toEqual(['figma', 'python']);
  });

  it('scores two wanted skills above one wanted skill with every bonus', () => {
    const two = scorePeer(viewer, peer('a', [offered('python'), offered('figma')]));
    const oneWithBonuses = scorePeer(viewer, peer('b', [offered('javascript', true)]));
    expect(two.score).toBeGreaterThan(oneWithBonuses.score);
  });

  it('gives a career-goal skill and a verified skill a small bonus', () => {
    const plain = scorePeer(viewer, peer('a', [offered('python')])).score;
    const goalSkill = scorePeer(viewer, peer('b', [offered('javascript')])).score;
    const verified = scorePeer(viewer, peer('c', [offered('python', true)])).score;
    expect(goalSkill).toBeGreaterThan(plain);
    expect(verified).toBeGreaterThan(plain);
  });
});

describe('rankInBatches', () => {
  it('puts more matching skills first', () => {
    const items = [
      peer('none', [offered('java')]),
      peer('one', [offered('python')]),
      peer('two', [offered('python'), offered('figma')]),
    ];
    expect(uids(rankInBatches(items, viewer, 12))).toEqual(['two', 'one', 'none']);
  });

  it('breaks equal scores by rating, then review count, then original order', () => {
    const items = [
      peer('low', [offered('python')], 3, 10),
      peer('high-few', [offered('python')], 5, 1),
      peer('high-many', [offered('python')], 5, 8),
      peer('tie-first', [offered('figma')], 3, 10),
    ];
    expect(uids(rankInBatches(items, viewer, 12))).toEqual([
      'high-many',
      'high-few',
      'low',
      'tie-first',
    ]);
  });

  it('keeps peers with no overlap, after the matches', () => {
    const items = [peer('none', [offered('java')]), peer('match', [offered('python')])];
    const ranked = rankInBatches(items, viewer, 12);
    expect(uids(ranked)).toEqual(['match', 'none']);
    expect(ranked[1].match.score).toBe(0);
  });

  it('never moves an earlier page when a later page loads', () => {
    const firstPage = [peer('a', [offered('java')]), peer('b', [offered('python')])];
    const secondPage = [peer('c', [offered('python'), offered('figma')]), peer('d', [])];

    const before = uids(rankInBatches(firstPage, viewer, 2));
    const after = uids(rankInBatches([...firstPage, ...secondPage], viewer, 2));

    expect(before).toEqual(['b', 'a']);
    expect(after.slice(0, 2)).toEqual(before);
    expect(after.slice(2)).toEqual(['c', 'd']);
  });
});
