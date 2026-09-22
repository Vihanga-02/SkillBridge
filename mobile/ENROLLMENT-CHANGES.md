# Enrollment counts and deletion protection

## Changed files

- `src/services/lessonService.ts`: shared count queries/listener, authenticated owner and role checks, deletion lock and server rechecks, scoped PDF cleanup.
- `src/hooks/useLessonEnrollmentCount.ts`: one real-time subscription per mounted lesson, shared across views; releases subscriptions on unmount.
- `src/components/lesson/EnrollmentCount.tsx`: consistent people icon and count, with explicit loading/error states.
- `src/components/lesson/DeleteLessonButton.tsx`: disabled/locked deletion when enrolled or count is unknown; editing remains available.
- `app/(tabs)/feed.tsx`, `app/profile/lessons/index.tsx`, `app/user/[id].tsx`, `app/lesson/details/[id].tsx`, `app/lesson/[id].tsx`: count display across all existing lesson surfaces.
- `_tests_/lessonEnrollment.test.ts`: 12 regression cases.

No roadmap/recommended-lesson implementation exists in this checkout. Future cards can reuse `EnrollmentCount`.

## Data and behavior

Counts query the existing `enrollments` collection by `lessonId`, deduplicate `userId`, and exclude `active: false` and cancelled/canceled/removed/unenrolled status records. Completed enrollments still count; creators count only if they have an enrollment record. The current app has no unenrollment flow. No stored counter, migration, user/profile downloads for counts, or changes to learner progress are required. Existing lessons work with their existing records. Existing enrollment transactions use deterministic `userId_lessonId` document IDs to prevent repeat enrollment from resetting progress.

Deletion verifies Firebase Auth identity, the lesson's normalized `teacherId` (legacy `ownerId` fallback), and `users/{uid}.role` (`teacher` or `both`). It queries enrollments directly from the server, acquires `lessons/{id}.deleting` in a transaction, then queries the server again. Existing enrollment transactions read the same lesson document: enrollments committed before the lock are caught by the second check; transactions overlapping/following the lock retry/reject. An enrollment or query failure at the second check releases the lock before any cleanup. Counts passed from UI are never used to authorize deletion.

Only after both checks succeed does deletion unpublish the lesson, remove its `lessonProgress` records, delete PDF paths scoped to that teacher and lesson folder, and delete the lesson. Enrollment records are no longer deleted as part of cleanup. Material access screens and enrollment gating are unchanged.

## Validation and deployment limits

- TypeScript and Expo lint passed; diff whitespace check passed.
- All 12 new regression cases passed, including zero-enrollment deletion for teacher/both roles, 1/2 learners blocking deletion, stale-count race, server query failures, ownership/auth failures, locked enrollment, duplicate enrollment, and exclusive-file cleanup.
- Full Jest run: 18 tests passed across three suites; existing login and registration suites could not load because `test-renderer` is missing.
- Live Firebase, emulator rules, and device UI tests were not performed.
- No Firestore Rules or Cloud Functions sources/configuration exist in this checkout; neither was changed or deployed. This protects calls through the shared application services. It does not establish server-side protection against arbitrary Firestore writes or clients that ignore `deleting`. Deployed rules must permit the enrollment queries for counts; permission failures show unavailable counts and block deletion. Do not broaden enrollment-record access without reviewing privacy. A server count endpoint and server deletion transaction are appropriate if deployed rules intentionally keep enrollment records private.
- As with the previous cleanup flow, a failure after cleanup starts can leave a locked, unpublished lesson requiring recovery. The lock is deliberately retained once destructive cleanup begins.
