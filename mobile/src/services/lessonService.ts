import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { careerGoalByTag, type CareerGoalTag } from '@/constants/careerGoals';
import { FILE_LIMITS } from '@/constants/config';
import { skillByTag } from '@/constants/skills';
import { db } from '@/firebase/config';
import type { Lesson, LessonContent, LessonEnrollment, User } from '@/types';
import { deleteFile, sanitizeStorageName, uploadFile } from '@/utils/storage';

export type LocalPdf = {
  uri: string;
  name: string;
  contentType: string;
};

export type LessonContentInput =
  | {
      id?: string;
      type: 'youtube';
      title: string;
      url: string;
      videoId?: string;
    }
  | {
      id?: string;
      type: 'pdf';
      title: string;
      fileName: string;
      fileUrl?: string;
      filePath?: string;
      fileSizeBytes?: number;
      replacement?: LocalPdf;
    };

export type LessonInput = {
  lessonName: string;
  description: string;
  careerGoalId: CareerGoalTag | null;
  contents: LessonContentInput[];
};

const lessonsCol = collection(db, 'lessons');
const enrollmentsCol = collection(db, 'enrollments');
const lessonProgressCol = collection(db, 'lessonProgress');

const toLesson = (snapshot: QueryDocumentSnapshot<DocumentData>): Lesson =>
  normalizeLesson({ ...snapshot.data(), id: snapshot.id });

function normalizeEnrollment(data: Record<string, unknown>, id: string): LessonEnrollment {
  return {
    ...data,
    id,
    completedContentIds: Array.isArray(data.completedContentIds)
      ? data.completedContentIds.map(String)
      : [],
    contentCount: Number(data.contentCount ?? 0),
    progress: Number(data.progress ?? 0),
    completed: data.completed === true,
    completedAt: (data.completedAt as LessonEnrollment['completedAt']) ?? null,
  } as LessonEnrollment;
}

const toEnrollment = (snapshot: QueryDocumentSnapshot<DocumentData>): LessonEnrollment =>
  normalizeEnrollment(snapshot.data(), snapshot.id);

function normalizeContents(value: unknown): LessonContent[] {
  if (!Array.isArray(value)) return [];

  const contents: LessonContent[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const data = item as Record<string, unknown>;
    const id = String(data.id ?? doc(collection(db, '_ids')).id);
    const itemType = data.type;

    if (itemType === 'youtube') {
      const source = String(data.videoId ?? data.url ?? data.videoUrl ?? '');
      const url = String(data.url ?? data.videoUrl ?? source);
      const videoId = extractYouTubeVideoId(source) ?? extractYouTubeVideoId(url);
      if (!videoId) continue;

      contents.push({
        id,
        type: 'youtube',
        title: String(data.title ?? 'YouTube Video'),
        videoId,
        url,
        createdAt: (data.createdAt as LessonContent['createdAt']) ?? null,
        updatedAt: (data.updatedAt as LessonContent['updatedAt']) ?? null,
      });
      continue;
    }

    if (itemType === 'pdf') {
      contents.push({
        id,
        type: 'pdf',
        title: String(data.title ?? data.fileName ?? 'PDF'),
        fileName: String(data.fileName ?? ''),
        fileUrl: String(data.fileUrl ?? ''),
        filePath: String(data.filePath ?? ''),
        fileSizeBytes: Number(data.fileSizeBytes ?? 0),
        createdAt: (data.createdAt as LessonContent['createdAt']) ?? null,
        updatedAt: (data.updatedAt as LessonContent['updatedAt']) ?? null,
      });
    }
  }

  return contents;
}

function normalizeLesson(data: Record<string, unknown>): Lesson {
  const title = String(data.lessonName ?? data.title ?? '');
  const teacherId = String(data.teacherId ?? data.ownerId ?? '');
  const careerGoalId = String(data.careerGoalId ?? data.careerGoal ?? data.goal ?? '') as CareerGoalTag;
  return {
    ...data,
    id: String(data.id),
    teacherId,
    teacherName: String(data.teacherName ?? data.ownerName ?? ''),
    teacherAvatarUrl: String(data.teacherAvatarUrl ?? data.ownerAvatarUrl ?? ''),
    lessonName: title,
    description: String(data.description ?? ''),
    careerGoalId,
    careerGoalName: String(
      data.careerGoalName ??
        data.careerGoalLabel ??
        careerGoalByTag(careerGoalId)?.label ??
        ''
    ),
    contents: normalizeContents(data.contents),
    published: data.published !== false,
    ownerId: String(data.ownerId ?? teacherId),
    ownerName: String(data.ownerName ?? data.teacherName ?? ''),
    ownerAvatarUrl: String(data.ownerAvatarUrl ?? data.teacherAvatarUrl ?? ''),
    title,
  } as Lesson;
}

export function extractYouTubeVideoId(value: string): string | null {
  const url = value.trim();
  if (!url) return null;

  const bare = /^[a-zA-Z0-9_-]{11}$/;
  if (bare.test(url)) return url;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v');
        return bare.test(id ?? '') ? id : null;
      }
      const embed = parsed.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
      return embed?.[1] ?? null;
    }

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return bare.test(id ?? '') ? id : null;
    }
  } catch {
    return null;
  }

  return null;
}

export function youtubeEmbedUrl(value: string): string | null {
  const videoId = extractYouTubeVideoId(value);
  return videoId
    ? `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1`
    : null;
}

export function validateLesson(input: LessonInput): void {
  const name = input.lessonName.trim();
  if (name.length < 3 || name.length > 120) {
    throw new Error('Lesson name must be between 3 and 120 characters.');
  }

  if (!input.careerGoalId || !careerGoalByTag(input.careerGoalId)) {
    throw new Error('Choose a career goal for this lesson.');
  }

  if (input.description.trim().length > 1000) {
    throw new Error('Lesson description must be 1000 characters or fewer.');
  }

  if (input.contents.length === 0) {
    throw new Error('Add at least one YouTube video or PDF.');
  }

  for (const item of input.contents) {
    const title = item.title.trim();
    if (title.length < 2 || title.length > 120) {
      throw new Error('Each content item needs a title between 2 and 120 characters.');
    }

    if (item.type === 'youtube' && !extractYouTubeVideoId(item.url)) {
      throw new Error('Add a valid YouTube URL.');
    }

    if (item.type === 'pdf' && !item.fileUrl && !item.replacement) {
      throw new Error('Choose a PDF file before saving.');
    }
  }
}

export async function getLesson(lessonId: string): Promise<Lesson | null> {
  const snapshot = await getDoc(doc(db, 'lessons', lessonId));
  return snapshot.exists() ? normalizeLesson({ ...snapshot.data(), id: snapshot.id }) : null;
}

export async function listLessons(): Promise<Lesson[]> {
  try {
    const snapshot = await getDocs(
      query(lessonsCol, where('published', '==', true), orderBy('updatedAt', 'desc'))
    );
    return snapshot.docs.map(toLesson);
  } catch {
    // Keep the learner feed available until the composite index is deployed.
    const snapshot = await getDocs(query(lessonsCol, where('published', '==', true)));
    return snapshot.docs
      .map(toLesson)
      .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
  }
}

export async function listLessonsByTeacher(teacherId: string): Promise<Lesson[]> {
  try {
    const snapshot = await getDocs(
      query(lessonsCol, where('teacherId', '==', teacherId), orderBy('updatedAt', 'desc'))
    );
    return snapshot.docs.map(toLesson);
  } catch {
    const snapshot = await getDocs(query(lessonsCol, where('teacherId', '==', teacherId)));
    return snapshot.docs
      .map(toLesson)
      .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
  }
}

/** Live source of truth for lessons authored by a teacher. */
export function subscribeToLessonsByTeacher(
  teacherId: string,
  onValue: (lessons: Lesson[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    query(lessonsCol, where('teacherId', '==', teacherId)),
    (snapshot) => {
      onValue(
        snapshot.docs
          .map(toLesson)
          .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0))
      );
    },
    (error) => onError?.(error)
  );
}

function basePayload(teacher: User, input: LessonInput) {
  const goal = input.careerGoalId ? careerGoalByTag(input.careerGoalId) : undefined;
  const primarySkill = goal?.skillTags[0];
  const skill = primarySkill ? skillByTag(primarySkill) : undefined;
  const title = input.lessonName.trim();

  return {
    teacherId: teacher.uid,
    teacherName: teacher.name,
    teacherAvatarUrl: teacher.avatarUrl ?? '',
    lessonName: title,
    careerGoalId: input.careerGoalId,
    careerGoalName: goal?.label ?? '',
    published: true,
    ownerId: teacher.uid,
    ownerName: teacher.name,
    ownerAvatarUrl: teacher.avatarUrl ?? '',
    title,
    description: input.description.trim(),
    skillTag: primarySkill ?? '',
    category: skill?.category ?? 'Programming',
    level: 'beginner',
    format: input.contents.some((item) => item.type === 'youtube') ? 'video' : 'pdf',
    content: '',
    cards: [],
    mediaUrl: '',
    mediaPath: '',
    mediaSizeBytes: 0,
    thumbnailUrl: '',
    durationMins: Math.max(5, input.contents.length * 5),
    quiz: [],
    quizSource: 'manual',
    updatedAt: serverTimestamp(),
  };
}

async function buildContents(
  teacherId: string,
  lessonId: string,
  lessonName: string,
  items: LessonContentInput[],
  previous: LessonContent[] = [],
  uploadedPaths: string[] = []
): Promise<LessonContent[]> {
  const now = null;
  const byId = new Map(previous.map((item) => [item.id, item]));
  const next: LessonContent[] = [];

  for (const item of items) {
    const id = item.id || doc(collection(db, '_ids')).id;
    const previousItem = byId.get(id);

    if (item.type === 'youtube') {
      const videoId = extractYouTubeVideoId(item.url);
      if (!videoId) throw new Error('Add a valid YouTube URL.');

      next.push({
        id,
        type: 'youtube',
        title: item.title.trim(),
        videoId,
        url: item.url.trim(),
        createdAt: previousItem?.createdAt ?? now,
        updatedAt: now,
      });
    } else {
      let fileUrl = item.fileUrl ?? '';
      let filePath = item.filePath ?? '';
      let fileName = item.fileName;
      let fileSizeBytes = item.fileSizeBytes ?? 0;

      if (item.replacement) {
        const originalFileName = item.replacement.name.trim();
        const pdfName = sanitizeStorageName(originalFileName.replace(/\.pdf$/i, ''), 'pdf');
        const lessonFolder = `${sanitizeStorageName(lessonName, 'lesson')}-${lessonId}`;
        const path = `lesson-files/${teacherId}/${lessonFolder}/${pdfName}-${id}.pdf`;
        const upload = await uploadFile(
          path,
          item.replacement.uri,
          FILE_LIMITS.lessonPdf,
          item.replacement.contentType,
          { lessonId, contentId: id }
        );
        uploadedPaths.push(upload.path);
        fileUrl = upload.url;
        filePath = upload.path;
        fileName = originalFileName;
        fileSizeBytes = upload.sizeBytes;
      }

      next.push({
        id,
        type: 'pdf',
        title: item.title.trim(),
        fileName,
        fileUrl,
        filePath,
        fileSizeBytes,
        createdAt: previousItem?.createdAt ?? now,
        updatedAt: now,
      });
    }
  }

  return next;
}

export async function createLesson(teacher: User, input: LessonInput): Promise<string> {
  if (teacher.role === 'learner') throw new Error('Only teachers can create lessons.');
  validateLesson(input);

  const ref = doc(lessonsCol);
  const batch = writeBatch(db);
  batch.set(ref, {
    id: ref.id,
    ...basePayload(teacher, input),
    published: false,
    contents: [],
    viewCount: 0,
    completeCount: 0,
    createdAt: serverTimestamp(),
  });
  await batch.commit();

  const uploadedPaths: string[] = [];
  try {
    const contents = await buildContents(
      teacher.uid,
      ref.id,
      input.lessonName,
      input.contents,
      [],
      uploadedPaths
    );
    await updateDoc(ref, { contents, published: true, updatedAt: serverTimestamp() });
  } catch (error) {
    await Promise.allSettled(uploadedPaths.map(deleteFile));
    await deleteDoc(ref);
    throw error;
  }

  return ref.id;
}

export async function updateLesson(teacher: User, lessonId: string, input: LessonInput): Promise<void> {
  if (teacher.role === 'learner') throw new Error('Only teachers can edit lessons.');
  validateLesson(input);

  const existing = await getLesson(lessonId);
  if (!existing) throw new Error('That lesson no longer exists.');
  if (existing.teacherId !== teacher.uid) throw new Error('Only the teacher who created this lesson can edit it.');

  const uploadedPaths: string[] = [];
  let nextContents: LessonContent[];
  try {
    nextContents = await buildContents(
      teacher.uid,
      lessonId,
      input.lessonName,
      input.contents,
      existing.contents,
      uploadedPaths
    );

    const lessonRef = doc(db, 'lessons', lessonId);
    await runTransaction(db, async (transaction) => {
      const currentSnapshot = await transaction.get(lessonRef);
      if (!currentSnapshot.exists()) throw new Error('That lesson no longer exists.');
      if (currentSnapshot.data().teacherId !== teacher.uid) {
        throw new Error('Only the teacher who created this lesson can edit it.');
      }
      if (currentSnapshot.data().deleting === true) {
        throw new Error('This lesson is being deleted and can no longer be edited.');
      }
      transaction.update(lessonRef, {
        ...basePayload(teacher, input),
        contents: nextContents,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    await Promise.allSettled(uploadedPaths.map(deleteFile));
    throw error;
  }

  const goal = careerGoalByTag(input.careerGoalId!);
  const [enrollmentsSnapshot, progressSnapshot] = await Promise.all([
    getDocs(query(enrollmentsCol, where('lessonId', '==', lessonId))),
    getDocs(query(lessonProgressCol, where('lessonId', '==', lessonId))),
  ]);
  for (let start = 0; start < enrollmentsSnapshot.docs.length; start += 500) {
    const batch = writeBatch(db);
    for (const enrollmentDoc of enrollmentsSnapshot.docs.slice(start, start + 500)) {
      batch.update(enrollmentDoc.ref, {
        lessonName: input.lessonName.trim(),
        teacherName: teacher.name,
        careerGoalId: input.careerGoalId,
        careerGoalName: goal?.label ?? '',
        contentCount: nextContents.length,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  for (let start = 0; start < progressSnapshot.docs.length; start += 500) {
    const batch = writeBatch(db);
    for (const progressDoc of progressSnapshot.docs.slice(start, start + 500)) {
      batch.update(progressDoc.ref, {
        lessonTitle: input.lessonName.trim(),
        skillTag: goal?.skillTags[0] ?? '',
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  const nextFilePaths = new Set(
    nextContents.flatMap((item) => item.type === 'pdf' ? [item.filePath] : [])
  );
  const obsoletePaths = existing.contents.flatMap((item) =>
    item.type === 'pdf' && item.filePath && !nextFilePaths.has(item.filePath) ? [item.filePath] : []
  );
  await Promise.allSettled(obsoletePaths.map(deleteFile));
}

export async function deleteLesson(teacherId: string, lessonId: string): Promise<void> {
  const existing = await getLesson(lessonId);
  if (!existing) return;
  if (existing.teacherId !== teacherId) throw new Error('Only the teacher who created this lesson can delete it.');

  // Remove the lesson from learner queries before any irreversible cleanup.
  await updateDoc(doc(db, 'lessons', lessonId), {
    published: false,
    deleting: true,
    updatedAt: serverTimestamp(),
  });

  const [enrollmentsSnapshot, progressSnapshot] = await Promise.all([
    getDocs(query(enrollmentsCol, where('lessonId', '==', lessonId))),
    getDocs(query(lessonProgressCol, where('lessonId', '==', lessonId))),
  ]);

  const relatedDocs = [...enrollmentsSnapshot.docs, ...progressSnapshot.docs];
  const maxBatchWrites = 500;

  for (let start = 0; start < relatedDocs.length; start += maxBatchWrites) {
    const batch = writeBatch(db);
    for (const relatedDoc of relatedDocs.slice(start, start + maxBatchWrites)) {
      batch.delete(relatedDoc.ref);
    }
    await batch.commit();
  }

  await Promise.all(
    existing.contents.flatMap((item) =>
      item.type === 'pdf' && item.filePath ? [deleteFile(item.filePath)] : []
    )
  );
  await deleteDoc(doc(db, 'lessons', lessonId));
}

export const enrollmentIdFor = (userId: string, lessonId: string): string => `${userId}_${lessonId}`;

export async function getEnrollment(userId: string, lessonId: string): Promise<LessonEnrollment | null> {
  const snapshot = await getDoc(doc(db, 'enrollments', enrollmentIdFor(userId, lessonId)));
  return snapshot.exists() ? normalizeEnrollment(snapshot.data(), snapshot.id) : null;
}

export async function listEnrollmentsByUser(userId: string): Promise<LessonEnrollment[]> {
  try {
    const snapshot = await getDocs(
      query(enrollmentsCol, where('userId', '==', userId), orderBy('updatedAt', 'desc'))
    );
    return snapshot.docs.map(toEnrollment);
  } catch {
    const snapshot = await getDocs(query(enrollmentsCol, where('userId', '==', userId)));
    return snapshot.docs
      .map(toEnrollment)
      .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
  }
}

export async function listEnrollmentIds(userId: string): Promise<Set<string>> {
  const enrollments = await listEnrollmentsByUser(userId);
  return new Set(enrollments.map((enrollment) => enrollment.lessonId));
}

export async function enrollInLesson(user: User, lesson: Lesson): Promise<void> {
  if (user.role === 'teacher') throw new Error('Switch to Teach & learn before enrolling in lessons.');

  const enrollmentId = enrollmentIdFor(user.uid, lesson.id);
  const enrollmentRef = doc(db, 'enrollments', enrollmentId);
  const progressRef = doc(db, 'lessonProgress', enrollmentId);
  const lessonRef = doc(db, 'lessons', lesson.id);
  await runTransaction(db, async (transaction) => {
    const [lessonSnapshot, enrollmentSnapshot] = await Promise.all([
      transaction.get(lessonRef),
      transaction.get(enrollmentRef),
    ]);
    if (enrollmentSnapshot.exists()) return;
    if (!lessonSnapshot.exists() || lessonSnapshot.data().published !== true || lessonSnapshot.data().deleting === true) {
      throw new Error('This lesson is no longer available for enrollment.');
    }

    const currentLesson = normalizeLesson({ ...lessonSnapshot.data(), id: lessonSnapshot.id });
    transaction.set(enrollmentRef, {
      id: enrollmentId,
      userId: user.uid,
      lessonId: currentLesson.id,
      lessonName: currentLesson.lessonName,
      teacherId: currentLesson.teacherId,
      teacherName: currentLesson.teacherName,
      careerGoalId: currentLesson.careerGoalId,
      careerGoalName: currentLesson.careerGoalName,
      contentCount: currentLesson.contents.length,
      completedContentIds: [],
      progress: 0,
      completed: false,
      completedAt: null,
      enrolledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(progressRef, {
      id: enrollmentId,
      userId: user.uid,
      lessonId: currentLesson.id,
      lessonTitle: currentLesson.lessonName,
      skillTag: currentLesson.skillTag,
      status: 'in_progress',
      lastCardIndex: 0,
      quizScore: 0,
      quizAttempts: 0,
      minutesSpent: 0,
      startedAt: serverTimestamp(),
      completedAt: null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

function calculateProgress(completedIds: string[], lesson: Lesson): number {
  const currentContentIds = new Set(lesson.contents.map((item) => item.id));
  const validCompleted = completedIds.filter((id) => currentContentIds.has(id));
  if (lesson.contents.length === 0) return 0;
  return Math.round((validCompleted.length / lesson.contents.length) * 100);
}

export async function toggleLessonContentDone(
  user: User,
  lesson: Lesson,
  contentId: string
): Promise<LessonEnrollment> {
  const enrollmentRef = doc(db, 'enrollments', enrollmentIdFor(user.uid, lesson.id));
  const progressRef = doc(db, 'lessonProgress', `${user.uid}_${lesson.id}`);
  const lessonRef = doc(db, 'lessons', lesson.id);
  const userRef = doc(db, 'users', user.uid);
  return runTransaction(db, async (transaction) => {
    const [enrollmentSnapshot, lessonSnapshot] = await Promise.all([
      transaction.get(enrollmentRef),
      transaction.get(lessonRef),
    ]);
    if (!enrollmentSnapshot.exists()) {
      throw new Error('Enroll in this lesson before updating progress.');
    }
    if (!lessonSnapshot.exists() || lessonSnapshot.data().published !== true || lessonSnapshot.data().deleting === true) {
      throw new Error('This lesson is no longer available.');
    }

    const currentLesson = normalizeLesson({ ...lessonSnapshot.data(), id: lessonSnapshot.id });
    const validContentIds = new Set(currentLesson.contents.map((item) => item.id));
    if (!validContentIds.has(contentId)) {
      throw new Error('That content item is no longer part of this lesson.');
    }

    const enrollment = normalizeEnrollment(enrollmentSnapshot.data(), enrollmentSnapshot.id);
    const completedSet = new Set(
      enrollment.completedContentIds.filter((id) => validContentIds.has(id))
    );
    if (completedSet.has(contentId)) completedSet.delete(contentId);
    else completedSet.add(contentId);

    const completedContentIds = [...completedSet];
    const progress = calculateProgress(completedContentIds, currentLesson);
    const completed = currentLesson.contents.length > 0 && progress === 100;
    const completionDelta = Number(completed) - Number(enrollment.completed);

    transaction.update(enrollmentRef, {
      contentCount: currentLesson.contents.length,
      completedContentIds,
      progress,
      completed,
      completedAt: completed ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
    transaction.set(progressRef, {
      id: progressRef.id,
      userId: user.uid,
      lessonId: lesson.id,
      lessonTitle: currentLesson.lessonName,
      skillTag: currentLesson.skillTag,
      status: completed ? 'completed' : 'in_progress',
      lastCardIndex: Math.max(0, currentLesson.contents.findIndex((item) => item.id === contentId)),
      quizScore: 0,
      quizAttempts: 0,
      minutesSpent: Math.max(0, completedContentIds.length * 5),
      completedAt: completed ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    if (completionDelta !== 0) {
      transaction.update(lessonRef, {
        completeCount: increment(completionDelta),
        updatedAt: serverTimestamp(),
      });
      transaction.update(userRef, {
        'stats.lessonsCompleted': increment(completionDelta),
      });
    }

    return {
      ...enrollment,
      contentCount: currentLesson.contents.length,
      completedContentIds,
      progress,
      completed,
      completedAt: completed ? enrollment.completedAt : null,
      updatedAt: enrollment.updatedAt,
    };
  });
}

export async function markLessonCompleted(user: User, lesson: Lesson): Promise<void> {
  const progressRef = doc(db, 'lessonProgress', `${user.uid}_${lesson.id}`);
  const enrollmentRef = doc(db, 'enrollments', enrollmentIdFor(user.uid, lesson.id));
  const lessonRef = doc(db, 'lessons', lesson.id);
  const userRef = doc(db, 'users', user.uid);

  await runTransaction(db, async (transaction) => {
    const [enrollmentSnapshot, lessonSnapshot] = await Promise.all([
      transaction.get(enrollmentRef),
      transaction.get(lessonRef),
    ]);
    if (!lessonSnapshot.exists() || lessonSnapshot.data().published !== true || lessonSnapshot.data().deleting === true) {
      throw new Error('This lesson is no longer available.');
    }
    const currentLesson = normalizeLesson({ ...lessonSnapshot.data(), id: lessonSnapshot.id });
    if (!enrollmentSnapshot.exists() && currentLesson.teacherId !== user.uid) {
      throw new Error('Enroll in this lesson before updating progress.');
    }
    const wasCompleted = enrollmentSnapshot.exists() && enrollmentSnapshot.data().completed === true;

    transaction.set(progressRef, {
      id: progressRef.id,
      userId: user.uid,
      lessonId: currentLesson.id,
      lessonTitle: currentLesson.lessonName,
      skillTag: currentLesson.skillTag,
      status: 'completed',
      lastCardIndex: Math.max(0, currentLesson.contents.length - 1),
      quizScore: 0,
      quizAttempts: 0,
      minutesSpent: Math.max(5, currentLesson.contents.length * 5),
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    if (enrollmentSnapshot.exists()) {
      transaction.update(enrollmentRef, {
        contentCount: currentLesson.contents.length,
        completedContentIds: currentLesson.contents.map((item) => item.id),
        progress: 100,
        completed: true,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    if (!wasCompleted) {
      transaction.update(lessonRef, {
        completeCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      if (enrollmentSnapshot.exists()) {
        transaction.update(userRef, { 'stats.lessonsCompleted': increment(1) });
      }
    }
  });
}
