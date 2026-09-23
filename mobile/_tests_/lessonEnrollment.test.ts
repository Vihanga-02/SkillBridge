jest.mock('@/firebase/config', () => ({ auth: { currentUser: { uid: 'teacher' } }, db: {} }));
jest.mock('@/utils/storage', () => ({ deleteFile: jest.fn(), sanitizeStorageName: jest.fn(), uploadFile: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ path: name })),
  doc: jest.fn((dbOrCol, col, id) => id ? ({ path: col + '/' + id, id }) : (() => { const id = Math.random().toString(36).slice(2); return { path: dbOrCol.path + '/' + id, id }; })()),
  query: jest.fn((col, ...filters) => ({ col, filters })), where: jest.fn((field, op, value) => ({ field, op, value })),
  documentId: jest.fn(() => '__name__'), orderBy: jest.fn(),
  getDocsFromServer: jest.fn(), getDocs: jest.fn(), getDoc: jest.fn(),
  runTransaction: jest.fn(), updateDoc: jest.fn(), serverTimestamp: jest.fn(() => 'timestamp'),
  writeBatch: jest.fn(), increment: jest.fn((amount) => ({ increment: amount })),
}));
import { getDocsFromServer, getDocs, getDoc, runTransaction, updateDoc, writeBatch } from 'firebase/firestore';
import { auth } from '@/firebase/config';
import { createLesson, deleteLesson, enrollInLesson, getLesson, listLessonsByIds, updateLesson, toggleLessonContentDone } from '@/services/lessonService';
import { deleteFile } from '@/utils/storage';
import type { Lesson, User } from '@/types';

type Data = Record<string, any>;
type Ref = { path: string; id?: string };
let records: Map<string, Data>;
let versions: Map<string, number>;
let events: string[];
const lesson = { id: 'lesson' } as Lesson;
const teacher = { uid: 'teacher', role: 'teacher', name: 'Teacher' } as User;
const learner = (uid = 'learner', role = 'learner') => ({ uid, role } as User);
const input = {
  lessonName: 'Test lesson', description: 'Description', careerGoalId: 'software_engineer' as any,
  contents: [{ type: 'youtube' as const, title: 'Video', url: 'https://youtu.be/dQw4w9WgXcQ' }],
};
const put = (path: string, data: Data) => {
  records.set(path, data);
  versions.set(path, (versions.get(path) ?? 0) + 1);
};
const snapshot = (ref: Ref) => {
  const data = records.get(ref.path);
  const copy = data ? JSON.parse(JSON.stringify(data)) : undefined;
  return { exists: () => copy !== undefined, id: ref.id ?? ref.path.split('/').at(-1), ref, data: () => copy };
};
const apply = (op: string, ref: Ref, data?: Data, merge = false) => {
  events.push(op + ':' + ref.path);
  if (op === 'delete') {
    records.delete(ref.path);
    versions.set(ref.path, (versions.get(ref.path) ?? 0) + 1);
  } else {
    const value = { ...(op === 'update' || merge ? records.get(ref.path) : {}), ...data };
    for (const [key, field] of Object.entries(value)) {
      if (field && typeof field === 'object' && 'increment' in field) {
        value[key] = (records.get(ref.path)?.[key] ?? 0) + field.increment;
      }
    }
    put(ref.path, value);
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  records = new Map(); versions = new Map(); events = [];
  (auth as any).currentUser = { uid: 'teacher' };
  put('users/teacher', { role: 'teacher' });
  put('lessons/lesson', {
    teacherId: 'teacher', ownerId: 'teacher', published: true, enrollmentCount: 0,
    enrollmentCountVersion: 1, deleting: false, lessonName: 'Original', skillTag: 'javascript',
    contents: [
      { id: 'pdf', type: 'pdf', filePath: 'lesson-files/teacher/title-lesson/file.pdf' },
      { id: 'legacy', type: 'pdf', filePath: '', storagePath: 'lessons/lesson/old.pdf' },
      { id: 'other', type: 'pdf', filePath: 'lesson-files/teacher/title-other/file.pdf' },
      { id: 'otherTeacher', type: 'pdf', filePath: 'lesson-files/other/title-lesson/file.pdf' },
    ],
  });
  // Optimistic transaction model: conflicts retry the callback; writes commit together.
  (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const reads = new Map<string, number>();
      const writes: (() => void)[] = [];
      const result = await callback({
        get: async (ref: Ref) => { reads.set(ref.path, versions.get(ref.path) ?? 0); return snapshot(ref); },
        update: (ref: Ref, data: Data) => writes.push(() => apply('update', ref, data)),
        set: (ref: Ref, data: Data, options?: { merge: boolean }) => writes.push(() => apply('set', ref, data, options?.merge)),
        delete: (ref: Ref) => writes.push(() => apply('delete', ref)),
      });
      if ([...reads].some(([path, version]) => (versions.get(path) ?? 0) !== version)) continue;
      writes.forEach((write) => write());
      return result;
    }
    throw new Error('Too many retries');
  });
  const queryResult = async ({ col, filters }: any) => ({ docs: [...records]
    .filter(([path, data]) => path.startsWith(col.path + '/') && filters.filter(Boolean).every((f: any) =>
      f.op === 'in' ? f.value.includes(path.split('/').at(-1)) : data[f.field] === f.value))
    .map(([path]) => snapshot({ path })) });
  (getDocsFromServer as jest.Mock).mockImplementation(queryResult);
  (getDocs as jest.Mock).mockImplementation(queryResult);
  (getDoc as jest.Mock).mockImplementation(async (ref) => snapshot(ref));
  (updateDoc as jest.Mock).mockImplementation(async (ref, data) => apply('update', ref, data));
  (writeBatch as jest.Mock).mockImplementation(() => {
    const writes: (() => void)[] = [];
    return {
      set: (ref: Ref, data: Data) => writes.push(() => apply('set', ref, data)),
      delete: (ref: Ref) => writes.push(() => apply('delete', ref)),
      commit: async () => writes.forEach((write) => write()),
    };
  });
  (deleteFile as jest.Mock).mockImplementation(async (path: string) => { events.push('file:' + path); });
});

it('initializes new lessons at verified zero', async () => {
  // Use an actual project career goal rather than assuming the tag spelling.
  const { CAREER_GOALS } = require('@/constants/careerGoals');
  const id = await createLesson(teacher, { ...input, careerGoalId: CAREER_GOALS[0].tag });
  expect(records.get('lessons/' + id)).toMatchObject({ enrollmentCount: 0, enrollmentCountVersion: 1, published: true });
});
it('creates one enrollment, progress and count together', async () => {
  await enrollInLesson(learner(), lesson);
  expect(records.get('lessons/lesson')?.enrollmentCount).toBe(1);
  expect(records.get('enrollments/learner_lesson')).toMatchObject({ userId: 'learner', lessonId: 'lesson' });
  expect(records.has('lessonProgress/learner_lesson')).toBe(true);
  expect(getDocs).not.toHaveBeenCalled();
  expect(getDocsFromServer).not.toHaveBeenCalled();
});
it('rapid duplicate attempts increment once and preserve progress', async () => {
  await Promise.all(Array.from({ length: 5 }, () => enrollInLesson(learner(), lesson)));
  expect(records.get('lessons/lesson')?.enrollmentCount).toBe(1);
  expect([...records.keys()].filter((path) => path.startsWith('enrollments/'))).toHaveLength(1);
  put('enrollments/learner_lesson', { ...records.get('enrollments/learner_lesson'), progress: 50 });
  await enrollInLesson(learner(), lesson);
  expect(records.get('enrollments/learner_lesson')?.progress).toBe(50);
});
it('three concurrent distinct learners count exactly three', async () => {
  await Promise.all(['one', 'two', 'three'].map((uid) => enrollInLesson(learner(uid), lesson)));
  expect(records.get('lessons/lesson')?.enrollmentCount).toBe(3);
});
it('BOTH self-enrollment counts and prevents deleting owned lesson', async () => {
  put('users/teacher', { role: 'both' });
  await enrollInLesson(learner('teacher', 'both'), lesson);
  expect(records.get('lessons/lesson')?.enrollmentCount).toBe(1);
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('learners are currently enrolled');
  expect(deleteFile).not.toHaveBeenCalled();
});
it.each(['teacher', 'both'])('deletes a zero-enrollment lesson owned by %s last, preserving foreign files', async (role) => {
  put('users/teacher', { role });
  put('lessonProgress/teacher_lesson', { lessonId: 'lesson', userId: 'teacher' });
  await deleteLesson('teacher', 'lesson');
  expect(records.has('lessons/lesson')).toBe(false);
  expect(records.has('lessonProgress/teacher_lesson')).toBe(false);
  expect(deleteFile).toHaveBeenCalledTimes(2);
  expect(deleteFile).toHaveBeenCalledWith('lessons/lesson/old.pdf');
  expect(events.at(-1)).toBe('delete:lessons/lesson');
  await deleteLesson('teacher', 'lesson'); // Already complete.
});
it.each([1, 2])('uses fresh count %i instead of stale caller/UI state', async (count) => {
  put('lessons/lesson', { ...records.get('lessons/lesson'), enrollmentCount: count });
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('learners are currently enrolled');
  expect(events).toEqual([]);
  expect(deleteFile).not.toHaveBeenCalled();
});
it('serializes concurrent deletion and enrollment without an orphan', async () => {
  await Promise.allSettled([deleteLesson('teacher', 'lesson'), enrollInLesson(learner(), lesson)]);
  const enrolled = records.has('enrollments/learner_lesson');
  expect(enrolled ? records.get('lessons/lesson')?.enrollmentCount : !records.has('lessons/lesson')).toBe(enrolled ? 1 : true);
});
it('rejects enrollment after lock and cannot partially commit an enrollment', async () => {
  put('lessons/lesson', { ...records.get('lessons/lesson'), deleting: true });
  await expect(enrollInLesson(learner(), lesson)).rejects.toThrow('no longer available');
  expect(records.has('enrollments/learner_lesson')).toBe(false);
  expect(records.get('lessons/lesson')?.enrollmentCount).toBe(0);
});
it('keeps lock after partial cleanup and safely retries original stored paths', async () => {
  (deleteFile as jest.Mock).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'));
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('offline');
  expect(records.get('lessons/lesson')).toMatchObject({ deleting: true, deletionCleanupStarted: true });
  await deleteLesson('teacher', 'lesson');
  expect(records.has('lessons/lesson')).toBe(false);
  expect(deleteFile).toHaveBeenCalledTimes(4);
});
it('releases a fresh lock when preparation fails before destructive cleanup', async () => {
  (getDocsFromServer as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('offline');
  expect(records.get('lessons/lesson')).toMatchObject({ deleting: false, published: true });
  expect(deleteFile).not.toHaveBeenCalled();
});
it('never unlocks interrupted cleanup on retry preparation failure', async () => {
  put('lessons/lesson', { ...records.get('lessons/lesson'), deleting: true, published: false, deletionCleanupStarted: true });
  (getDocsFromServer as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('offline');
  expect(records.get('lessons/lesson')?.deleting).toBe(true);
});
it('legacy lessons preserve an unknown count and cannot delete or enroll before reconciliation', async () => {
  const data = { ...records.get('lessons/lesson') };
  delete data.enrollmentCount; delete data.enrollmentCountVersion;
  put('lessons/lesson', data);
  expect((await getLesson('lesson'))?.enrollmentCount).toBeUndefined();
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('reconciliation');
  await expect(enrollInLesson(learner(), lesson)).rejects.toThrow('reconciliation');
});
it('rejects malformed/negative aggregates', async () => {
  put('lessons/lesson', { ...records.get('lessons/lesson'), enrollmentCount: -1 });
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('reconciliation');
  await expect(enrollInLesson(learner(), lesson)).rejects.toThrow('reconciliation');
});
it('rejects nonowners, learner-only deletion and impersonated creator', async () => {
  await expect(deleteLesson('other', 'lesson')).rejects.toThrow('Sign in');
  put('lessons/lesson', { ...records.get('lessons/lesson'), teacherId: 'other' });
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('Only the teacher');
  put('lessons/lesson', { ...records.get('lessons/lesson'), teacherId: 'teacher' });
  put('users/teacher', { role: 'learner' });
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('Only the teacher');
});
it('teacher-only enrollment remains disallowed', async () => {
  await expect(enrollInLesson(teacher, lesson)).rejects.toThrow('Teach & learn');
});
it('loads counts for enrolled cards using batched lesson metadata only', async () => {
  const rows = await listLessonsByIds(['lesson', 'lesson']);
  expect(rows[0].enrollmentCount).toBe(0);
  expect(getDocs).toHaveBeenCalledTimes(1);
  expect((getDocs as jest.Mock).mock.calls[0][0].col.path).toBe('lessons');
  expect(getDocsFromServer).not.toHaveBeenCalled();
});
it('editing an enrolled lesson preserves its count without reading other enrollments', async () => {
  const { CAREER_GOALS } = require('@/constants/careerGoals');
  put('lessons/lesson', { ...records.get('lessons/lesson'), enrollmentCount: 3, contents: [] });
  await updateLesson(teacher, 'lesson', { ...input, careerGoalId: CAREER_GOALS[0].tag });
  expect(records.get('lessons/lesson')).toMatchObject({ enrollmentCount: 3, lessonName: 'Test lesson' });
  expect(getDocs).not.toHaveBeenCalled();
});
it('completion progress does not change total enrollment count', async () => {
  await enrollInLesson(learner(), lesson);
  await toggleLessonContentDone(learner(), lesson, 'pdf');
  expect(records.get('lessons/lesson')?.enrollmentCount).toBe(1);
  expect(records.get('enrollments/learner_lesson')?.progress).toBe(25);
});

it('a stale delete attempt cannot clean a replacement deletion lock', async () => {
  let releaseQuery!: (value: { docs: never[] }) => void;
  let enteredQuery!: () => void;
  const entered = new Promise<void>((resolve) => { enteredQuery = resolve; });
  (getDocsFromServer as jest.Mock).mockImplementationOnce(() => {
    enteredQuery();
    return new Promise((resolve) => { releaseQuery = resolve; });
  });
  const staleAttempt = deleteLesson('teacher', 'lesson');
  await entered;
  // Another attempt released the preparation lock, then a fresh attempt acquired it.
  put('lessons/lesson', {
    ...records.get('lessons/lesson'), deletionToken: 'replacement-lock', deletionCleanupStarted: false,
  });
  releaseQuery({ docs: [] });
  await expect(staleAttempt).rejects.toThrow('Deletion was cancelled');
  expect(deleteFile).not.toHaveBeenCalled();
  expect(records.get('lessons/lesson')).toMatchObject({ deleting: true, deletionToken: 'replacement-lock' });
});

it('two students plus the BOTH creator produce one canonical count across every lesson loader', async () => {
  const service = require('@/services/lessonService');
  await enrollInLesson(learner('teacher', 'both'), lesson);
  await enrollInLesson(learner('student-a'), lesson);
  await enrollInLesson(learner('student-b'), lesson);
  await enrollInLesson(learner('student-a'), lesson);
  const [detail, feed, created, enrolled] = await Promise.all([
    getLesson('lesson'), service.listLessons(), service.listLessonsByTeacher('teacher'), listLessonsByIds(['lesson']),
  ]);
  expect([detail, feed[0], created[0], enrolled[0]].map((row) => row?.enrollmentCount)).toEqual([3, 3, 3, 3]);
  expect([...records.keys()].filter((path) => path.startsWith('enrollments/'))).toHaveLength(3);
  put('users/teacher', { role: 'both' });
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('learners are currently enrolled');
});

it('a numeric aggregate does not depend on an extra migration version marker', async () => {
  const data = { ...records.get('lessons/lesson') };
  delete data.enrollmentCountVersion;
  put('lessons/lesson', data);
  await enrollInLesson(learner(), lesson);
  expect(records.get('lessons/lesson')?.enrollmentCount).toBe(1);
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('learners are currently enrolled');
});
