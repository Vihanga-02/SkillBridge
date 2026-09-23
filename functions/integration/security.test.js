const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { HttpsError } = require('firebase-functions/v2/https');
const { createOperations } = require('../enrollment');
let env, app, db, ops;
const request = (uid) => ({ auth: { uid }, data: { lessonId: 'l' } });
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-skillbridge', firestore: {
    rules: fs.readFileSync('firestore.enrollment.rules', 'utf8'),
  } });
  app = initializeApp({ projectId: 'demo-skillbridge' });
  db = getFirestore(app);
  ops = createOperations(db, FieldValue, HttpsError, () => { throw new Error('No files expected'); });
});
after(async () => { await env?.cleanup(); if (app) await deleteApp(app); });
beforeEach(async () => {
  await env.clearFirestore();
  await Promise.all([
    db.doc('lessons/l').set({ teacherId: 't', ownerId: 't', published: true, enrollmentCount: 0, completeCount: 0, contents: [] }),
    db.doc('users/t').set({ role: 'teacher' }), db.doc('users/a').set({ role: 'learner' }), db.doc('users/b').set({ role: 'both' }),
  ]);
});
test('public aggregate readable; private learner records cannot be enumerated', async () => {
  await ops.enrollLesson(request('a'));
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('b'), env.authenticatedContext('t')]) {
    const client = context.firestore();
    const lesson = await assertSucceeds(getDoc(doc(client, 'lessons/l')));
    assert.equal(lesson.data().enrollmentCount, 1);
    await assertFails(getDoc(doc(client, 'enrollments/a_l')));
    await assertFails(getDocs(query(collection(client, 'enrollments'), where('lessonId', '==', 'l'))));
  }
  const own = env.authenticatedContext('a').firestore();
  await assertSucceeds(getDocs(query(collection(own, 'enrollments'), where('userId', '==', 'a'))));
  await assertSucceeds(updateDoc(doc(own, 'enrollments/a_l'), { progress: 50 }));
  await assertFails(updateDoc(doc(own, 'enrollments/a_l'), { userId: 'b' }));
  await assertFails(deleteDoc(doc(own, 'enrollments/a_l')));
  await assertFails(setDoc(doc(own, 'enrollments/a_other'), { userId: 'a', lessonId: 'other' }));
});
test('clients cannot forge counts, delete lessons, or clear backend locks', async () => {
  await ops.enrollLesson(request('a'));
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('t'), env.authenticatedContext('a')]) {
    const client = context.firestore();
    await assertFails(updateDoc(doc(client, 'lessons/l'), { enrollmentCount: 999 }));
    await assertFails(updateDoc(doc(client, 'lessons/l'), { enrollmentCount: 0 }));
    await assertFails(updateDoc(doc(client, 'lessons/l'), { deleting: false }));
    await assertFails(deleteDoc(doc(client, 'lessons/l')));
  }
  const teacher = env.authenticatedContext('t').firestore();
  await assertSucceeds(updateDoc(doc(teacher, 'lessons/l'), { lessonName: 'Edited' }));
  await assertFails(setDoc(doc(teacher, 'lessons/forged'), { teacherId: 't', ownerId: 't', enrollmentCount: 9 }));
  await assertSucceeds(setDoc(doc(teacher, 'lessons/new'), { teacherId: 't', ownerId: 't', enrollmentCount: 0, published: false }));
});
test('real concurrent transactions deduplicate and increment exactly once', async () => {
  await Promise.all([ops.enrollLesson(request('a')), ops.enrollLesson(request('b')), ops.enrollLesson(request('a'))]);
  assert.equal((await db.doc('lessons/l').get()).data().enrollmentCount, 2);
  await db.doc('lessons/l').update({ enrollmentCount: 0 });
  await assert.rejects(ops.deleteLesson(request('t')), /currently enrolled/);
  await ops.migrateLesson(db.doc('lessons/l'));
  await ops.migrateLesson(db.doc('lessons/l'));
  assert.equal((await db.doc('lessons/l').get()).data().enrollmentCount, 2);
});
test('real enrollment/delete race never leaves an orphan enrollment', async () => {
  const results = await Promise.allSettled([ops.enrollLesson(request('a')), ops.deleteLesson(request('t'))]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const lesson = await db.doc('lessons/l').get();
  const enrollment = await db.doc('enrollments/a_l').get();
  assert.equal(lesson.exists, enrollment.exists);
});

test('partial cleanup retries against real Firestore, including a legacy marker', async () => {
  const paths = ['a', 'b'].map((name) => `lesson-files/t/title-l/${name}.pdf`);
  const files = new Set(paths);
  let failStorage = true;
  const recovering = createOperations(db, FieldValue, HttpsError, () => ({ getMetadata: async () => [{}], file: (path) => ({
    delete: async () => {
      if (path === paths[1] && failStorage) throw new Error('storage unavailable');
      if (!files.has(path)) throw Object.assign(new Error('Object not found'), { code: 404 });
      files.delete(path);
    },
  }) }));
  await db.doc('lessons/l').update({ deleting: true, published: false, contents: paths.map((filePath) => ({ type: 'pdf', filePath })) });
  await db.doc('lessonProgress/legacy').set({ lessonId: 'l' });
  await assert.rejects(recovering.deleteLesson(request('t')), /storage unavailable/);
  assert.equal((await db.doc('lessons/l').get()).data().deleting, true);
  assert.equal((await db.doc('lessonProgress/legacy').get()).exists, false);
  assert.equal(files.size, 1);
  const teacher = env.authenticatedContext('t').firestore();
  await assertSucceeds(getDoc(doc(teacher, 'lessons/l')));
  await assertFails(updateDoc(doc(teacher, 'lessons/l'), { deleting: false, published: true }));
  await assert.rejects(recovering.deleteLesson(request('b')), /Only the teacher/);
  await db.doc('enrollments/late').set({ lessonId: 'l', userId: 'a' });
  await assert.rejects(recovering.deleteLesson(request('t')), /currently enrolled/);
  assert.equal(files.size, 1);
  await db.doc('enrollments/late').delete();
  failStorage = false;
  await recovering.deleteLesson(request('t'));
  await recovering.deleteLesson(request('t'));
  assert.equal((await db.doc('lessons/l').get()).exists, false);
  assert.equal(files.size, 0);
});

test('overlapping owner requests can both complete against real Firestore', async () => {
  await db.doc('lessons/l').update({ deleting: true, published: false });
  await db.doc('lessonProgress/legacy').set({ lessonId: 'l' });
  const results = await Promise.all([ops.deleteLesson(request('t')), ops.deleteLesson(request('t'))]);
  assert.deepEqual(results, [{ deleted: true }, { deleted: true }]);
  assert.equal((await db.doc('lessons/l').get()).exists, false);
  assert.equal((await db.doc('lessonProgress/legacy').get()).exists, false);
});

test('active policy agrees with progress rules and migration for every legacy status', async () => {
  const client = env.authenticatedContext('a').firestore();
  for (const state of [{}, { status: 'active' }, { completed: true },
    { status: 'cancelled' }, { status: 'canceled' }, { status: 'inactive' },
    { status: 'removed' }, { status: 'unenrolled' }, { active: false }]) {
    await db.doc('enrollments/a_l').set({ userId: 'a', lessonId: 'l', ...state });
    const active = require('../shared/enrollmentPolicy').isActiveEnrollment(state);
    const update = updateDoc(doc(client, 'enrollments/a_l'), { progress: 25 });
    if (active) await assertSucceeds(update); else await assertFails(update);
    await ops.migrateLesson(db.doc('lessons/l'));
    assert.equal((await db.doc('lessons/l').get()).data().enrollmentCount, Number(active));
  }
});

test('reactivation, cancellation and history cleanup preserve one active membership', async () => {
  await db.doc('enrollments/a_l').set({ userId: 'a', lessonId: 'l', status: 'cancelled', progress: 40 });
  await db.doc('enrollments/old').set({ userId: 'b', lessonId: 'l', active: false });
  await Promise.all([ops.enrollLesson(request('a')), ops.enrollLesson(request('a'))]);
  assert.equal((await db.doc('lessons/l').get()).data().enrollmentCount, 1);
  assert.equal((await db.doc('enrollments/a_l').get()).data().progress, 40);
  await assert.rejects(ops.deleteLesson(request('t')), /currently enrolled/);
  assert.equal((await db.doc('enrollments/old').get()).exists, true);
  await ops.cancelEnrollment(request('a'));
  await ops.cancelEnrollment(request('a'));
  assert.equal((await db.doc('lessons/l').get()).data().enrollmentCount, 0);
  await ops.deleteLesson(request('t'));
  assert.equal((await db.collection('enrollments').where('lessonId', '==', 'l').get()).empty, true);
  assert.equal((await db.doc('lessons/l').get()).exists, false);
});

test('completion rules support a private legacy enrollment reference and reject cancellation', async () => {
  const client = env.authenticatedContext('a').firestore();
  await db.doc('enrollments/legacy').set({ userId: 'a', lessonId: 'l', status: 'active' });
  await db.doc('lessonProgress/a_l').set({ userId: 'a', lessonId: 'l', enrollmentId: 'legacy' });
  await assertSucceeds(updateDoc(doc(client, 'lessons/l'), { completeCount: 1 }));
  await db.doc('enrollments/legacy').update({ status: 'cancelled' });
  await assertFails(updateDoc(doc(client, 'lessons/l'), { completeCount: 2 }));
  await db.doc('enrollments/legacy').update({ status: 'active', userId: 'b' });
  await assertFails(updateDoc(doc(client, 'lessons/l'), { completeCount: 2 }));
});
