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
    async function verifyDeletion(tx) {
      const snapshot = await tx.get(lessonRef);
      const user = await tx.get(db.doc(`users/${uid}`));
      if (!['teacher', 'both'].includes(user.data()?.role)) {
        fail('permission-denied', 'Only the teacher who created this lesson can delete it.');
      }
      // A lost success response can be retried after the document is gone.
      if (!snapshot.exists) return null;
      const data = snapshot.data();
      if ((data.teacherId ?? data.ownerId) !== uid) {
        fail('permission-denied', 'Only the teacher who created this lesson can delete it.');
      }
      // Any record blocks deletion, including inactive or malformed legacy ones.
      const records = await tx.get(enrollmentQuery(lessonId).limit(1));
      if (!records.empty) fail('failed-precondition', 'This lesson cannot be deleted because learners are currently enrolled.');
      return data;
    }
    const lesson = await db.runTransaction(async (tx) => {
      const data = await verifyDeletion(tx);
      if (!data) return null;
      // This is a durable cleanup marker, not an exclusive attempt lock. Old
      // deleting=true documents and overlapping owner retries follow this path.
      tx.update(lessonRef, { deleting: true, published: false });
      return data;
    });
    if (!lesson) return { deleted: true };
    // Never clear the marker after partial cleanup: another attempt may still
    // be running, and republishing would expose incomplete lesson content.
    // Requery remaining records in bounded batches. Missing records are safe.
    const progressQuery = db.collection('lessonProgress').where('lessonId', '==', lessonId).limit(500);
    while (true) {
      const progress = await progressQuery.get();
      if (progress.empty) break;
      const batch = db.batch();
      progress.docs.forEach((row) => batch.delete(row.ref));
      await batch.commit();
    }
    for (const item of lesson.contents ?? []) {
      if (item.type !== 'pdf' || typeof item.filePath !== 'string') continue;
      const parts = item.filePath.split('/');
      if (parts.length === 4 && parts[0] === 'lesson-files' && parts[1] === uid && parts[2].endsWith(`-${lessonId}`)) {
        const storageBucket = bucket();
        try {
          await storageBucket.file(item.filePath).delete();
        } catch (error) {
          if (error.code !== 404) throw error;
          // A 404 can also mean the bucket is missing/misconfigured. Confirm
          // the bucket is accessible before accepting an absent object as done.
          // Permission, configuration and transport failures still propagate.
          await storageBucket.getMetadata();
        }
      }
    }
    // Storage is outside Firestore transactions. Revalidate after cleanup and
    // delete last; if this commit fails, repeating cleanup remains safe.
    await db.runTransaction(async (tx) => {
      const current = await verifyDeletion(tx);
      if (!current) return; // Another owner attempt already finished.
      if (current.deleting !== true) fail('failed-precondition', 'Lesson deletion state changed. Retry deletion.');
      tx.delete(lessonRef);
    });
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
