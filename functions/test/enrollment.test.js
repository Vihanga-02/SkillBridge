const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createOperations } = require('../enrollment');

// A serialized, atomic in-memory adapter tests business behavior. Real Firestore
// retries and authorization need the separate emulator suite.
function setup(lesson = {}) {
  const data = new Map(Object.entries({
    'lessons/l': { teacherId: 't', published: true, contents: [], enrollmentCount: 0, ...lesson },
    'users/t': { role: 'teacher' }, 'users/a': { role: 'learner' }, 'users/b': { role: 'both' },
  }));
  const removedFiles = [];
  const ref = (path) => ({ path, id: path.split('/').at(-1), delete: async () => data.delete(path) });
  const snapshot = (path) => ({ ref: ref(path), id: ref(path).id, exists: data.has(path), data: () => data.get(path) });
  const query = (collection, field, value, limit = Infinity) => ({
    collection, field, value, max: limit,
    limit: (n) => query(collection, field, value, n),
    get: async () => read(query(collection, field, value, limit)),
  });
  function read(target) {
    if (target.path) return snapshot(target.path);
    const docs = [...data.keys()].filter((path) => path.startsWith(target.collection + '/') &&
      data.get(path)[target.field] === target.value).slice(0, target.max).map(snapshot);
    return { docs, empty: docs.length === 0 };
  }
  let queue = Promise.resolve();
  const db = {
    doc: ref,
    collection: (name) => ({ where: (field, _op, value) => query(name, field, value) }),
    runTransaction: (action) => {
      const result = queue.then(async () => {
        const writes = [];
        const tx = { get: async (target) => read(target) };
        for (const method of ['update', 'create', 'set']) tx[method] = (target, value) => writes.push([target.path, value]);
        const result = await action(tx);
        for (const [path, value] of writes) {
          const old = data.get(path) ?? {};
          const next = Object.fromEntries(Object.entries(value).map(([key, v]) =>
            [key, v?.increment !== undefined ? (old[key] ?? 0) + v.increment : v]));
          data.set(path, { ...old, ...next });
        }
        return result;
      });
      queue = result.catch(() => {});
      return result;
    },
    batch: () => {
      const paths = [];
      return { delete: (ref) => paths.push(ref.path), commit: async () => paths.forEach((path) => data.delete(path)) };
    },
  };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const ops = createOperations(db, { increment: (n) => ({ increment: n }), serverTimestamp: () => 'now' },
    HttpsError, () => ({ file: (path) => ({ delete: async () => removedFiles.push(path) }) }));
  return { ...ops, data, db, removedFiles };
}
const request = (uid) => ({ auth: { uid }, data: { lessonId: 'l' } });
test('two learners and concurrent duplicate calls produce exactly two enrollments', async () => {
  const s = setup();
  await Promise.all([s.enrollLesson(request('a')), s.enrollLesson(request('b')), s.enrollLesson(request('a'))]);
  assert.equal(s.data.get('lessons/l').enrollmentCount, 2);
  assert.equal([...s.data.keys()].filter((p) => p.startsWith('enrollments/')).length, 2);
  s.data.get('enrollments/a_l').progress = 50;
  await s.enrollLesson(request('a'));
  assert.equal(s.data.get('enrollments/a_l').progress, 50);
});
test('legacy IDs prevent duplicates and missing counts are reconciled on enrollment', async () => {
  const s = setup({ enrollmentCount: undefined });
  s.data.set('enrollments/legacy', { userId: 'a', lessonId: 'l' });
  await s.enrollLesson(request('a'));
  assert.equal(s.data.has('enrollments/a_l'), false);
  await s.enrollLesson(request('b'));
  assert.equal(s.data.get('lessons/l').enrollmentCount, 2);
});
test('actual records block deletion even with a stale zero counter', async () => {
  const s = setup();
  s.data.set('enrollments/legacy', { lessonId: 'l', active: false });
  await assert.rejects(s.deleteLesson(request('t')), /currently enrolled/);
  assert.equal(s.data.get('lessons/l').published, true);
  assert.deepEqual(s.removedFiles, []);
});
test('enrollment wins race: deletion is rejected', async () => {
  const s = setup();
  const results = await Promise.allSettled([s.enrollLesson(request('a')), s.deleteLesson(request('t'))]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.equal(s.data.get('lessons/l').enrollmentCount, 1);
});
test('deletion wins race: enrollment is rejected', async () => {
  const s = setup();
  const results = await Promise.allSettled([s.deleteLesson(request('t')), s.enrollLesson(request('a'))]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.equal(s.data.has('enrollments/a_l'), false);
});
test('deletion ignores inflated counts, removes progress and only exclusive PDFs', async () => {
  const s = setup({ enrollmentCount: 999, contents: [
    { type: 'pdf', filePath: 'lesson-files/t/title-l/a.pdf' },
    { type: 'pdf', filePath: 'lesson-files/t/other-x/a.pdf' },
  ] });
  s.data.set('lessonProgress/a_l', { lessonId: 'l' });
  await s.deleteLesson(request('t'));
  assert.equal(s.data.has('lessons/l'), false);
  assert.equal(s.data.has('lessonProgress/a_l'), false);
  assert.deepEqual(s.removedFiles, ['lesson-files/t/title-l/a.pdf']);
});
test('auth, server role, ownership and locked lessons are enforced', async () => {
  const s = setup();
  await assert.rejects(s.enrollLesson({ data: { lessonId: 'l' } }), /Sign in/);
  await assert.rejects(s.enrollLesson(request('t')), /learner role/);
  await assert.rejects(s.deleteLesson(request('b')), /Only the teacher/);
  s.data.get('lessons/l').deleting = true;
  await assert.rejects(s.enrollLesson(request('a')), /no longer available/);
});
test('migration counts legacy learners once, reruns safely and serializes enrollment', async () => {
  const s = setup({ enrollmentCount: undefined });
  s.data.set('enrollments/old1', { userId: 'a', lessonId: 'l' });
  s.data.set('enrollments/old2', { userId: 'a', lessonId: 'l' });
  await Promise.all([s.migrateLesson(s.db.doc('lessons/l')), s.enrollLesson(request('b'))]);
  await s.migrateLesson(s.db.doc('lessons/l'));
  assert.equal(s.data.get('lessons/l').enrollmentCount, 2);
});
