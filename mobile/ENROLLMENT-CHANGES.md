# Enrollment counts and deletion protection

## Changed files

- `src/services/lessonService.ts`: transactional stored counts, authenticated owner and role checks, deletion lock and server rechecks, scoped PDF cleanup.
- `src/components/lesson/EnrollmentCount.tsx`: consistent people icon and count, with explicit loading/error states.
- `src/components/lesson/DeleteLessonButton.tsx`: disabled/locked deletion when enrolled or count is unknown; editing remains available.
- `app/(tabs)/feed.tsx`, `app/profile/lessons/index.tsx`, `app/user/[id].tsx`, `app/lesson/details/[id].tsx`, `app/lesson/[id].tsx`: count display across all existing lesson surfaces.
- `_tests_/lessonEnrollment.test.ts`: 12 regression cases.

No roadmap/recommended-lesson implementation exists in this checkout. Future cards can reuse `EnrollmentCount`.

## Data and behavior

Counts use `lessons/{id}.enrollmentCount`, guarded by `enrollmentCountVersion: 1`. New enrollment transactions increment the count while creating deterministic `userId_lessonId` enrollment records, preventing repeat enrollment from resetting progress or incrementing twice. Completed enrollments still count; creators count only if they have an enrollment record. Lessons without the version marker fail closed until migrated: their count is shown as unavailable, enrollment is paused, and deletion is rejected before acquiring a lock.

Deletion verifies Firebase Auth identity, the lesson's normalized `teacherId` (legacy `ownerId` fallback), `users/{uid}.role` (`teacher` or `both`), and the versioned count stored on the lesson. Enrollment and deletion transactions both write the lesson document, so Firestore retries the losing transaction; enrollment rejects after a deletion lock is acquired. Counts passed from UI are never used to authorize deletion.

Only after both checks succeed does deletion unpublish the lesson, remove its `lessonProgress` records, delete PDF paths scoped to that teacher and lesson folder, and delete the lesson. Enrollment records are no longer deleted as part of cleanup. Material access screens and enrollment gating are unchanged.

## Validation and deployment limits

- TypeScript and Expo lint passed; diff whitespace check passed.
- Regression coverage includes zero-enrollment deletion for teacher/both roles, enrolled-lesson blocking, stale-count races, migration guards, ownership/auth failures, locked enrollment, duplicate enrollment, and exclusive-file cleanup.
- Full Jest run: 60 tests passed across eight suites.
- Live Firebase, emulator rules, and device UI tests were not performed.
- No Firestore Rules or Cloud Functions sources/configuration exist in this checkout; neither was changed or deployed. This protects calls through the shared application services. It does not establish server-side protection against arbitrary Firestore writes or clients that ignore `deleting`. Deployed rules must allow enrollment transactions to update the lesson counter without allowing unrelated lesson edits. A server endpoint is preferable if that cannot be expressed safely in the deployed rules.
- As with the previous cleanup flow, a failure after cleanup starts can leave a locked, unpublished lesson requiring recovery. The lock is deliberately retained once destructive cleanup begins.
