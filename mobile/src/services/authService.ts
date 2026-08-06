/**
 * Component 0 — Authentication (shared, whole team).
 *
 * Every other component depends on the `users/{uid}` document this file creates,
 * so the profile is written in the same call as the account: no other screen has
 * to defend against a signed-in user with no profile.
 */

import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { careerGoalByTag, type CareerGoalTag } from '@/constants/careerGoals';
import { ONBOARDING } from '@/constants/config';
import { skillLabel } from '@/constants/skills';
import { auth, db } from '@/firebase/config';
import { deriveWantedSkills } from '@/services/userService';
import type { CareerGoal, Level, SkillOffered, SkillTag, SkillWanted, UserRole } from '@/types';

/**
 * The default shape of a brand-new profile. Kept as one function because
 * `completeOnboarding` merges it in too — that way an account whose profile write
 * failed repairs itself instead of leaving the user stuck with no document.
 */
function newUserProfile(uid: string, name: string, email: string) {
  return {
    uid,
    name,
    nameLower: name.toLowerCase(),
    email,
    role: 'both' as UserRole,
    bio: '',
    avatarUrl: '',
    location: '',
    skillsOffered: [] as SkillOffered[],
    skillTagsOffered: [] as SkillTag[],
    careerGoals: [] as CareerGoal[],
    extraSkillsWanted: [] as SkillTag[],
    skillsWanted: [] as SkillWanted[],
    skillTagsWanted: [] as SkillTag[],
    verifiedSkills: [] as SkillTag[],
    credentialCount: 0,
    ratingAvg: 0,
    ratingCount: 0,
    credits: ONBOARDING.welcomeCredits,
    badges: [] as string[],
    stats: { sessionsTaught: 0, sessionsAttended: 0, lessonsCompleted: 0 },
    streak: 0,
    lastActiveDate: '',
    onboardingComplete: false,
    updatedAt: serverTimestamp(),
  };
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<FirebaseUser> {
  const trimmedEmail = email.trim();
  const trimmedName = name.trim();

  const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
  await updateProfile(cred.user, { displayName: trimmedName });

  await setDoc(doc(db, 'users', cred.user.uid), {
    ...newUserProfile(cred.user.uid, trimmedName, trimmedEmail),
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

export const login = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email.trim(), password);

export const logout = () => signOut(auth);

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email.trim());

export type OnboardingAnswers = {
  role: UserRole;
  /** each skill the user can teach, with the level they claim */
  skillsOffered: { skill: SkillTag; level: Level }[];
  /** onboarding only asks for one goal; more can be added later from profile edit */
  careerGoal?: { goal: CareerGoalTag; skillTags: SkillTag[] } | null;
  /** skills picked with no goal attached — the fallback path when a goal is skipped */
  extraSkillsWanted: SkillTag[];
};

/**
 * Closes the onboarding wizard, which is the last step of account creation.
 * Merges the default profile back in so an account whose `register` write failed
 * still ends up with a complete document. Every later skill edit belongs to
 * Member 1's `userService` — this function runs exactly once per account.
 */
export async function completeOnboarding(
  user: FirebaseUser,
  answers: OnboardingAnswers
): Promise<void> {
  const skillsOffered: SkillOffered[] = answers.skillsOffered.map(({ skill, level }) => ({
    skill,
    label: skillLabel(skill),
    level,
    verified: false,
    credentialCount: 0,
  }));

  const careerGoals: CareerGoal[] = answers.careerGoal
    ? [
        {
          goal: answers.careerGoal.goal,
          label: careerGoalByTag(answers.careerGoal.goal)?.label ?? answers.careerGoal.goal,
          skillTags: answers.careerGoal.skillTags,
        },
      ]
    : [];
  const { skillsWanted, skillTagsWanted } = deriveWantedSkills(careerGoals, answers.extraSkillsWanted);

  const name = user.displayName?.trim() || user.email?.split('@')[0] || 'SkillBridge member';
  const ref = doc(db, 'users', user.uid);
  const existing = await getDoc(ref);

  await setDoc(
    ref,
    {
      ...newUserProfile(user.uid, name, user.email ?? ''),
      // Only stamp createdAt when the document is genuinely new, so a repaired
      // profile keeps its real signup time and "newest members" stays honest.
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
      role: answers.role,
      skillsOffered,
      skillTagsOffered: skillsOffered.map((s) => s.skill),
      careerGoals,
      extraSkillsWanted: answers.extraSkillsWanted,
      skillsWanted,
      skillTagsWanted,
      onboardingComplete: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
