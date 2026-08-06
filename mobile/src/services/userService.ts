/**
 * Component 1 — profiles, the skill portfolio, discovery and skill verification.
 *
 * Member 1 owns every write in this file. Two fields are deliberately absent:
 * `ratingAvg` and `ratingCount` are written only by Member 4's review transaction,
 * and `stats` only by Member 3's completion flow. This service reads them, never
 * writes them (integration contracts #4 and #7).
 */

import { updateProfile as updateAuthProfile } from 'firebase/auth';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type Query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { FILE_LIMITS, PAGE_SIZE } from '@/constants/config';
import { skillLabel, skillsInCategory, type Category } from '@/constants/skills';
import { auth, db } from '@/firebase/config';
import { nextCursor, type PageCursor } from '@/services/pagination';
import type { Level, SkillOffered, SkillTag, SkillWanted, TestQuestion, User } from '@/types';
import { uploadFile } from '@/utils/storage';

const usersRef = collection(db, 'users');

const toUser = (snapshot: QueryDocumentSnapshot<DocumentData>): User =>
  ({ ...snapshot.data(), uid: snapshot.id }) as User;

// ---------------------------------------------------------------- reading

/** One-shot read. This is the call other components use when they need a profile. */
export async function getUser(uid: string): Promise<User | null> {
  const snapshot = await getDoc(doc(db, 'users', uid));
  return snapshot.exists() ? ({ ...snapshot.data(), uid: snapshot.id } as User) : null;
}

/** Live profile, so a name or avatar change reflects without a manual refresh. */
export function subscribeToUser(
  uid: string,
  onNext: (user: User | null) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => onNext(snapshot.exists() ? ({ ...snapshot.data(), uid: snapshot.id } as User) : null),
    (error) => onError?.(error)
  );
}

// ---------------------------------------------------------------- discovery

export type UserSort = 'rating' | 'newest';

export type UserQueryOptions = {
  /** `null` / omitted = no preference (Firestore default order). */
  sort?: UserSort | null;
  pageSize?: number;
  cursor?: PageCursor;
};

export type UserPage = { items: User[]; cursor: PageCursor };

const sortConstraint = (sort: UserSort): QueryConstraint =>
  sort === 'newest' ? orderBy('createdAt', 'desc') : orderBy('ratingAvg', 'desc');

/**
 * Skill / category filters use `array-contains` (+ `orderBy` on another field).
 * That combination needs a composite index — without one Firestore throws, and
 * the Discovery screen used to show "Something went wrong" for an empty-looking
 * filter. Sorting the page client-side avoids that dependency for the demo.
 */
function sortUsers(users: User[], sort: UserSort | null | undefined): User[] {
  if (!sort) return users;

  return [...users].sort((a, b) => {
    if (sort === 'newest') {
      const aMs = a.createdAt?.toMillis?.() ?? 0;
      const bMs = b.createdAt?.toMillis?.() ?? 0;
      return bMs - aMs;
    }
    if (b.ratingAvg !== a.ratingAvg) return b.ratingAvg - a.ratingAvg;
    return b.ratingCount - a.ratingCount;
  });
}

async function runUserPage(
  base: Query<DocumentData>,
  constraints: QueryConstraint[],
  pageSize: number,
  cursor: PageCursor
): Promise<UserPage> {
  const paging = cursor ? [startAfter(cursor), limit(pageSize)] : [limit(pageSize)];
  const snapshot = await getDocs(query(base, ...constraints, ...paging));
  return { items: snapshot.docs.map(toUser), cursor: nextCursor(snapshot, pageSize) };
}

/** Exact tag match — this is why the search UI is chip-driven, not free text. */
export async function searchUsersBySkill(
  skillTag: SkillTag,
  opts: UserQueryOptions = {}
): Promise<UserPage> {
  const { sort = null, pageSize = PAGE_SIZE.discovery, cursor = null } = opts;
  const page = await runUserPage(
    usersRef,
    [where('skillTagsOffered', 'array-contains', skillTag)],
    pageSize,
    cursor
  );
  return { ...page, items: sortUsers(page.items, sort) };
}

/**
 * Prefix range query on `nameLower`: "cha" finds "Chamath", "math" does not.
 * Firestore has no full-text search, so the result must be ordered by the field
 * being ranged over — which is why a name search ignores the sort selector.
 */
export function searchUsersByName(prefix: string, opts: UserQueryOptions = {}): Promise<UserPage> {
  const { pageSize = PAGE_SIZE.discovery, cursor = null } = opts;
  const term = prefix.trim().toLowerCase();

  return runUserPage(
    usersRef,
    [
      where('nameLower', '>=', term),
      where('nameLower', '<=', `${term}\uf8ff`),
      orderBy('nameLower', 'asc'),
    ],
    pageSize,
    cursor
  );
}

/**
 * A category is not stored on the user — it is a set of skill tags, so this is an
 * `array-contains-any` over that set. Safe because no category in
 * `constants/skills.ts` has more than the 30 values the operator allows.
 */
export async function listUsersByCategory(
  category: Category,
  opts: UserQueryOptions = {}
): Promise<UserPage> {
  const { sort = null, pageSize = PAGE_SIZE.discovery, cursor = null } = opts;
  const tags = skillsInCategory(category).map((skill) => skill.tag);

  if (tags.length === 0) return { items: [], cursor: null };

  const page = await runUserPage(
    usersRef,
    [where('skillTagsOffered', 'array-contains-any', tags)],
    pageSize,
    cursor
  );
  return { ...page, items: sortUsers(page.items, sort) };
}

export function listUsers(opts: UserQueryOptions = {}): Promise<UserPage> {
  const { sort = null, pageSize = PAGE_SIZE.discovery, cursor = null } = opts;
  const constraints = sort ? [sortConstraint(sort)] : [];
  return runUserPage(usersRef, constraints, pageSize, cursor);
}

export type DiscoveryFilters = {
  /** Free text — only ever matched against a name prefix. */
  text?: string;
  skillTag?: SkillTag | null;
  category?: Category | null;
} & UserQueryOptions;

/**
 * One entry point for the Discovery screen. Only one filter dimension can drive
 * the Firestore query at a time; `level` is filtered in the screen because it
 * lives inside an array of objects, which Firestore cannot query into.
 */
export function searchUsers({ text, skillTag, category, ...opts }: DiscoveryFilters): Promise<UserPage> {
  const term = text?.trim();
  if (term) return searchUsersByName(term, opts);
  if (skillTag) return searchUsersBySkill(skillTag, opts);
  if (category) return listUsersByCategory(category, opts);
  return listUsers(opts);
}

// ---------------------------------------------------------------- profile writes

export type ProfilePatch = Partial<Pick<User, 'name' | 'bio' | 'location' | 'role' | 'avatarUrl'>>;

/**
 * `nameLower` is derived, never entered — keeping it in the same write is what
 * stops the prefix search from silently going stale after a rename.
 */
export async function updateProfile(uid: string, patch: ProfilePatch): Promise<void> {
  const payload: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    payload.name = name;
    payload.nameLower = name.toLowerCase();
  }

  await updateDoc(doc(db, 'users', uid), payload);

  // Keep the Firebase Auth displayName in step, so a fresh sign-in on another
  // device shows the right name before the profile document has loaded.
  if (patch.name !== undefined && auth.currentUser?.uid === uid) {
    await updateAuthProfile(auth.currentUser, { displayName: patch.name.trim() });
  }
}

/** Overwrites `avatars/{uid}.jpg` so old avatars never accumulate in Storage. */
export async function uploadAvatar(uid: string, localUri: string): Promise<string> {
  const { url } = await uploadFile(`avatars/${uid}.jpg`, localUri, FILE_LIMITS.avatar, 'image/jpeg');
  await updateProfile(uid, { avatarUrl: url });
  return url;
}

// ---------------------------------------------------------------- skill portfolio

export type SkillDraft = { skill: SkillTag; level: Level };

/**
 * The display array and the query array are written together, always. If they
 * ever diverge, a user shows a skill on their profile that discovery cannot find
 * — the single most confusing bug this data model can produce.
 *
 * The editor is draft-then-save, so this replaces the whole set in one write
 * rather than exposing add/remove calls that would each cost a round trip and
 * could interleave.
 */
export async function setSkillsOffered(uid: string, drafts: SkillDraft[]): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'users', uid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('Your profile could not be found.');

    const current = (snapshot.data().skillsOffered ?? []) as SkillOffered[];
    const verified = (snapshot.data().verifiedSkills ?? []) as SkillTag[];
    const previous = new Map(current.map((entry) => [entry.skill, entry]));

    // Credential counts and verification survive a level change or a re-add.
    const skillsOffered: SkillOffered[] = drafts.map(({ skill, level }) => ({
      skill,
      label: skillLabel(skill),
      level,
      verified: verified.includes(skill),
      credentialCount: previous.get(skill)?.credentialCount ?? 0,
    }));

    tx.update(ref, {
      skillsOffered,
      skillTagsOffered: skillsOffered.map((entry) => entry.skill),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function setSkillsWanted(uid: string, tags: SkillTag[]): Promise<void> {
  const skillsWanted: SkillWanted[] = tags.map((skill) => ({ skill, label: skillLabel(skill) }));

  await updateDoc(doc(db, 'users', uid), {
    skillsWanted,
    skillTagsWanted: tags,
    updatedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------- verification

/**
 * Writes the badge in two places in one transaction: `verifiedSkills` for
 * queries, and the matching `skillsOffered` entry so a skill chip can render the
 * tick without cross-referencing a second array.
 */
export async function markSkillVerified(uid: string, skill: SkillTag): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'users', uid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('Your profile could not be found.');

    const skillsOffered = ((snapshot.data().skillsOffered ?? []) as SkillOffered[]).map((entry) =>
      entry.skill === skill ? { ...entry, verified: true } : entry
    );

    tx.update(ref, {
      verifiedSkills: arrayUnion(skill),
      skillsOffered,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function saveTestAttempt(
  uid: string,
  skillTag: SkillTag,
  questions: TestQuestion[],
  answers: string[],
  score: number,
  passed: boolean,
  source: 'gemini' | 'fallback'
): Promise<string> {
  const created = await addDoc(collection(db, 'skillTests'), {
    userId: uid,
    skillTag,
    questions,
    answers,
    score,
    passed,
    source,
    createdAt: serverTimestamp(),
  });

  return created.id;
}
