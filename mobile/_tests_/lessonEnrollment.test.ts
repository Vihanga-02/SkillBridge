jest.mock('@/firebase/config', () => ({ auth: { currentUser: { uid: 'teacher' } }, db: {} }));
jest.mock('@/utils/storage', () => ({ deleteFile: jest.fn(), sanitizeStorageName: jest.fn(), uploadFile: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => name), doc: jest.fn((_db, col, id) => ({ path: col + '/' + id })),
  query: jest.fn((...args) => args), where: jest.fn(), getDocsFromServer: jest.fn(),
  runTransaction: jest.fn(), updateDoc: jest.fn(), deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(), writeBatch: jest.fn(),
}));
import { getDocsFromServer, runTransaction, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { auth } from '@/firebase/config';
import { countEnrolledUsers, deleteLesson, enrollInLesson } from '@/services/lessonService';
import { deleteFile } from '@/utils/storage';
const queryMock = getDocsFromServer as jest.Mock;
const txMock = runTransaction as jest.Mock;
const rows = (users: string[]) => ({ docs: users.map(userId => ({ data: () => ({ userId }) })) });
let role: string;
let owner: string;
let txUpdate: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  role = 'teacher'; owner = 'teacher'; txUpdate = jest.fn();
  (auth as any).currentUser = { uid: 'teacher' };
  txMock.mockImplementation(async (_db, action) => action({
    get: async (ref: { path: string }) => ({ exists: () => true, id: 'lesson', data: () =>
      ref.path.startsWith('users/') ? { role } : {
        teacherId: owner, published: true, contents: [
          { id: 'pdf', type: 'pdf', filePath: 'lesson-files/teacher/title-lesson/file.pdf' },
          { id: 'shared', type: 'pdf', filePath: 'lesson-files/teacher/other-lesson2/file.pdf' },
        ],
      } }),
    update: txUpdate,
  }));
  (writeBatch as jest.Mock).mockReturnValue({ delete: jest.fn(), commit: jest.fn() });
});
it('counts unique active users, including completed learners and enrolled creators', () => {
  expect(countEnrolledUsers([
    { userId: 'a' }, { userId: 'a' }, { userId: 'b', completed: true },
    { userId: 'teacher' }, { userId: 'c', status: 'cancelled' },
    { userId: 'd', active: false }, {},
  ])).toBe(3);
  expect(countEnrolledUsers([])).toBe(0);
});
it.each([1, 2])('rejects direct deletion with %i enrollments before touching lesson or files', async (count) => {
  queryMock.mockResolvedValueOnce(rows(['a', 'b'].slice(0, count)));
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('learners are currently enrolled');
  expect(txMock).not.toHaveBeenCalled();
  expect(updateDoc).not.toHaveBeenCalled();
  expect(deleteFile).not.toHaveBeenCalled();
  expect(deleteDoc).not.toHaveBeenCalled();
});
it('catches an enrollment racing the initial check and releases the lock without cleanup', async () => {
  queryMock.mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows(['new']));
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('learners are currently enrolled');
  expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { deleting: false });
  expect(deleteFile).not.toHaveBeenCalled();
  expect(deleteDoc).not.toHaveBeenCalled();
});
it.each(['teacher', 'both'])('allows a zero-enrollment owner with role %s and only cleans exclusive files', async (value) => {
  role = value;
  queryMock.mockResolvedValue(rows([]));
  await deleteLesson('teacher', 'lesson');
  expect(deleteDoc).toHaveBeenCalledTimes(1);
  expect(deleteFile).toHaveBeenCalledTimes(1);
  expect(deleteFile).toHaveBeenCalledWith('lesson-files/teacher/title-lesson/file.pdf');
});
it('rejects nonowners and learners', async () => {
  queryMock.mockResolvedValue(rows([])); owner = 'someone-else';
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('Only the teacher');
  owner = 'teacher'; role = 'learner';
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('Only the teacher');
  expect(deleteFile).not.toHaveBeenCalled();
});
it('fails closed when the server cannot verify enrollments', async () => {
  queryMock.mockRejectedValueOnce(new Error('offline'));
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('offline');
  expect(deleteDoc).not.toHaveBeenCalled();
});
it('rejects an impersonated creator ID', async () => {
  await expect(deleteLesson('other', 'lesson')).rejects.toThrow('Sign in');
  expect(queryMock).not.toHaveBeenCalled();
});

it('rejects enrollment after the deletion lock is acquired', async () => {
  const set = jest.fn();
  txMock.mockImplementationOnce(async (_db, action) => action({
    get: async (ref: { path: string }) => ({
      exists: () => ref.path.startsWith('lessons/'),
      data: () => ({ published: true, deleting: true }),
    }), set,
  }));
  await expect(enrollInLesson({ uid: 'a', role: 'learner' } as any, { id: 'lesson' } as any))
    .rejects.toThrow('no longer available');
  expect(set).not.toHaveBeenCalled();
});
it('does not write a duplicate enrollment or reset existing progress', async () => {
  const set = jest.fn();
  txMock.mockImplementationOnce(async (_db, action) => action({
    get: async () => ({ exists: () => true }), set,
  }));
  await enrollInLesson({ uid: 'a', role: 'learner' } as any, { id: 'lesson' } as any);
  expect(set).not.toHaveBeenCalled();
});
it('releases the lock if the second server check fails', async () => {
  queryMock.mockResolvedValueOnce(rows([])).mockRejectedValueOnce(new Error('offline'));
  await expect(deleteLesson('teacher', 'lesson')).rejects.toThrow('offline');
  expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { deleting: false });
  expect(deleteFile).not.toHaveBeenCalled();
});
