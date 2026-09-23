// All enrollment creation and lesson deletion must go through these operations.
// Both write the lesson document, serializing enrollment, migration and deletion.
const { isActiveEnrollment } = require('./shared/enrollmentPolicy');
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
      }
      // Also protect legacy records whose IDs were not deterministic. This query
      // is privileged and never returns learner records to the caller.
      const records = await tx.get(enrollmentQuery(lessonId));
      const ownRecords = records.docs.filter((row) => row.data().userId === uid);
      if (ownRecords.some((row) => isActiveEnrollment(row.data()))) return { enrolled: true };
      const previous = existing.exists ? existing : ownRecords[0];
      const targetRef = previous?.ref ?? enrollmentRef;
      const timestamp = FieldValue.serverTimestamp();
      const title = lesson.lessonName ?? lesson.title ?? '';
      tx.set(targetRef, {
        id: targetRef.id, userId: uid, lessonId, active: true, status: 'active',
        lessonName: title, teacherId: lesson.teacherId ?? lesson.ownerId,
        teacherName: lesson.teacherName ?? lesson.ownerName ?? '',
        careerGoalId: lesson.careerGoalId ?? '', careerGoalName: lesson.careerGoalName ?? '',
        contentCount: (lesson.contents ?? []).length,
        completedContentIds: previous?.data().completedContentIds ?? [],
        progress: previous?.data().progress ?? 0, completed: previous?.data().completed ?? false,
        completedAt: previous?.data().completedAt ?? null,
        enrolledAt: previous?.data().enrolledAt ?? timestamp, updatedAt: timestamp,
      }, { merge: true });
      if (!previous) tx.set(db.doc(`lessonProgress/${uid}_${lessonId}`), {
        id: `${uid}_${lessonId}`, userId: uid, lessonId, lessonTitle: title,
        skillTag: lesson.skillTag ?? '', status: 'in_progress', lastCardIndex: 0,
        quizScore: 0, quizAttempts: 0, minutesSpent: 0,
        startedAt: timestamp, completedAt: null, updatedAt: timestamp,
      }, { merge: true });
      tx.update(lessonRef, {
        // The query and write share this transaction; no read/modify/write race.
        enrollmentCount: countLearners(records) + 1,
      });
      return { enrolled: true };
    });
  }

  // Trusted membership transition, with no new cancellation UI. Update all
  // legacy duplicates together so one learner is decremented at most once.
  async function cancelEnrollment(request) {
    const { uid, lessonId } = identity(request);
    const lessonRef = db.doc(`lessons/${lessonId}`);
    return db.runTransaction(async (tx) => {
      const lesson = await tx.get(lessonRef);
      if (!lesson.exists || lesson.data().deleting) fail('failed-precondition', 'Lesson is unavailable.');
      const records = await tx.get(enrollmentQuery(lessonId));
      const own = records.docs.filter((row) => row.data().userId === uid);
      own.forEach((row) => tx.update(row.ref, { active: false, status: 'cancelled', updatedAt: FieldValue.serverTimestamp() }));
      tx.update(lessonRef, { enrollmentCount: countLearners({ docs: records.docs.filter((row) => row.data().userId !== uid) }) });
      return { enrolled: false };
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
      const records = await tx.get(enrollmentQuery(lessonId));
      if (records.docs.some((row) => isActiveEnrollment(row.data()))) fail('failed-precondition', 'This lesson cannot be deleted because learners are currently enrolled.');
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
    // Delete only history, rechecking each page in a transaction so a record
    // cannot become active between validation and its deletion.
    while (true) {
      const removed = await db.runTransaction(async (tx) => {
        const current = await verifyDeletion(tx);
        if (!current) return 0;
        const history = await tx.get(enrollmentQuery(lessonId).limit(500));
        history.docs.forEach((row) => tx.delete(row.ref));
        return history.docs.length;
      });
      if (!removed) break;
    }
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
      const remaining = await tx.get(enrollmentQuery(lessonId).limit(1));
      if (!remaining.empty) fail('failed-precondition', 'Enrollment history changed. Retry deletion.');
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
  return { enrollLesson, cancelEnrollment, deleteLesson, migrateLesson };
}

function countLearners(snapshot) {
  // Count each learner once; preserve malformed legacy records conservatively.
  return new Set(snapshot.docs.filter((row) => isActiveEnrollment(row.data())).map((row) => row.data().userId || `missing:${row.id}`)).size;
}

module.exports = { createOperations };
