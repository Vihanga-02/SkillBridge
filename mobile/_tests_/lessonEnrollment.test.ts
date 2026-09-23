jest.mock('@/firebase/config', () => ({ auth: { currentUser: { uid: 'learner' } }, db: {}, functions: {} }));
jest.mock('@/utils/storage', () => ({ deleteFile: jest.fn(), sanitizeStorageName: jest.fn(), uploadFile: jest.fn() }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => name), doc: jest.fn((_db, col, id) => ({ path: col + '/' + id })),
  onSnapshot: jest.fn(), getDocs: jest.fn(), runTransaction: jest.fn(),
}));
import { onSnapshot, getDocs, runTransaction } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth } from '@/firebase/config';
import { deleteLesson, enrollInLesson, subscribeToLesson } from '@/services/lessonService';
const call = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (httpsCallable as jest.Mock).mockReturnValue(call);
  call.mockReset().mockResolvedValue({ data: {} });
  (auth as any).currentUser = { uid: 'learner' };
});
it.each([undefined, 0, 2])('reads aggregate %s only from the lesson document', (count) => {
  const stop = jest.fn(), value = jest.fn();
  (onSnapshot as jest.Mock).mockImplementation((ref, next) => {
    expect(ref.path).toBe('lessons/lesson');
    next({ exists: () => true, id: 'lesson', data: () => ({ enrollmentCount: count }) });
    return stop;
  });
  expect(subscribeToLesson('lesson', value, jest.fn())).toBe(stop);
  expect(value.mock.calls[0][0].enrollmentCount).toBe(count ?? 0);
  expect(getDocs).not.toHaveBeenCalled();
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
it('propagates listener errors and missing lessons', () => {
  const value = jest.fn(), error = jest.fn(), denied = new Error('permission-denied');
  (onSnapshot as jest.Mock).mockImplementation((_ref, next, fail) => {
    next({ exists: () => false }); fail(denied);
  });
  subscribeToLesson('lesson', value, error);
  expect(value).toHaveBeenCalledWith(null);
  expect(error).toHaveBeenCalledWith(denied);
});
