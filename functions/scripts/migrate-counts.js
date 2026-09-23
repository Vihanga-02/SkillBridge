// Run with Application Default Credentials and an explicit target project.
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createOperations } = require('../enrollment');
if (!process.env.GOOGLE_CLOUD_PROJECT) throw new Error('Set GOOGLE_CLOUD_PROJECT explicitly.');
initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
const db = getFirestore();
const { migrateLesson } = createOperations(db, FieldValue);
async function main() {
  let last;
  let total = 0;
  while (true) {
    let query = db.collection('lessons').orderBy('__name__').limit(100);
    if (last) query = query.startAfter(last);
    const page = await query.get();
    if (page.empty) break;
    for (const lesson of page.docs) { await migrateLesson(lesson.ref); total++; }
    last = page.docs.at(-1);
  }
  console.log(`Reconciled ${total} lessons.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
