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
import { createLesson, deleteLesson, enrollInLesson, getLesson, listLessonsByIds, updateLesson, toggleLessonContentDone, submitLessonAnswer, retryLessonQuiz, refreshLessonProgress, markLessonCompleted, getEnrollment } from '@/services/lessonService';
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

it.each([0, -1])('undoing completion cannot decrement legacy counters at %s below zero', async count => {
  put('users/learner', { stats: { lessonsCompleted: count } });
  put('lessons/lesson', { ...records.get('lessons/lesson'), completeCount: count,
    contents: [{ id: 'pdf', type: 'pdf' }] });
  await enrollInLesson(learner(), lesson);
  put('enrollments/learner_lesson', { ...records.get('enrollments/learner_lesson'), completed: true,
    progress: 100, completedContentIds: ['pdf'] });
  await toggleLessonContentDone(learner(), lesson, 'pdf');
  expect(records.get('lessons/lesson')?.completeCount).toBe(0);
  expect(records.get('users/learner')?.['stats.lessonsCompleted']).toBe(0);
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
it('blocks enrollment until a legacy lesson count has been backfilled', async () => {
  const data = { ...records.get('lessons/lesson') };
  delete data.enrollmentCount; delete data.enrollmentCountVersion;
  put('lessons/lesson', data);
  expect((await getLesson('lesson'))?.enrollmentCount).toBeUndefined();
  await expect(enrollInLesson(learner(), lesson)).rejects.toThrow('being upgraded');
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('being upgraded');
  expect(records.get('lessons/lesson')).toMatchObject({ published: true, deleting: false });
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
  (auth as any).currentUser = { uid: 'learner' };
  put('users/learner', { role: 'learner' });
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

it('does not trust a numeric aggregate without the migration version marker', async () => {
  const data = { ...records.get('lessons/lesson') };
  delete data.enrollmentCountVersion;
  put('lessons/lesson', data);
  expect((await getLesson('lesson'))?.enrollmentCount).toBeUndefined();
  await expect(enrollInLesson(learner(), lesson)).rejects.toThrow('being upgraded');
});

const question = (id: string, answerIndex = 1) => ({ id, q: 'What is Git?', options: ['Database', 'Version control', 'Video', 'Design'], answerIndex });
const validInput = (quiz: any[], quizRevision = 0) => ({ ...input, careerGoalId: require('@/constants/careerGoals').CAREER_GOALS[0].tag, quiz, quizRevision });
async function startLearning(uid = 'learner', role = 'learner', count = 3) {
  put('lessons/lesson', { ...records.get('lessons/lesson'), contents: [
    { id: 'video', type: 'youtube', videoId: 'dQw4w9WgXcQ' }, { id: 'pdf', type: 'pdf' },
  ], quiz: Array.from({ length: count }, (_, i) => question('q' + i)), completeCount: 0 });
  (auth as any).currentUser = { uid };
  put('users/' + uid, { role });
  const user = learner(uid, role);
  await enrollInLesson(user, lesson);
  return user;
}
it.each(['teacher', 'both'])('%s creates ten, edits stable IDs, deletes and replaces questions without changing enrollments', async role => {
  put('users/teacher', { role });
  const user = { ...teacher, role } as User;
  const questions = Array.from({ length: 10 }, (_, i) => question('q' + i));
  const id = await createLesson(user, validInput(questions));
  expect((await getLesson(id))?.quiz).toHaveLength(10);
  await expect(updateLesson(user, id, validInput([...questions, question('q10')]))).rejects.toThrow('Maximum 10');
  questions[3] = { ...questions[3], q: 'Edited question' };
  await updateLesson(user, id, validInput(questions));
  expect((await getLesson(id))?.quiz[3]).toMatchObject({ id: 'q3', q: 'Edited question' });
  await updateLesson(user, id, validInput(questions.filter(q => q.id !== 'q6'), 1));
  expect((await getLesson(id))?.quiz).toHaveLength(9);
  await updateLesson(user, id, validInput([...questions.filter(q => q.id !== 'q6'), question('new')], 2));
  expect((await getLesson(id))?.quiz).toHaveLength(10);
  expect(records.get('lessons/' + id)?.enrollmentCount).toBe(0);
});
it('concurrent saves at nine questions cannot exceed ten or silently overwrite a question', async () => {
  const questions = Array.from({ length: 9 }, (_, i) => question('q' + i));
  const id = await createLesson(teacher, validInput(questions));
  const results = await Promise.allSettled([
    updateLesson(teacher, id, validInput([...questions, question('a')])),
    updateLesson(teacher, id, validInput([...questions, question('b')])),
  ]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await getLesson(id))?.quiz).toHaveLength(10);
});
it('lesson-only edits preserve existing quiz', async () => {
  const id = await createLesson(teacher, validInput([question('stable')]));
  await updateLesson(teacher, id, { ...input, careerGoalId: require('@/constants/careerGoals').CAREER_GOALS[0].tag });
  expect((await getLesson(id))?.quiz[0].id).toBe('stable');
});
it('does not advance the quiz revision when a form save leaves the quiz unchanged', async () => {
  const quiz = [question('stable')];
  const id = await createLesson(teacher, validInput(quiz));
  await updateLesson(teacher, id, { ...validInput(quiz), description: 'Updated description' });
  expect(await getLesson(id)).toMatchObject({ description: 'Updated description', quizRevision: 0 });
  await updateLesson(teacher, id, validInput([{ ...quiz[0], q: 'Changed question' }]));
  expect((await getLesson(id))?.quizRevision).toBe(1);
});
it('rejects learner-only, foreign-owner and stale-role question management', async () => {
  await expect(updateLesson(learner('teacher'), 'lesson', validInput([question('q')]))).rejects.toThrow('Only teachers');
  put('lessons/lesson', { ...records.get('lessons/lesson'), teacherId: 'someone-else' });
  await expect(updateLesson(teacher, 'lesson', validInput([question('q')]))).rejects.toThrow('Only the teacher');
  put('lessons/lesson', { ...records.get('lessons/lesson'), teacherId: 'teacher' });
  put('users/teacher', { role: 'learner' });
  await expect(updateLesson(teacher, 'lesson', validInput([question('q')]))).rejects.toThrow('Only teachers');
});
it.each([['learner', 'learner'], ['teacher', 'both']])('%s/%s completes 1 video + 1 PDF + 3 questions only after every activity', async (uid, role) => {
  const user = await startLearning(uid, role);
  await expect(markLessonCompleted(user, lesson)).rejects.toThrow('Complete all');
  expect((await toggleLessonContentDone(user, lesson, 'video')).progress).toBe(20);
  expect((await toggleLessonContentDone(user, lesson, 'pdf')).progress).toBe(40);
  expect((await submitLessonAnswer(user, 'lesson', 'q0', 0)).progress).toBe(60);
  expect((await submitLessonAnswer(user, 'lesson', 'q1', 1)).completed).toBe(false);
  const result = await submitLessonAnswer(user, 'lesson', 'q2', 1);
  expect(result).toMatchObject({ completed: true, progress: 100 });
  expect(result.quizAnswers?.q0).toMatchObject({ submitted: true, correct: false, selectedIndex: 0, answerIndex: 1 });
  expect(records.get('lessonProgress/' + uid + '_lesson')).toMatchObject({ quizScore: 67, quizAttempts: 3, status: 'completed' });
  expect(await getEnrollment(uid, 'lesson')).toMatchObject({ progress: 100, quizAnswers: result.quizAnswers });
  await refreshLessonProgress(user, 'lesson');
  expect(records.get('lessons/lesson')).toMatchObject({ enrollmentCount: 1, completeCount: 1 });
  expect((await toggleLessonContentDone(user, lesson, 'video')).completed).toBe(false);
  expect(records.get('lessons/lesson')?.completeCount).toBe(0);
});
it('all wrong answers fail the quiz and a retry can earn lesson completion', async () => {
  const user = await startLearning();
  await toggleLessonContentDone(user, lesson, 'pdf');
  for (let i = 0; i < 3; i++) await submitLessonAnswer(user, 'lesson', 'q' + i, 0);
  expect(await refreshLessonProgress(user, 'lesson')).toMatchObject({ completed: false, progress: 80 });
  expect(await toggleLessonContentDone(user, lesson, 'video')).toMatchObject({ completed: false, progress: 99 });
  expect(records.get('lessonProgress/learner_lesson')?.quizScore).toBe(0);
  expect(records.get('lessons/lesson')?.completeCount).toBe(0);
  expect(await retryLessonQuiz(user, 'lesson')).toMatchObject({ completed: false, progress: 40, quizAnswers: {} });
  await submitLessonAnswer(user, 'lesson', 'q0', 1);
  await submitLessonAnswer(user, 'lesson', 'q1', 1);
  expect(await submitLessonAnswer(user, 'lesson', 'q2', 0)).toMatchObject({ completed: true, progress: 100 });
  expect(records.get('lessons/lesson')?.completeCount).toBe(1);
});
it('zero MCQs require only the current materials', async () => {
  const user = await startLearning('learner', 'learner', 0);
  await toggleLessonContentDone(user, lesson, 'video');
  expect(await toggleLessonContentDone(user, lesson, 'pdf')).toMatchObject({ completed: true, progress: 100 });
});
it('concurrent answers persist without lost submissions or repeated completion awards', async () => {
  const user = await startLearning();
  await toggleLessonContentDone(user, lesson, 'video');
  await toggleLessonContentDone(user, lesson, 'pdf');
  await Promise.all([0, 1, 2].map(i => submitLessonAnswer(user, 'lesson', 'q' + i, i === 0 ? 0 : 1)));
  await Promise.all([0, 1, 2].map(i => submitLessonAnswer(user, 'lesson', 'q' + i, i === 0 ? 1 : 0)));
  expect(await getEnrollment(user.uid, 'lesson')).toMatchObject({ completed: true, progress: 100 });
  expect(records.get('lessonProgress/learner_lesson')?.quizScore).toBe(67);
  expect(records.get('lessons/lesson')?.completeCount).toBe(1);
});
it('edited questions retain historical feedback; deleted questions stop blocking and added questions reopen completion', async () => {
  const user = await startLearning();
  await toggleLessonContentDone(user, lesson, 'video');
  await toggleLessonContentDone(user, lesson, 'pdf');
  await submitLessonAnswer(user, 'lesson', 'q0', 1);
  await submitLessonAnswer(user, 'lesson', 'q1', 1);
  put('lessons/lesson', { ...records.get('lessons/lesson'), quiz: [question('q0', 0), question('q1')] });
  const result = await refreshLessonProgress(user, 'lesson');
  expect(result).toMatchObject({ completed: true, progress: 100 });
  expect(result.quizAnswers?.q0).toMatchObject({ correct: true, answerIndex: 1 });
  put('lessons/lesson', { ...records.get('lessons/lesson'), quiz: [question('q0', 0), question('q1'), question('new')] });
  expect(await refreshLessonProgress(user, 'lesson')).toMatchObject({ completed: false, progress: 80 });
  expect(records.get('lessons/lesson')?.enrollmentCount).toBe(1);
});
it('requires enrollment even for owners, rejects teacher-only learning and invalid answers', async () => {
  const user = await startLearning();
  await expect(submitLessonAnswer(user, 'lesson', 'q0', -1)).rejects.toThrow('select one');
  await expect(submitLessonAnswer(user, 'lesson', 'deleted', 0)).rejects.toThrow('no longer part');
  (auth as any).currentUser = { uid: 'teacher' };
  await expect(submitLessonAnswer(teacher, 'lesson', 'q0', 0)).rejects.toThrow('learner');
  put('users/teacher', { role: 'both' });
  await expect(submitLessonAnswer(learner('teacher', 'both'), 'lesson', 'q0', 0)).rejects.toThrow('Enroll');
});

it('rejects submitting an answer against a question revision the learner has not seen', async () => {
  const user = await startLearning();
  put('lessons/lesson', { ...records.get('lessons/lesson'), quizRevision: 1 });
  await expect(submitLessonAnswer(user, 'lesson', 'q0', 0, 0)).rejects.toThrow('questions have changed');
  expect((await getEnrollment(user.uid, 'lesson'))?.quizAnswers).toEqual({});
});
it('BOTH creator manages questions after self-enrollment without altering attempts, materials, or enrollment count', async () => {
  const user = { ...teacher, role: 'both' } as User;
  put('users/teacher', { role: 'both' });
  const id = await createLesson(user, validInput([question('q0'), question('q1')]));
  const created = (await getLesson(id))!;
  await enrollInLesson(user, created);
  await toggleLessonContentDone(user, created, created.contents[0].id);
  await submitLessonAnswer(user, id, 'q0', 1);
  const stored = (await getEnrollment(user.uid, id))!;
  await updateLesson(user, id, { ...validInput([{ ...question('q0', 0), q: 'Edited' }]),
    contents: created.contents.map(item => ({ ...item, type: 'youtube' as const, url: 'https://youtu.be/dQw4w9WgXcQ' })) });
  const updated = (await getLesson(id))!;
  expect(updated.contents).toEqual(created.contents);
  expect(updated.enrollmentCount).toBe(1);
  expect((await getEnrollment(user.uid, id))?.quizAnswers).toEqual(stored.quizAnswers);
  expect(await refreshLessonProgress(user, id)).toMatchObject({ completed: true, progress: 100 });
  expect(records.get('lessonProgress/teacher_' + id)?.quizScore).toBe(100);
});
