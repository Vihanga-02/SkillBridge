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
