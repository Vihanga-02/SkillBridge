/**
 * Component 1 — Skill Credentials (§5.1.1).
 *
 * `users/{uid}/credentials/{credentialId}`: a subcollection, not an array on the
 * user document, because the user document is the hottest read in the app and
 * this data is needed on exactly one screen. The `{uid}` path segment is also the
 * entire authorisation rule — there is no ownerId field to forge.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { FILE_LIMITS } from '@/constants/config';
import { db } from '@/firebase/config';
import type { Credential, CredentialType, SkillOffered, SkillTag } from '@/types';
import { deleteFile, uploadFile } from '@/utils/storage';

export type CredentialFile = {
  uri: string;
  contentType: string;
  kind: 'image' | 'pdf';
};

export type CredentialInput = {
  skillTag: SkillTag;
  type: CredentialType;
  title: string;
  issuer: string;
  /** 'YYYY-MM-DD' */
  issueDate: string;
  /** 'YYYY-MM-DD' or '' */
  expiryDate: string;
  referenceNo: string;
  verifyUrl: string;
  description: string;
  visibility: 'public' | 'private';
};

const credentialsRef = (uid: string) => collection(db, 'users', uid, 'credentials');

const toCredential = (snapshot: QueryDocumentSnapshot<DocumentData>): Credential =>
  ({ ...snapshot.data(), id: snapshot.id }) as Credential;

/** A local date string is stored as a real Timestamp so ordering and ranges work. */
const toTimestamp = (isoDate: string): Timestamp =>
  Timestamp.fromDate(new Date(`${isoDate}T00:00:00`));

const toIsoDate = (value: Timestamp | null | undefined): string =>
  value ? value.toDate().toISOString().slice(0, 10) : '';

/** Turns a stored credential back into form values, for the edit flow. */
export const toCredentialInput = (credential: Credential): CredentialInput => ({
  skillTag: credential.skillTag,
  type: credential.type,
  title: credential.title,
  issuer: credential.issuer,
  issueDate: toIsoDate(credential.issueDate),
  expiryDate: toIsoDate(credential.expiryDate),
  referenceNo: credential.referenceNo,
  verifyUrl: credential.verifyUrl,
  description: credential.description,
  visibility: credential.visibility,
});

// ---------------------------------------------------------------- reading

function sortByIssueDateDesc(credentials: Credential[]): Credential[] {
  return [...credentials].sort((a, b) => {
    const aMs = a.issueDate?.toMillis?.() ?? 0;
    const bMs = b.issueDate?.toMillis?.() ?? 0;
    return bMs - aMs;
  });
}

/**
 * The owner's own list — no visibility filter, so private credentials appear.
 * Ordered by date only; the grouping by skill is done in the UI.
 */
export async function listCredentials(uid: string): Promise<Credential[]> {
  // Single-field orderBy is auto-indexed. If a project ever lacks it, fall back
  // to an unordered read + client sort rather than crashing the profile screen.
  try {
    const snapshot = await getDocs(query(credentialsRef(uid), orderBy('issueDate', 'desc')));
    return snapshot.docs.map(toCredential);
  } catch {
    const snapshot = await getDocs(credentialsRef(uid));
    return sortByIssueDateDesc(snapshot.docs.map(toCredential));
  }
}

/**
 * Someone else's list. The `visibility` filter is not optional: the security rule
 * checks `resource.data.visibility == 'public'`, and Firestore evaluates rules
 * against the *query*, so omitting it makes the whole query fail rather than
 * silently returning fewer rows.
 *
 * `orderBy` is intentionally omitted — `visibility` + `issueDate` needs a
 * composite index, and without one the public profile showed "Something went
 * wrong" instead of the credentials. Sort client-side instead.
 */
export async function listPublicCredentials(uid: string): Promise<Credential[]> {
  const snapshot = await getDocs(
    query(credentialsRef(uid), where('visibility', '==', 'public'))
  );
  return sortByIssueDateDesc(snapshot.docs.map(toCredential));
}

export async function listCredentialsBySkill(
  uid: string,
  skillTag: SkillTag,
  publicOnly = true
): Promise<Credential[]> {
  // Keep the visibility constraint when required by security rules; filter the
  // skill client-side so we never depend on a multi-field composite index.
  const snapshot = publicOnly
    ? await getDocs(query(credentialsRef(uid), where('visibility', '==', 'public')))
    : await getDocs(credentialsRef(uid));

  return sortByIssueDateDesc(
    snapshot.docs.map(toCredential).filter((credential) => credential.skillTag === skillTag)
  );
}

export async function getCredential(uid: string, credentialId: string): Promise<Credential | null> {
  const snapshot = await getDoc(doc(db, 'users', uid, 'credentials', credentialId));
  return snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as Credential) : null;
}

// ---------------------------------------------------------------- writing

function credentialPayload(uid: string, input: CredentialInput) {
  return {
    userId: uid,
    skillTag: input.skillTag,
    type: input.type,
    title: input.title.trim(),
    issuer: input.issuer.trim(),
    issueDate: toTimestamp(input.issueDate),
    expiryDate: input.expiryDate ? toTimestamp(input.expiryDate) : null,
    referenceNo: input.referenceNo.trim(),
    verifyUrl: input.verifyUrl.trim(),
    description: input.description.trim(),
    visibility: input.visibility,
    // Kept as a field rather than a boolean so admin or peer verification can be
    // added later without a migration. Always displayed as "Self-declared".
    verificationStatus: 'self_declared' as const,
    updatedAt: serverTimestamp(),
  };
}

/**
 * Order matters: the document is created first so the file has an id to be named
 * after, then the file is uploaded, then the document is patched with the file
 * details, and only then are the counters bumped.
 */
export async function addCredential(
  uid: string,
  input: CredentialInput,
  file?: CredentialFile
): Promise<string> {
  const ref = doc(credentialsRef(uid));

  await setDoc(ref, {
    ...credentialPayload(uid, input),
    id: ref.id,
    fileUrl: '',
    filePath: '',
    fileType: 'none',
    fileSizeBytes: 0,
    createdAt: serverTimestamp(),
  });

  if (file) {
    const extension = file.kind === 'pdf' ? 'pdf' : 'jpg';
    const path = `credentials/${uid}/${ref.id}.${extension}`;

    try {
      const upload = await uploadFile(path, file.uri, FILE_LIMITS.credential, file.contentType);
      await updateDoc(ref, {
        fileUrl: upload.url,
        filePath: upload.path,
        fileType: file.kind,
        fileSizeBytes: upload.sizeBytes,
        updatedAt: serverTimestamp(),
      });
    } catch (uploadError) {
      // A credential pointing at a file that failed to upload is worse than no
      // credential, so roll the document back and let the user retry.
      await deleteDoc(ref);
      throw uploadError;
    }
  }

  await adjustCounters(uid, input.skillTag, 1);
  return ref.id;
}

/**
 * Editing can move a credential to a different skill, which has to move the
 * per-skill counter with it — otherwise the old skill keeps a count for evidence
 * it no longer has.
 */
export async function updateCredential(
  uid: string,
  credentialId: string,
  input: CredentialInput,
  file?: CredentialFile
): Promise<void> {
  const ref = doc(db, 'users', uid, 'credentials', credentialId);
  const existing = await getCredential(uid, credentialId);
  if (!existing) throw new Error('That credential no longer exists.');

  await updateDoc(ref, credentialPayload(uid, input));

  if (file) {
    const extension = file.kind === 'pdf' ? 'pdf' : 'jpg';
    const path = `credentials/${uid}/${credentialId}.${extension}`;

    const upload = await uploadFile(path, file.uri, FILE_LIMITS.credential, file.contentType);
    await updateDoc(ref, {
      fileUrl: upload.url,
      filePath: upload.path,
      fileType: file.kind,
      fileSizeBytes: upload.sizeBytes,
      updatedAt: serverTimestamp(),
    });

    // Replacing a JPG with a PDF changes the path, leaving the old object behind.
    if (existing.filePath && existing.filePath !== path) {
      await deleteFile(existing.filePath);
    }
  }

  if (existing.skillTag !== input.skillTag) {
    await adjustCounters(uid, existing.skillTag, -1);
    await adjustCounters(uid, input.skillTag, 1);
  }
}

/**
 * Storage file first, then the document, then the counters. Reverse that and a
 * failure halfway leaves a document pointing at a file that no longer exists —
 * which renders as a broken image on somebody else's profile.
 */
export async function deleteCredential(uid: string, credentialId: string): Promise<void> {
  const existing = await getCredential(uid, credentialId);
  if (!existing) return;

  if (existing.filePath) await deleteFile(existing.filePath);
  await deleteDoc(doc(db, 'users', uid, 'credentials', credentialId));
  await adjustCounters(uid, existing.skillTag, -1);
}

export async function toggleVisibility(uid: string, credential: Credential): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'credentials', credential.id), {
    visibility: credential.visibility === 'public' ? 'private' : 'public',
    updatedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------- counters

/**
 * Bumps `users.credentialCount` and the matching `skillsOffered[].credentialCount`
 * together. A transaction is needed because the per-skill count lives inside an
 * array of objects, which has to be read, edited and written whole.
 */
async function adjustCounters(uid: string, skillTag: SkillTag, delta: number): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'users', uid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) return;

    const data = snapshot.data();
    const skillsOffered = ((data.skillsOffered ?? []) as SkillOffered[]).map((entry) =>
      entry.skill === skillTag
        ? { ...entry, credentialCount: Math.max(0, (entry.credentialCount ?? 0) + delta) }
        : entry
    );

    tx.update(ref, {
      credentialCount: Math.max(0, (data.credentialCount ?? 0) + delta),
      skillsOffered,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * The repair action. Every denormalized value in this project can drift if a
 * write half-fails, so the owner gets a quiet "Recount" that reads the truth from
 * the subcollection and rewrites both counters.
 */
export async function recountCredentials(uid: string): Promise<void> {
  const credentials = await listCredentials(uid);

  const perSkill = new Map<string, number>();
  for (const credential of credentials) {
    perSkill.set(credential.skillTag, (perSkill.get(credential.skillTag) ?? 0) + 1);
  }

  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'users', uid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('Your profile could not be found.');

    const skillsOffered = ((snapshot.data().skillsOffered ?? []) as SkillOffered[]).map((entry) => ({
      ...entry,
      credentialCount: perSkill.get(entry.skill) ?? 0,
    }));

    tx.update(ref, {
      credentialCount: credentials.length,
      skillsOffered,
      updatedAt: serverTimestamp(),
    });
  });
}

/** A credential whose expiry has passed is marked, never hidden. */
export const isExpired = (credential: Credential): boolean => {
  const expiry = credential.expiryDate?.toDate();
  return expiry ? expiry.getTime() < Date.now() : false;
};
