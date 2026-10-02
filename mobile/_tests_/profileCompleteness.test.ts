import type { User } from '../src/types';
import { getProfileCompleteness } from '../src/utils/profileCompleteness';

type CompletenessProfile = Pick<
  User,
  | 'role'
  | 'avatarUrl'
  | 'bio'
  | 'location'
  | 'skillsOffered'
  | 'skillsWanted'
  | 'skillTagsWanted'
  | 'credentialCount'
>;

const baseProfile: CompletenessProfile = {
  role: 'both',
  avatarUrl: '',
  bio: '',
  location: '',
  skillsOffered: [],
  skillsWanted: [],
  skillTagsWanted: [],
  credentialCount: 0,
};

describe('getProfileCompleteness', () => {
  it('includes all six checks for a teaching and learning profile', () => {
    const result = getProfileCompleteness(baseProfile);

    expect(result.items.map((item) => item.id)).toEqual([
      'avatar',
      'bio',
      'location',
      'offered-skill',
      'wanted-skill',
      'credential',
    ]);
    expect(result.completedCount).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.nextItem?.id).toBe('avatar');
  });

  it('does not require teaching fields from learner-only profiles', () => {
    const result = getProfileCompleteness({
      ...baseProfile,
      role: 'learner',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: 'Learning mobile development.',
      location: 'Main campus',
      skillTagsWanted: ['react'],
    });

    expect(result.items).toHaveLength(4);
    expect(result.items.some((item) => item.id === 'credential')).toBe(false);
    expect(result.items.some((item) => item.id === 'offered-skill')).toBe(false);
    expect(result.percentage).toBe(100);
    expect(result.nextItem).toBeNull();
  });

  it('points teachers to credentials after their profile and teaching skill are complete', () => {
    const result = getProfileCompleteness({
      ...baseProfile,
      role: 'teacher',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: 'I teach practical design skills.',
      location: 'Design faculty',
      skillsOffered: [
        {
          skill: 'ui-ux',
          label: 'UI/UX Design',
          level: 'advanced',
          verified: false,
          credentialCount: 0,
        },
      ],
    });

    expect(result.items).toHaveLength(5);
    expect(result.percentage).toBe(80);
    expect(result.nextItem).toMatchObject({
      id: 'credential',
      destination: 'credentials',
      actionLabel: 'Add a credential',
    });
  });

  it('treats whitespace-only text as incomplete', () => {
    const result = getProfileCompleteness({
      ...baseProfile,
      role: 'learner',
      avatarUrl: '   ',
      bio: '\n',
      location: '\t',
    });

    expect(result.completedCount).toBe(0);
  });
});
