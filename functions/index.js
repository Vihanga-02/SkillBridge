const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { createOperations } = require('./enrollment');
initializeApp();
const db = getFirestore();
const operations = createOperations(db, FieldValue, HttpsError, () => getStorage().bucket());
exports.enrollLesson = onCall(operations.enrollLesson);
exports.deleteLesson = onCall(operations.deleteLesson);

// Teacher edits must not require reading private learner documents on a client.
exports.syncLessonMetadata = onDocumentUpdated({ document: 'lessons/{lessonId}', retry: true }, async (event) => {
  const keys = ['lessonName', 'teacherName', 'careerGoalId', 'careerGoalName', 'contents', 'skillTag'];
  const before = event.data.before.data(), after = event.data.after.data();
  if (keys.every((key) => JSON.stringify(before[key]) === JSON.stringify(after[key]))) return;
  for (const collection of ['enrollments', 'lessonProgress']) {
    const rows = await db.collection(collection).where('lessonId', '==', event.params.lessonId).get();
    for (const row of rows.docs) {
      await db.runTransaction(async (tx) => {
        // Read current data so retried/out-of-order events cannot restore old names.
        const lesson = await tx.get(event.data.after.ref);
        const current = await tx.get(row.ref);
        if (!lesson.exists || lesson.data().deleting || !current.exists) return;
        const data = lesson.data();
        tx.update(row.ref, collection === 'enrollments' ? {
          lessonName: data.lessonName ?? data.title ?? '', teacherName: data.teacherName ?? '',
          careerGoalId: data.careerGoalId ?? '', careerGoalName: data.careerGoalName ?? '',
          contentCount: (data.contents ?? []).length, updatedAt: FieldValue.serverTimestamp(),
        } : { lessonTitle: data.lessonName ?? data.title ?? '', skillTag: data.skillTag ?? '', updatedAt: FieldValue.serverTimestamp() });
      });
    }
  }
});
