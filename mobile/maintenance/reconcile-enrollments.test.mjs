import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectEnrollments, reconcileLesson } from './reconcile-enrollments.mjs';

const rows = (users) => users.map((userId) => ({ id: `${userId}_lesson`, data: { userId, lessonId: 'lesson', completed: true } }));
function fixture(records, data = {}) {
  const writes = [];
  const ref = { id: 'lesson' };
  const query = {};
  const db = {
    collection: () => ({ where: () => query }),
    runTransaction: async (fn) => fn({
      get: async (target) => target === ref ? { exists: true, data: () => data } :
        { docs: records.map(({ id, data }) => ({ id, data: () => data })) },
      update: (target, value) => writes.push({ target, value }),
    }),
  };
  return { db, ref, writes };
}
test('completed learners and BOTH creator self-enrollment are legitimate', () => {
  assert.deepEqual(inspectEnrollments('lesson', rows(['teacher', 'one', 'two', 'three'])),
    { count: 4, invalid: 0, noncanonical: 0 });
});
test('existing lesson with four records is reconciled atomically', async () => {
  const f = fixture(rows(['one', 'two', 'three', 'four']));
  const result = await reconcileLesson(f.db, f.ref, { apply: true });
  assert.equal(result.count, 4);
  assert.deepEqual(f.writes, [{ target: f.ref, value: { enrollmentCount: 4, enrollmentCountVersion: 1 } }]);
});
test('existing empty lesson becomes verified zero; rerun is idempotent', async () => {
  const f = fixture([], { enrollmentCount: 0, enrollmentCountVersion: 1 });
  await reconcileLesson(f.db, f.ref, { apply: true });
  await reconcileLesson(f.db, f.ref, { apply: true });
  assert.equal(f.writes.length, 2);
  assert.deepEqual(f.writes[0], f.writes[1]);
  assert.equal(f.writes[0].value.enrollmentCount, 0);
});
test('dry run never writes', async () => {
  const f = fixture(rows(['one']));
  assert.equal((await reconcileLesson(f.db, f.ref)).count, 1);
  assert.deepEqual(f.writes, []);
});
test('legacy duplicates are detected without creating another enrollment', async () => {
  const records = [...rows(['one']), { id: 'legacy', data: { userId: 'one', lessonId: 'lesson' } }];
  const f = fixture(records);
  const result = await reconcileLesson(f.db, f.ref, { apply: true });
  assert.equal(result.count, 1);
  assert.equal(result.skipped, 'requires-data-review');
  assert.deepEqual(f.writes, []);
});
test('invalid/inactive records or deleting lesson with learners fail closed', async () => {
  for (const f of [fixture([{ id: 'invalid', data: {} }]),
    fixture([{ id: 'one_lesson', data: { userId: 'one', lessonId: 'lesson', active: false } }]),
    fixture(rows(['one']), { deleting: true })]) {
    assert.equal((await reconcileLesson(f.db, f.ref, { apply: true })).skipped, 'requires-data-review');
    assert.deepEqual(f.writes, []);
  }
});
test('legacy interrupted empty deletion remains retryable after reconciliation', async () => {
  const f = fixture([], { deleting: true });
  await reconcileLesson(f.db, f.ref, { apply: true });
  assert.deepEqual(f.writes[0].value, { enrollmentCount: 0, enrollmentCountVersion: 1 });
});
