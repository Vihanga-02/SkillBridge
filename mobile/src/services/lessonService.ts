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
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v');
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
  const snapshot = await getDocs(
    query(lessonsCol, where('published', '==', true), orderBy('updatedAt', 'desc'))
  );
  return snapshot.docs.map(toLesson);
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
    description: `${goal?.label ?? 'Career'} lesson`,
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
  previous: LessonContent[] = []
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
        fileUrl = upload.url;
        filePath = upload.path;
        fileName = originalFileName;
        fileSizeBytes = upload.sizeBytes;

        if (previousItem?.type === 'pdf' && previousItem.filePath && previousItem.filePath !== filePath) {
          await deleteFile(previousItem.filePath);
        }
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
    contents: [],
    viewCount: 0,
    completeCount: 0,
    createdAt: serverTimestamp(),
  });
  await batch.commit();

  try {
    const contents = await buildContents(teacher.uid, ref.id, input.lessonName, input.contents);
    await updateDoc(ref, { contents, updatedAt: serverTimestamp() });
  } catch (error) {
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

  const nextContents = await buildContents(
    teacher.uid,
    lessonId,
    input.lessonName,
    input.contents,
    existing.contents
  );
  const nextIds = new Set(nextContents.map((item) => item.id));

  for (const item of existing.contents) {
    if (item.type === 'pdf' && !nextIds.has(item.id) && item.filePath) {
      await deleteFile(item.filePath);
    }
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'lessons', lessonId), {
    ...basePayload(teacher, input),
    contents: nextContents,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function deleteLesson(teacherId: string, lessonId: string): Promise<void> {
  const existing = await getLesson(lessonId);
  if (!existing) return;
  if (existing.teacherId !== teacherId) throw new Error('Only the teacher who created this lesson can delete it.');

  const [enrollmentsSnapshot, progressSnapshot] = await Promise.all([
    getDocs(query(enrollmentsCol, where('lessonId', '==', lessonId))),
    getDocs(query(lessonProgressCol, where('lessonId', '==', lessonId))),
  ]);

  for (const item of existing.contents) {
    if (item.type === 'pdf' && item.filePath) await deleteFile(item.filePath);
  }

  const relatedDocs = [...enrollmentsSnapshot.docs, ...progressSnapshot.docs];
  const maxBatchWrites = 500;

  for (let start = 0; start < relatedDocs.length; start += maxBatchWrites) {
    const batch = writeBatch(db);
    for (const relatedDoc of relatedDocs.slice(start, start + maxBatchWrites)) {
      batch.delete(relatedDoc.ref);
    }
    await batch.commit();
  }

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
  const existing = await getDoc(enrollmentRef);
  if (existing.exists()) return;

  const batch = writeBatch(db);
  batch.set(enrollmentRef, {
    id: enrollmentId,
    userId: user.uid,
    lessonId: lesson.id,
    lessonName: lesson.lessonName,
    teacherId: lesson.teacherId,
    teacherName: lesson.teacherName,
    careerGoalId: lesson.careerGoalId,
    careerGoalName: lesson.careerGoalName,
    contentCount: lesson.contents.length,
    completedContentIds: [],
    progress: 0,
    completed: false,
    completedAt: null,
    enrolledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(
    progressRef,
    {
      id: enrollmentId,
      userId: user.uid,
      lessonId: lesson.id,
      lessonTitle: lesson.lessonName,
      skillTag: lesson.skillTag,
      status: 'in_progress',
      lastCardIndex: 0,
      quizScore: 0,
      quizAttempts: 0,
      minutesSpent: 0,
      startedAt: serverTimestamp(),
      completedAt: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();
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
  const enrollmentSnapshot = await getDoc(enrollmentRef);
  if (!enrollmentSnapshot.exists()) {
    throw new Error('Enroll in this lesson before updating progress.');
  }

  const enrollment = normalizeEnrollment(enrollmentSnapshot.data(), enrollmentSnapshot.id);
  const validContentIds = new Set(lesson.contents.map((item) => item.id));
  if (!validContentIds.has(contentId)) {
    throw new Error('That content item is no longer part of this lesson.');
  }

  const completedSet = new Set(
    enrollment.completedContentIds.filter((id) => validContentIds.has(id))
  );
  if (completedSet.has(contentId)) completedSet.delete(contentId);
  else completedSet.add(contentId);

  const completedContentIds = [...completedSet];
  const progress = calculateProgress(completedContentIds, lesson);
  const completed = lesson.contents.length > 0 && progress === 100;

  const batch = writeBatch(db);
  batch.update(enrollmentRef, {
    contentCount: lesson.contents.length,
    completedContentIds,
    progress,
    completed,
    completedAt: completed ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
  batch.set(
    progressRef,
    {
      id: progressRef.id,
      userId: user.uid,
      lessonId: lesson.id,
      lessonTitle: lesson.lessonName,
      skillTag: lesson.skillTag,
      status: completed ? 'completed' : 'in_progress',
      lastCardIndex: Math.max(
        0,
        lesson.contents.findIndex((item) => item.id === contentId)
      ),
      quizScore: 0,
      quizAttempts: 0,
      minutesSpent: Math.max(0, completedContentIds.length * 5),
      completedAt: completed ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();

  return {
    ...enrollment,
    contentCount: lesson.contents.length,
    completedContentIds,
    progress,
    completed,
    completedAt: completed ? enrollment.completedAt : null,
    updatedAt: enrollment.updatedAt,
  };
}

export async function markLessonCompleted(user: User, lesson: Lesson): Promise<void> {
  const progressRef = doc(db, 'lessonProgress', `${user.uid}_${lesson.id}`);
  const enrollmentRef = doc(db, 'enrollments', enrollmentIdFor(user.uid, lesson.id));
  const enrollment = await getDoc(enrollmentRef);
  if (!enrollment.exists() && lesson.teacherId !== user.uid) {
    throw new Error('Enroll in this lesson before updating progress.');
  }

  const batch = writeBatch(db);
  batch.set(
    progressRef,
    {
      id: progressRef.id,
      userId: user.uid,
      lessonId: lesson.id,
      lessonTitle: lesson.lessonName,
      skillTag: lesson.skillTag,
      status: 'completed',
      lastCardIndex: Math.max(0, lesson.contents.length - 1),
      quizScore: 0,
      quizAttempts: 0,
      minutesSpent: Math.max(5, lesson.contents.length * 5),
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  if (enrollment.exists()) {
    batch.update(enrollmentRef, {
      contentCount: lesson.contents.length,
      completedContentIds: lesson.contents.map((item) => item.id),
      progress: 100,
      completed: true,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  batch.update(doc(db, 'lessons', lesson.id), {
    completeCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
