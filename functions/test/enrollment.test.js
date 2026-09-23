const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createOperations } = require('../enrollment');

// A serialized, atomic in-memory adapter tests business behavior. Real Firestore
// retries and authorization need the separate emulator suite.
function setup(lesson = {}, hooks = {}) {
  const data = new Map(Object.entries({
    'lessons/l': { teacherId: 't', published: true, contents: [], enrollmentCount: 0, ...lesson },
    'users/t': { role: 'teacher' }, 'users/a': { role: 'learner' }, 'users/b': { role: 'both' },
  }));
  const removedFiles = [];
  const files = new Set((lesson.contents ?? []).map((item) => item.filePath).filter(Boolean));
  const ref = (path) => ({ path, id: path.split('/').at(-1), delete: async () => data.delete(path) });
  const snapshot = (path) => ({ ref: ref(path), id: ref(path).id, exists: data.has(path), data: () => data.get(path) });
  const query = (collection, field, value, limit = Infinity) => ({
    collection, field, value, max: limit,
    limit: (n) => query(collection, field, value, n),
    get: async () => {
      await hooks.beforeQuery?.(collection);
      return read(query(collection, field, value, limit));
    },
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
        tx.delete = (target) => writes.push([target.path, null]);
        for (const method of ['update', 'create', 'set']) tx[method] = (target, value) => writes.push([target.path, value]);
        const result = await action(tx);
        await hooks.beforeCommit?.(writes);
        for (const [path, value] of writes) {
          if (value === null) { data.delete(path); continue; }
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
      return { delete: (ref) => paths.push(ref.path), commit: async () => {
        await hooks.beforeBatch?.(paths);
        paths.forEach((path) => data.delete(path));
      } };
    },
  };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const ops = createOperations(db, { increment: (n) => ({ increment: n }), serverTimestamp: () => 'now' },
    HttpsError, () => ({ getMetadata: async () => { await hooks.beforeBucket?.(); }, file: (path) => ({ delete: async () => {
      await hooks.beforeFile?.(path);
      if (!files.has(path)) {
        throw Object.assign(new Error('Object not found'), { code: 404 });
      }
      files.delete(path);
      removedFiles.push(path);
    } }) }));
  return { ...ops, data, db, removedFiles, files };
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
  s.data.set('enrollments/legacy', { lessonId: 'l', status: 'active' });
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

const pdf = (name) => ({ type: 'pdf', filePath: `lesson-files/t/title-l/${name}.pdf` });
test('partial PDF deletion resumes after network failure and missing files are ignored', async () => {
  const hooks = { beforeFile: (path) => { if (path.endsWith('/c.pdf')) throw new Error('network'); } };
  const s = setup({ contents: [pdf('a'), pdf('b'), pdf('c')] }, hooks);
  s.data.set('lessonProgress/a_l', { lessonId: 'l' });
  await assert.rejects(s.deleteLesson(request('t')), /network/);
  assert.equal(s.data.get('lessons/l').deleting, true);
  assert.equal(s.data.get('lessons/l').published, false);
  assert.equal(s.data.has('lessonProgress/a_l'), false);
  assert.deepEqual(s.removedFiles, [pdf('a').filePath, pdf('b').filePath]);
  delete hooks.beforeFile;
  await s.deleteLesson(request('t'));
  await s.deleteLesson(request('t')); // Lost success response / already gone.
  assert.equal(s.data.has('lessons/l'), false);
  assert.equal(s.files.size, 0);
});
test('a failed later progress batch leaves only remaining records for retry', async () => {
  let batches = 0;
  const hooks = { beforeBatch: () => { if (++batches === 2) throw new Error('batch unavailable'); } };
  const s = setup({}, hooks);
  for (let i = 0; i < 501; i++) s.data.set(`lessonProgress/${i}`, { lessonId: 'l' });
  await assert.rejects(s.deleteLesson(request('t')), /batch unavailable/);
  assert.equal([...s.data.keys()].filter((p) => p.startsWith('lessonProgress/')).length, 1);
  delete hooks.beforeBatch;
  await s.deleteLesson(request('t'));
  assert.equal([...s.data.keys()].filter((p) => p.startsWith('lessonProgress/')).length, 0);
  assert.equal(s.data.has('lessons/l'), false);
});
test('progress query failure and final commit failure are recoverable', async () => {
  const hooks = { beforeQuery: () => { throw new Error('query unavailable'); } };
  const s = setup({ contents: [pdf('a')] }, hooks);
  await assert.rejects(s.deleteLesson(request('t')), /query unavailable/);
  delete hooks.beforeQuery;
  hooks.beforeCommit = (writes) => { if (writes.some(([, value]) => value === null)) throw new Error('commit unavailable'); };
  await assert.rejects(s.deleteLesson(request('t')), /commit unavailable/);
  assert.equal(s.files.size, 0);
  assert.equal(s.data.get('lessons/l').deleting, true);
  delete hooks.beforeCommit;
  await s.deleteLesson(request('t'));
  assert.equal(s.data.has('lessons/l'), false);
});
test('old deleting marker recovers for owner with teacher or both role', async () => {
  for (const role of ['teacher', 'both']) {
    const s = setup({ deleting: true, published: false, contents: [pdf('already-gone')] });
    s.files.clear();
    s.data.get('users/t').role = role;
    await s.deleteLesson(request('t'));
    assert.equal(s.data.has('lessons/l'), false);
  }
});
test('retry rechecks authentication, current role, owner and actual enrollments before cleanup', async () => {
  const s = setup({ deleting: true, published: false, contents: [pdf('a')] });
  await assert.rejects(s.deleteLesson({ data: { lessonId: 'l' } }), /Sign in/);
  await assert.rejects(s.deleteLesson(request('b')), /Only the teacher/);
  s.data.get('users/t').role = 'learner';
  await assert.rejects(s.deleteLesson(request('t')), /Only the teacher/);
  s.data.get('users/t').role = 'teacher';
  s.data.set('enrollments/new', { userId: 'a', lessonId: 'l' });
  s.data.set('lessonProgress/a_l', { lessonId: 'l' });
  await assert.rejects(s.deleteLesson(request('t')), /currently enrolled/);
  assert.equal(s.data.has('lessonProgress/a_l'), true);
  assert.equal(s.files.size, 1);
});
test('storage permission, authentication and configuration errors are surfaced and retryable', async () => {
  for (const code of [403, 401, 'invalid-bucket']) {
    const error = Object.assign(new Error(String(code)), { code });
    const hooks = { beforeFile: () => { throw error; } };
    const s = setup({ contents: [pdf('a')] }, hooks);
    await assert.rejects(s.deleteLesson(request('t')), (actual) => actual === error);
    assert.equal(s.data.get('lessons/l').deleting, true);
    delete hooks.beforeFile;
    await s.deleteLesson(request('t'));
    assert.equal(s.data.has('lessons/l'), false);
  }
});
test('overlapping deletions safely repeat cleanup without releasing the marker', async () => {
  let unblock;
  const paused = new Promise((resolve) => { unblock = resolve; });
  let started;
  const entered = new Promise((resolve) => { started = resolve; });
  let first = true;
  const hooks = { beforeFile: async () => {
    if (first) { first = false; started(); await paused; }
  } };
  const s = setup({ contents: [pdf('a')] }, hooks);
  const attempt = s.deleteLesson(request('t'));
  await entered;
  await s.deleteLesson(request('t'));
  unblock();
  await attempt;
  assert.equal(s.data.has('lessons/l'), false);
  assert.equal(s.removedFiles.length, 1);
});
test('final deletion rechecks enrollment existence after cleanup', async () => {
  let s;
  const hooks = { beforeFile: () => s.data.set('enrollments/admin-added', { userId: 'a', lessonId: 'l' }) };
  s = setup({ contents: [pdf('a')] }, hooks);
  await assert.rejects(s.deleteLesson(request('t')), /currently enrolled/);
  assert.equal(s.data.has('lessons/l'), true);
  assert.equal(s.data.has('enrollments/admin-added'), true);
});

test('object 404 does not hide a missing bucket or bucket permission failure', async () => {
  for (const code of [404, 403]) {
    const error = Object.assign(new Error('Bucket inaccessible'), { code });
    const hooks = { beforeBucket: () => { throw error; } };
    const s = setup({ contents: [pdf('already-missing')] }, hooks);
    s.files.clear();
    await assert.rejects(s.deleteLesson(request('t')), (actual) => actual === error);
    assert.equal(s.data.get('lessons/l').deleting, true);
    delete hooks.beforeBucket;
    await s.deleteLesson(request('t'));
    assert.equal(s.data.has('lessons/l'), false);
  }
});

const { isActiveEnrollment } = require('../shared/enrollmentPolicy');
test('shared policy preserves legacy/completed records and excludes all historical statuses', () => {
  for (const record of [{}, { status: 'active' }, { completed: true }, { status: 'completed' }]) assert.equal(isActiveEnrollment(record), true);
  for (const status of ['cancelled', 'canceled', 'inactive', 'removed', 'unenrolled']) assert.equal(isActiveEnrollment({ status }), false);
  assert.equal(isActiveEnrollment({ active: false, status: 'active' }), false);
});
test('historical records neither count nor block deletion and are removed with progress', async () => {
  const s = setup();
  for (const [i, status] of ['cancelled', 'inactive', 'removed'].entries()) s.data.set('enrollments/' + i, { userId: 'a', lessonId: 'l', status });
  s.data.set('lessonProgress/a_l', { lessonId: 'l' });
  await s.migrateLesson(s.db.doc('lessons/l'));
  assert.equal(s.data.get('lessons/l').enrollmentCount, 0);
  await s.deleteLesson(request('t'));
  assert.equal([...s.data.keys()].some((p) => p.startsWith('enrollments/') || p.startsWith('lessonProgress/') || p === 'lessons/l'), false);
});
test('one active learner prevents deleting any historical records', async () => {
  const s = setup();
  s.data.set('enrollments/active', { userId: 'a', lessonId: 'l', status: 'active' });
  s.data.set('enrollments/history', { userId: 'b', lessonId: 'l', active: false });
  await assert.rejects(s.deleteLesson(request('t')), /currently enrolled/);
  assert.equal(s.data.has('enrollments/history'), true);
  assert.equal(s.data.has('enrollments/active'), true);
});
test('reactivation reuses history and counts once; cancellation decrements once', async () => {
  for (const id of ['a_l', 'legacy-id']) {
    const s = setup();
    s.data.set('enrollments/' + id, { id, userId: 'a', lessonId: 'l', status: 'cancelled', active: false, progress: 50 });
    await Promise.all([s.enrollLesson(request('a')), s.enrollLesson(request('a'))]);
    assert.equal(s.data.get('lessons/l').enrollmentCount, 1);
    assert.equal(s.data.get('enrollments/' + id).progress, 50);
    assert.equal(s.data.get('enrollments/' + id).active, true);
    assert.equal([...s.data.keys()].filter((p) => p.startsWith('enrollments/')).length, 1);
    await s.cancelEnrollment(request('a'));
    await s.cancelEnrollment(request('a'));
    assert.equal(s.data.get('lessons/l').enrollmentCount, 0);
    await s.deleteLesson(request('t'));
    assert.equal(s.data.has('enrollments/' + id), false);
  }
});
test('partial history cleanup resumes without decrementing the count again', async () => {
  let pages = 0;
  const hooks = { beforeCommit: (writes) => {
    if (writes.some(([path, value]) => path.startsWith('enrollments/') && value === null) && ++pages === 2) throw new Error('history cleanup failed');
  } };
  const s = setup({}, hooks);
  for (let i = 0; i < 501; i++) s.data.set('enrollments/' + i, { lessonId: 'l', status: 'inactive' });
  await assert.rejects(s.deleteLesson(request('t')), /history cleanup failed/);
  assert.equal([...s.data.keys()].filter((p) => p.startsWith('enrollments/')).length, 1);
  assert.equal(s.data.get('lessons/l').enrollmentCount, 0);
  delete hooks.beforeCommit;
  await s.deleteLesson(request('t'));
  assert.equal([...s.data.keys()].some((p) => p.startsWith('enrollments/')), false);
});
