import { getDoc, getDocs, runTransaction } from 'firebase/firestore';
import { auth } from '@/firebase/config';
import { listEnrollmentsByUser, listLessonsByIds } from '@/services/lessonService';
import { getTeacherRoadmap, loadRoadmapDetail, loadRoadmaps, saveTeacherRoadmap } from '@/services/teacherRoadmapService';
import type { User } from '@/types';

jest.mock('@/firebase/config', () => ({ auth: { currentUser: { uid: 'teacher' } }, db: {} }));
jest.mock('@/services/lessonService', () => ({ listEnrollmentsByUser: jest.fn(), listLessonsByIds: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, path) => ({ path })),
  doc: jest.fn((dbOrCol, col, id) => id ? { path: `${col}/${id}`, id } : { path: `${dbOrCol.path}/new`, id: 'new' }),
  query: jest.fn((col, filter) => ({ col, filter })), where: jest.fn((field, op, value) => ({ field, op, value })),
  getDoc: jest.fn(), getDocs: jest.fn(), runTransaction: jest.fn(), serverTimestamp: jest.fn(() => 'timestamp'),
}));
type Data = Record<string, any>;
type Ref = { path: string; id: string };
let records: Map<string, Data>;
let versions: Map<string, number>;
let writes: string[];
const user = { uid: 'teacher', name: 'Teacher', role: 'teacher' } as User;
const input = { title: 'JS Path', careerGoalId: 'software-engineer' as const, skill: ' JavaScript ', description: '', lessonIds: ['a', 'b'] };
function put(path: string, value: Data) { records.set(path, value); versions.set(path, (versions.get(path) ?? 0) + 1); }
const snapshot = (ref: Ref) => {
  const value = records.get(ref.path);
  const copy = value ? JSON.parse(JSON.stringify(value)) : undefined;
  return { id: ref.id, exists: () => copy !== undefined, data: () => copy };
};
beforeEach(() => {
  jest.clearAllMocks(); records = new Map(); versions = new Map(); writes = [];
  (auth as any).currentUser = { uid: 'teacher' };
  put('users/teacher', { role: 'teacher', name: 'Teacher' });
  for (const id of ['a', 'b']) put(`lessons/${id}`, { id, teacherId: 'teacher', careerGoalId: 'software-engineer', published: true, enrollmentCount: 3 });
  (getDoc as jest.Mock).mockImplementation(async ref => snapshot(ref));
  (getDocs as jest.Mock).mockImplementation(async ({ col, filter }) => ({ docs: [...records]
    .filter(([path, value]) => path.startsWith(col.path + '/') && (filter.op === 'array-contains-any'
      ? value[filter.field].some((id: string) => filter.value.includes(id)) : value[filter.field] === filter.value))
    .map(([path]) => snapshot({ path, id: path.split('/')[1] })) }));
  (listLessonsByIds as jest.Mock).mockImplementation(async ids => [...new Set<string>(ids)].flatMap(id => records.has(`lessons/${id}`) ? [records.get(`lessons/${id}`)] : []));
  (listEnrollmentsByUser as jest.Mock).mockResolvedValue([]);
  (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const reads = new Map<string, number>(); const pending: (() => void)[] = [];
      const result = await callback({
        get: async (ref: Ref) => { reads.set(ref.path, versions.get(ref.path) ?? 0); return snapshot(ref); },
        set: (ref: Ref, value: Data) => pending.push(() => { writes.push(ref.path); put(ref.path, value); }),
      });
      if ([...reads].some(([path, version]) => (versions.get(path) ?? 0) !== version)) continue;
      pending.forEach(write => write()); return result;
    }
    throw new Error('Too many retries');
  });
});
it.each(['teacher', 'both'] as const)('%s creates and edits owned roadmaps with stable IDs and lesson order', async role => {
  put('users/teacher', { role, name: 'Teacher' });
  const id = await saveTeacherRoadmap({ ...user, role }, input);
  expect(await getTeacherRoadmap(id)).toMatchObject({ teacherId: 'teacher', lessonIds: ['a', 'b'], skill: 'JavaScript', skillKey: 'javascript', revision: 0 });
  await saveTeacherRoadmap({ ...user, role }, { ...input, lessonIds: ['b', 'a'] }, id, 0);
  expect(await getTeacherRoadmap(id)).toMatchObject({ lessonIds: ['b', 'a'], revision: 1 });
  expect(writes).toEqual(['teacherRoadmaps/new', 'teacherRoadmaps/new']);
  expect(records.get('lessons/a')?.enrollmentCount).toBe(3);
});
it('rejects student-only creation, impersonation and revoked teaching roles', async () => {
  await expect(saveTeacherRoadmap({ ...user, role: 'learner' }, input)).rejects.toThrow('Only Teacher');
  await expect(saveTeacherRoadmap({ ...user, uid: 'other' }, input)).rejects.toThrow('Sign in');
  put('users/teacher', { role: 'learner' });
  await expect(saveTeacherRoadmap(user, input)).rejects.toThrow('Only Teacher');
  expect(writes).toEqual([]);
});
it.each([
  [{ teacherId: 'other' }, 'only add lessons'],
  [{ careerGoalId: 'cloud-engineer' }, 'match the roadmap'],
  [{ deleting: true }, 'unavailable'],
  [{ published: false }, 'unavailable'],
])('validates current selected lesson data in the transaction %#', async (patch, message) => {
  put('lessons/b', { ...records.get('lessons/b'), ...patch });
  await expect(saveTeacherRoadmap(user, input)).rejects.toThrow(message as string);
  expect(writes).toEqual([]);
});
it('rejects editing another teacher roadmap and deleted lesson references', async () => {
  put('teacherRoadmaps/foreign', { teacherId: 'other', revision: 0 });
  await expect(saveTeacherRoadmap(user, input, 'foreign', 0)).rejects.toThrow('Only the roadmap creator');
  records.delete('lessons/a');
  await expect(saveTeacherRoadmap(user, input)).rejects.toThrow('unavailable');
});
it('rejects a career-goal change unless every selected lesson matches the new goal', async () => {
  const id = await saveTeacherRoadmap(user, input);
  await expect(saveTeacherRoadmap(user, { ...input, careerGoalId: 'cloud-engineer' }, id, 0)).rejects.toThrow('match');
  expect((await getTeacherRoadmap(id))?.careerGoalId).toBe('software-engineer');
});
it('prevents lost edits when concurrent writers use the same revision', async () => {
  const id = await saveTeacherRoadmap(user, input);
  const results = await Promise.allSettled([
    saveTeacherRoadmap(user, { ...input, title: 'First edit' }, id, 0),
    saveTeacherRoadmap(user, { ...input, title: 'Second edit' }, id, 0),
  ]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
});
it.each(['learner', 'both'] as const)('%s discovers only relevant roadmaps, including legitimate self-enrollment', async role => {
  await saveTeacherRoadmap(user, input);
  put('teacherRoadmaps/irrelevant', { ...records.get('teacherRoadmaps/new'), lessonIds: ['z'] });
  (listEnrollmentsByUser as jest.Mock).mockResolvedValue([{ lessonId: 'a', completed: true, progress: 100 }]);
  const result = await loadRoadmaps({ ...user, role }, 'learn');
  expect(result.roadmaps.map(row => row.id)).toEqual(['new']);
  expect(listEnrollmentsByUser).toHaveBeenCalledTimes(1);
  expect(listLessonsByIds).toHaveBeenCalledTimes(1);
  expect(writes).toEqual(['teacherRoadmaps/new']);
  expect(records.get('lessons/a')?.enrollmentCount).toBe(3);
});
it('batches membership queries in groups of 30 and deduplicates shared roadmaps and lesson reads', async () => {
  await saveTeacherRoadmap(user, input);
  (listEnrollmentsByUser as jest.Mock).mockResolvedValue(Array.from({ length: 61 }, (_, i) => ({ lessonId: i === 0 ? 'a' : i === 31 ? 'b' : `id${i}` })));
  const result = await loadRoadmaps({ ...user, role: 'learner' }, 'learn');
  expect(getDocs).toHaveBeenCalledTimes(3);
  expect(result.roadmaps).toHaveLength(1);
  expect(listLessonsByIds).toHaveBeenCalledWith(['a', 'b']);
});
it('does not scan all roadmaps when the learner has no enrollments', async () => {
  expect((await loadRoadmaps({ ...user, role: 'learner' }, 'learn')).roadmaps).toEqual([]);
  expect(getDocs).not.toHaveBeenCalled();
});
it('guards direct links and keeps teaching views separate from self-enrolled learner views', async () => {
  await saveTeacherRoadmap(user, input);
  await expect(loadRoadmapDetail({ ...user, role: 'learner' }, 'new', 'learn')).rejects.toThrow('Enroll');
  await expect(loadRoadmapDetail({ ...user, role: 'learner' }, 'new', 'teach')).rejects.toThrow('creator');
  await expect(loadRoadmaps(user, 'learn')).rejects.toThrow('Teach & learn');
  const result = await loadRoadmapDetail(user, 'new', 'teach');
  expect(result.enrollments).toEqual([]);
  expect((await loadRoadmaps(user, 'teach')).roadmaps).toHaveLength(1);
});
