// All enrollment creation and lesson deletion must go through these operations.
// Both write the lesson document, serializing enrollment, migration and deletion.
function createOperations(db, FieldValue, HttpsError, bucket) {
  const fail = (code, message) => { throw new HttpsError(code, message); };
  function identity(request) {
    if (!request.auth) fail('unauthenticated', 'Sign in first.');
    const lessonId = request.data?.lessonId;
    if (typeof lessonId !== 'string' || !lessonId || lessonId.includes('/') || lessonId.length > 500) {
      fail('invalid-argument', 'A valid lessonId is required.');
    }
    return { uid: request.auth.uid, lessonId };
  }
  const enrollmentQuery = (id) => db.collection('enrollments').where('lessonId', '==', id);

  async function enrollLesson(request) {
    const { uid, lessonId } = identity(request);
    const lessonRef = db.doc(`lessons/${lessonId}`);
    const enrollmentRef = db.doc(`enrollments/${uid}_${lessonId}`);
    return db.runTransaction(async (tx) => {
      const lessonSnapshot = await tx.get(lessonRef);
      const user = await tx.get(db.doc(`users/${uid}`));
      const existing = await tx.get(enrollmentRef);
      if (!['learner', 'both'].includes(user.data()?.role)) fail('permission-denied', 'A learner role is required.');
      const lesson = lessonSnapshot.data();
      if (!lesson || lesson.published !== true || lesson.deleting === true) {
        fail('failed-precondition', 'This lesson is no longer available for enrollment.');
      }
      if (existing.exists) {
        if (existing.data().userId !== uid || existing.data().lessonId !== lessonId) {
          fail('failed-precondition', 'Enrollment identifier conflict.');
        }
        return { enrolled: true };
      }
      // Also protect legacy records whose IDs were not deterministic. This query
      // is privileged and never returns learner records to the caller.
      const records = await tx.get(enrollmentQuery(lessonId));
      if (records.docs.some((row) => row.data().userId === uid)) return { enrolled: true };
      const timestamp = FieldValue.serverTimestamp();
      const title = lesson.lessonName ?? lesson.title ?? '';
      tx.create(enrollmentRef, {
        id: enrollmentRef.id, userId: uid, lessonId,
        lessonName: title, teacherId: lesson.teacherId ?? lesson.ownerId,
        teacherName: lesson.teacherName ?? lesson.ownerName ?? '',
        careerGoalId: lesson.careerGoalId ?? '', careerGoalName: lesson.careerGoalName ?? '',
        contentCount: (lesson.contents ?? []).length, completedContentIds: [],
        progress: 0, completed: false, completedAt: null,
        enrolledAt: timestamp, updatedAt: timestamp,
      });
      tx.set(db.doc(`lessonProgress/${uid}_${lessonId}`), {
        id: `${uid}_${lessonId}`, userId: uid, lessonId, lessonTitle: title,
        skillTag: lesson.skillTag ?? '', status: 'in_progress', lastCardIndex: 0,
        quizScore: 0, quizAttempts: 0, minutesSpent: 0,
        startedAt: timestamp, completedAt: null, updatedAt: timestamp,
      }, { merge: true });
      tx.update(lessonRef, {
        enrollmentCount: Number.isSafeInteger(lesson.enrollmentCount) && lesson.enrollmentCount >= 0
          ? FieldValue.increment(1) : countLearners(records) + 1,
      });
      return { enrolled: true };
    });
  }

  async function deleteLesson(request) {
    const { uid, lessonId } = identity(request);
    const lessonRef = db.doc(`lessons/${lessonId}`);
    const lesson = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(lessonRef);
      const user = await tx.get(db.doc(`users/${uid}`));
      if (!snapshot.exists) return null;
      const data = snapshot.data();
      if ((data.teacherId ?? data.ownerId) !== uid || !['teacher', 'both'].includes(user.data()?.role)) {
        fail('permission-denied', 'Only the teacher who created this lesson can delete it.');
      }
      // Any record blocks deletion, including inactive or malformed legacy ones.
      const records = await tx.get(enrollmentQuery(lessonId).limit(1));
      if (!records.empty) fail('failed-precondition', 'This lesson cannot be deleted because learners are currently enrolled.');
      tx.update(lessonRef, { deleting: true, published: false });
      return data;
    });
    if (!lesson) return { deleted: true };
    // The lock remains on failure; the owner can safely retry cleanup.
    const progress = await db.collection('lessonProgress').where('lessonId', '==', lessonId).get();
    for (let i = 0; i < progress.docs.length; i += 500) {
      const batch = db.batch();
      progress.docs.slice(i, i + 500).forEach((row) => batch.delete(row.ref));
      await batch.commit();
    }
    for (const item of lesson.contents ?? []) {
      if (item.type !== 'pdf' || typeof item.filePath !== 'string') continue;
      const parts = item.filePath.split('/');
      if (parts.length === 4 && parts[0] === 'lesson-files' && parts[1] === uid && parts[2].endsWith(`-${lessonId}`)) {
        await bucket().file(item.filePath).delete({ ignoreNotFound: true });
      }
    }
    await lessonRef.delete();
    return { deleted: true };
  }

  async function migrateLesson(lessonRef) {
    return db.runTransaction(async (tx) => {
      const lesson = await tx.get(lessonRef);
      if (!lesson.exists || lesson.data().deleting === true) return;
      const records = await tx.get(enrollmentQuery(lessonRef.id));
      tx.update(lessonRef, { enrollmentCount: countLearners(records) });
    });
  }
  return { enrollLesson, deleteLesson, migrateLesson };
}

function countLearners(snapshot) {
  // Count each learner once; preserve malformed legacy records conservatively.
  return new Set(snapshot.docs.map((row) => row.data().userId || `missing:${row.id}`)).size;
}

module.exports = { createOperations };
