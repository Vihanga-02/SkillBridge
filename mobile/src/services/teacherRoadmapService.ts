import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where, type DocumentData } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';
import { listEnrollmentsByUser, listLessonsByIds } from '@/services/lessonService';
import type { Lesson, LessonEnrollment, TeacherRoadmap, User } from '@/types';
import { canLearnRoadmaps, canManageRoadmaps, roadmapProgress, validateRoadmap, type RoadmapInput } from '@/utils/teacherRoadmaps';

const roadmapsCol = collection(db, 'teacherRoadmaps');
function normalize(data: DocumentData, id: string): TeacherRoadmap {
  return { ...data, id, lessonIds: Array.isArray(data.lessonIds) ? [...new Set(data.lessonIds.filter((id: unknown) => typeof id === 'string'))] as string[] : [],
    revision: Number(data.revision ?? 0) } as TeacherRoadmap;
}
function requireAccount(user: User) {
  if (auth.currentUser?.uid !== user.uid) throw new Error('Sign in to access learning roadmaps.');
}
export async function getTeacherRoadmap(id: string): Promise<TeacherRoadmap | null> {
  const snapshot = await getDoc(doc(db, 'teacherRoadmaps', id));
  return snapshot.exists() ? normalize(snapshot.data(), snapshot.id) : null;
}
export async function saveTeacherRoadmap(user: User, input: RoadmapInput, id?: string, expectedRevision?: number): Promise<string> {
  requireAccount(user);
  if (!canManageRoadmaps(user.role)) throw new Error('Only Teacher and Both users can manage roadmaps.');
  const data = validateRoadmap(input);
  const ref = id ? doc(db, 'teacherRoadmaps', id) : doc(roadmapsCol);
  await runTransaction(db, async transaction => {
    const profile = await transaction.get(doc(db, 'users', user.uid));
    if (!canManageRoadmaps(profile.data()?.role)) throw new Error('Only Teacher and Both users can manage roadmaps.');
    const existing = await transaction.get(ref);
    if (id && !existing.exists()) throw new Error('This roadmap no longer exists.');
    if (existing.exists() && existing.data().teacherId !== user.uid) throw new Error('Only the roadmap creator can edit it.');
    if (id && (existing.data()?.revision ?? 0) !== expectedRevision) throw new Error('This roadmap changed in another session. Reopen it before saving.');
    const lessons = await Promise.all(data.lessonIds.map(lessonId => transaction.get(doc(db, 'lessons', lessonId))));
    for (const snapshot of lessons) {
      const lesson = snapshot.data();
      if (!lesson || lesson.published === false || lesson.deleting) throw new Error('A selected lesson is unavailable. Remove it before saving.');
      if ((lesson.teacherId ?? lesson.ownerId) !== user.uid) throw new Error('You can only add lessons you created.');
      const goal = lesson.careerGoalId ?? lesson.careerGoal ?? lesson.goal;
      if (goal !== data.careerGoalId) throw new Error('Every lesson must match the roadmap career goal.');
    }
    transaction.set(ref, { ...data, teacherId: user.uid, teacherName: profile.data()?.name ?? user.name,
      revision: existing.exists() ? Number(existing.data().revision ?? 0) + 1 : 0,
      createdAt: existing.data()?.createdAt ?? serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return ref.id;
}

export type RoadmapData = { roadmaps: TeacherRoadmap[]; lessons: Lesson[]; enrollments: LessonEnrollment[] };
const sortRoadmaps = (rows: TeacherRoadmap[]) => rows.sort((a, b) =>
  (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0) || a.title.localeCompare(b.title));

/** One enrollment load, chunked membership queries and one deduplicated lesson batch load. */
export async function loadRoadmaps(user: User, mode: 'teach' | 'learn'): Promise<RoadmapData> {
  requireAccount(user);
  if (mode === 'teach' && !canManageRoadmaps(user.role)) throw new Error('Only teachers can manage roadmaps.');
  if (mode === 'learn' && !canLearnRoadmaps(user.role)) throw new Error('Switch to Teach & learn to use learner roadmaps.');
  const enrollments = mode === 'learn' ? await listEnrollmentsByUser(user.uid) : [];
  const rows = new Map<string, TeacherRoadmap>();
  if (mode === 'teach') {
    const snapshot = await getDocs(query(roadmapsCol, where('teacherId', '==', user.uid)));
    snapshot.docs.forEach(row => rows.set(row.id, normalize(row.data(), row.id)));
  } else {
    const ids = [...new Set(enrollments.map(row => row.lessonId))];
    for (let start = 0; start < ids.length; start += 30) {
      const snapshot = await getDocs(query(roadmapsCol, where('lessonIds', 'array-contains-any', ids.slice(start, start + 30))));
      snapshot.docs.forEach(row => rows.set(row.id, normalize(row.data(), row.id)));
    }
  }
  const lessons = await listLessonsByIds([...new Set([...rows.values()].flatMap(row => row.lessonIds))]);
  const byLesson = new Map(lessons.map(row => [row.id, row]));
  const byEnrollment = new Map(enrollments.map(row => [row.lessonId, row]));
  const roadmaps = [...rows.values()].filter(row => mode === 'teach' ||
    roadmapProgress(row, byLesson, byEnrollment).items.some(item => item.available && item.enrollment));
  return { roadmaps: sortRoadmaps(roadmaps), lessons, enrollments };
}

export async function loadRoadmapDetail(user: User, id: string, mode: 'teach' | 'learn'): Promise<RoadmapData> {
  requireAccount(user);
  const roadmap = await getTeacherRoadmap(id);
  if (!roadmap) throw new Error('This roadmap no longer exists.');
  if (mode === 'teach' && (!canManageRoadmaps(user.role) || roadmap.teacherId !== user.uid)) {
    throw new Error('Only the roadmap creator can manage it.');
  }
  if (mode === 'learn' && !canLearnRoadmaps(user.role)) throw new Error('This is a learner roadmap view.');
  const [lessons, enrollments] = await Promise.all([
    listLessonsByIds(roadmap.lessonIds), mode === 'learn' ? listEnrollmentsByUser(user.uid) : Promise.resolve([]),
  ]);
  const summary = roadmapProgress(roadmap, new Map(lessons.map(row => [row.id, row])), new Map(enrollments.map(row => [row.lessonId, row])));
  if (mode === 'learn' && !summary.items.some(item => item.available && item.enrollment)) {
    throw new Error('Enroll in a lesson in this roadmap to access it.');
  }
  return { roadmaps: [roadmap], lessons, enrollments };
}
