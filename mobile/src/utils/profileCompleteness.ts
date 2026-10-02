import type { User } from '@/types';

type ProfileCompletenessSource = Pick<
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

export type ProfileCompletenessItem = {
  id: 'avatar' | 'bio' | 'location' | 'offered-skill' | 'wanted-skill' | 'credential';
  label: string;
  actionLabel: string;
  destination: 'profile' | 'credentials';
  completed: boolean;
};

export type ProfileCompleteness = {
  items: ProfileCompletenessItem[];
  completedCount: number;
  percentage: number;
  nextItem: ProfileCompletenessItem | null;
};

const hasText = (value: string): boolean => value.trim().length > 0;

/**
 * Builds a role-aware checklist entirely from the live profile document.
 * Learners are not penalized for credentials/offered skills, and teachers are
 * not penalized for wanted skills that do not apply to their selected role.
 */
export function getProfileCompleteness(profile: ProfileCompletenessSource): ProfileCompleteness {
  const canTeach = profile.role === 'teacher' || profile.role === 'both';
  const canLearn = profile.role === 'learner' || profile.role === 'both';

  const items: ProfileCompletenessItem[] = [
    {
      id: 'avatar',
      label: 'Profile photo',
      actionLabel: 'Add a profile photo',
      destination: 'profile',
      completed: hasText(profile.avatarUrl),
    },
    {
      id: 'bio',
      label: 'Short bio',
      actionLabel: 'Write a short bio',
      destination: 'profile',
      completed: hasText(profile.bio),
    },
    {
      id: 'location',
      label: 'Campus or location',
      actionLabel: 'Add your location',
      destination: 'profile',
      completed: hasText(profile.location),
    },
  ];

  if (canTeach) {
    items.push({
      id: 'offered-skill',
      label: 'A skill you can teach',
      actionLabel: 'Add a teaching skill',
      destination: 'profile',
      completed: profile.skillsOffered.length > 0,
    });
  }

  if (canLearn) {
    items.push({
      id: 'wanted-skill',
      label: 'A skill you want to learn',
      actionLabel: 'Add a learning skill',
      destination: 'profile',
      completed: profile.skillTagsWanted.length > 0 || profile.skillsWanted.length > 0,
    });
  }

  if (canTeach) {
    items.push({
      id: 'credential',
      label: 'A teaching credential',
      actionLabel: 'Add a credential',
      destination: 'credentials',
      completed: profile.credentialCount > 0,
    });
  }

  const completedCount = items.filter((item) => item.completed).length;

  return {
    items,
    completedCount,
    percentage: Math.round((completedCount / items.length) * 100),
    nextItem: items.find((item) => !item.completed) ?? null,
  };
}
