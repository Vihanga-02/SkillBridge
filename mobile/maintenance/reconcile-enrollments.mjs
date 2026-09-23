// Admin-only, one-time maintenance. No client imports or user-facing entry point.
// Install here: npm install. Preview: npm run reconcile -- --project PROJECT_ID
// Apply after stopping old clients: npm run reconcile -- --project PROJECT_ID --apply --clients-stopped
// Uses Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or local ADC).
// Never embed a service-account key. This performs data writes only, never deployment.
import { pathToFileURL } from 'node:url';

export function inspectEnrollments(lessonId, records) {
  const users = new Set();
  let invalid = 0;
  let noncanonical = 0;
  for (const { id, data } of records) {
    if (data.lessonId !== lessonId || typeof data.userId !== 'string' || !data.userId ||
        data.userId.includes('/')) {
      invalid++;
      continue;
    }
    if (data.active === false || ['cancelled', 'canceled', 'removed', 'unenrolled'].includes(data.status)) {
      // The current schema has no inactive-enrollment state. Do not enable an
      // aggregate that the existing deterministic enrollment lookup cannot use.
      invalid++;
      continue;
    }
    users.add(data.userId); // Completed learners and creator self-enrollments count.
    if (id !== `${data.userId}_${lessonId}`) noncanonical++;
  }
  return { count: users.size, invalid, noncanonical };
}

export async function reconcileLesson(db, lessonRef, { apply = false } = {}) {
  return db.runTransaction(async (transaction) => {
    const lesson = await transaction.get(lessonRef);
    if (!lesson.exists) return { id: lessonRef.id, skipped: 'missing' };
    const enrollments = await transaction.get(db.collection('enrollments').where('lessonId', '==', lessonRef.id));
    const result = inspectEnrollments(lessonRef.id, enrollments.docs.map((row) => ({ id: row.id, data: row.data() })));
    const data = lesson.data();
    // Refuse unexpected schemas rather than silently counting duplicates that a
    // later client enrollment could count again. No enrollment/progress is changed.
    if (result.invalid || result.noncanonical || (data.deleting === true && result.count > 0)) {
      return { id: lessonRef.id, ...result, skipped: 'requires-data-review' };
    }
    if (apply) transaction.update(lessonRef, {
      enrollmentCount: result.count,
      enrollmentCountVersion: 1,
    });
    return { id: lessonRef.id, previous: data.enrollmentCount ?? null, count: result.count, applied: apply };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const projectIndex = args.indexOf('--project');
  const projectId = projectIndex >= 0 ? args[projectIndex + 1] : undefined;
  const apply = args.includes('--apply');
  if (!projectId || projectId.startsWith('--')) throw new Error('Provide --project PROJECT_ID explicitly.');
  if (apply && !args.includes('--clients-stopped')) {
    throw new Error('Stop old clients/writers first, then pass --clients-stopped. Old clients do not maintain the aggregate.');
  }
  const { initializeApp, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore, FieldPath } = await import('firebase-admin/firestore');
  initializeApp({ projectId, credential: applicationDefault() });
  const db = getFirestore();
  let cursor;
  let reviewed = 0;
  let blocked = 0;
  while (true) {
    let query = db.collection('lessons').orderBy(FieldPath.documentId()).limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const lesson of page.docs) {
      const result = await reconcileLesson(db, lesson.ref, { apply });
      console.log(JSON.stringify(result)); // Aggregate diagnostics only; no learner records.
      reviewed++;
      if (result.skipped) blocked++;
    }
    cursor = page.docs.at(-1);
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', reviewed, blocked }));
  if (blocked) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
