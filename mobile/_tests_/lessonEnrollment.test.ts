jest.mock('@/firebase/config', () => ({ auth: { currentUser: { uid: 'learner' } }, db: {}, functions: {} }));
jest.mock('@/utils/storage', () => ({ deleteFile: jest.fn(), sanitizeStorageName: jest.fn(), uploadFile: jest.fn() }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => name), doc: jest.fn((_db, col, id) => ({ path: col + '/' + id })),
  onSnapshot: jest.fn(), getDocs: jest.fn(), getDoc: jest.fn(), runTransaction: jest.fn(),
  query: jest.fn((...args) => args), where: jest.fn((...args) => args), orderBy: jest.fn(),
}));
import { onSnapshot, getDocs, getDoc, runTransaction } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth } from '@/firebase/config';
import { deleteLesson, enrollInLesson, listLessons, listEnrollmentIds, getEnrollment, listEnrollmentsByUser, toggleLessonContentDone, markLessonCompleted } from '@/services/lessonService';
const call = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (httpsCallable as jest.Mock).mockReturnValue(call);
  call.mockReset().mockResolvedValue({ data: {} });
  (auth as any).currentUser = { uid: 'learner' };
});
it('delegates enrollment to authenticated backend without client writes', async () => {
  await enrollInLesson({ uid: 'learner' } as any, { id: 'lesson', enrollmentCount: 999 } as any);
  expect(httpsCallable).toHaveBeenCalledWith({}, 'enrollLesson');
  expect(call).toHaveBeenCalledWith({ lessonId: 'lesson' });
  expect(runTransaction).not.toHaveBeenCalled();
});
it('delegates deletion and propagates backend rejection', async () => {
  call.mockRejectedValue(new Error('learners are currently enrolled'));
  await expect(deleteLesson('learner', 'lesson')).rejects.toThrow('learners are currently enrolled');
  expect(httpsCallable).toHaveBeenCalledWith({}, 'deleteLesson');
  expect(call).toHaveBeenCalledWith({ lessonId: 'lesson' });
  expect(getDocs).not.toHaveBeenCalled();
});
it('rejects impersonation before invoking either operation', async () => {
  await expect(deleteLesson('other', 'lesson')).rejects.toThrow('Sign in');
  await expect(enrollInLesson({ uid: 'other' } as any, { id: 'lesson' } as any)).rejects.toThrow('Sign in');
  expect(call).not.toHaveBeenCalled();
});
const row = (id: string, data: object) => ({ id, data: () => data });
it('excludes inactive history, duplicate cards and missing or inaccessible lessons', async () => {
  (getDocs as jest.Mock).mockResolvedValue({ docs: [
    row('a', { userId: 'learner', lessonId: 'live', status: 'active' }),
    row('dup', { userId: 'learner', lessonId: 'live' }),
    row('b', { lessonId: 'cancelled', status: 'cancelled' }),
    row('c', { lessonId: 'inactive', status: 'inactive' }),
    row('d', { lessonId: 'flag', active: false }),
    row('e', { lessonId: 'missing' }), row('f', { lessonId: 'private' }),
  ] });
  (getDoc as jest.Mock).mockImplementation(async (ref) => {
    if (ref.path === 'lessons/private') throw { code: 'permission-denied' };
    return { id: ref.path.split('/')[1], exists: () => ref.path !== 'lessons/missing', data: () => ({ published: true }) };
  });
  expect((await listEnrollmentsByUser('learner')).map((r) => r.lessonId)).toEqual(['live']);
  expect(getDocs).toHaveBeenCalledWith(expect.arrayContaining([['userId', '==', 'learner']]));
});
it.each(['cancelled', 'canceled', 'inactive', 'removed', 'unenrolled'])('details treats %s as not enrolled', async (status) => {
  (getDocs as jest.Mock).mockResolvedValue({ docs: [row('old', { lessonId: 'l', status })] });
  expect(await getEnrollment('learner', 'l')).toBeNull();
});
it('filters legacy records without timestamps and preserves network errors from lesson lookup', async () => {
  (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [row('old', { lessonId: 'l', active: false })] });
  expect(await listEnrollmentsByUser('learner')).toEqual([]);
  (getDocs as jest.Mock).mockResolvedValue({ docs: [row('a', { lessonId: 'l' })] });
  (getDoc as jest.Mock).mockRejectedValue(new Error('offline'));
  await expect(listEnrollmentsByUser('learner')).rejects.toThrow('offline');
});

it('both progress operations reject an enrollment cancelled after the initial lookup', async () => {
  (getDocs as jest.Mock).mockResolvedValue({ docs: [row('legacy', { lessonId: 'l', userId: 'learner' })] });
  const update = jest.fn();
  (runTransaction as jest.Mock).mockImplementation(async (_db, action) => action({
    get: async (ref: { path: string }) => ({ exists: () => true, id: 'l', data: () =>
      ref.path.startsWith('enrollments/') ? { status: 'cancelled' } : { published: true, teacherId: 't', contents: [] } }),
    update, set: update,
  }));
  const user = { uid: 'learner' } as any, lesson = { id: 'l' } as any;
  await expect(toggleLessonContentDone(user, lesson, 'content')).rejects.toThrow('Enroll in this lesson');
  await expect(markLessonCompleted(user, lesson)).rejects.toThrow('Enroll in this lesson');
  expect(update).not.toHaveBeenCalled();
});

it('loads 100 counts with the existing lesson query and no per-lesson calls', async () => {
  (getDocs as jest.Mock).mockResolvedValue({ docs: Array.from({ length: 100 }, (_, i) => row(String(i), { enrollmentCount: i })) });
  const lessons = await listLessons();
  expect(lessons).toHaveLength(100);
  expect(lessons[25].enrollmentCount).toBe(25);
  expect(getDocs).toHaveBeenCalledTimes(1);
  expect(getDoc).not.toHaveBeenCalled();
  expect(onSnapshot).not.toHaveBeenCalled();
});
it('feed enrollment IDs query only own records without loading each lesson again', async () => {
  (getDocs as jest.Mock).mockResolvedValue({ docs: [row('a', { lessonId: 'l' }), row('b', { lessonId: 'inactive', active: false })] });
  expect(await listEnrollmentIds('learner')).toEqual(new Set(['l']));
  expect(getDocs).toHaveBeenCalledTimes(1);
  expect(getDoc).not.toHaveBeenCalled();
  expect(onSnapshot).not.toHaveBeenCalled();
});
