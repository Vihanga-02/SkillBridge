import type { User } from '@/types';

/** List fields every screen treats as arrays. Older accounts can predate some of them. */
const LIST_FIELDS = [
  'skillsOffered',
  'skillTagsOffered',
  'careerGoals',
  'extraSkillsWanted',
  'skillsWanted',
  'skillTagsWanted',
  'verifiedSkills',
  'badges',
] as const;

/**
 * Turns a raw `users/{uid}` document into a `User` whose list fields are always
 * arrays. Accounts created before career goals (or other later fields) existed
 * simply lack those keys, and code like `profile.careerGoals.flatMap` must not
 * crash on them. Used for the signed-in profile and for every other user read.
 */
export function withUserDefaults(data: Record<string, unknown>, uid: string): User {
  const user: Record<string, unknown> = { ...data, uid };
  for (const field of LIST_FIELDS) {
    if (!Array.isArray(user[field])) user[field] = [];
  }
  return user as User;
}
