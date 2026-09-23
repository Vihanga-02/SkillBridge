# Active enrollment lifecycle

The original schema uses deterministic `uid_lessonId` IDs, user/lesson IDs, metadata and progress/completion fields. New records previously omitted `active` and `status`; no cancellation UI or cancellation operation existed. Older counting logic recognized `active: false` and cancelled/canceled/removed/unenrolled statuses. This change preserves those fields and adds recognition of the reported `inactive` status.

`shared/enrollmentPolicy.js` is the single application/backend definition: a record is active unless `active === false` or status is one of `cancelled`, `canceled`, `inactive`, `removed`, `unenrolled`. Missing fields, completed records and unknown statuses remain active conservatively. Rules express the same predicate in the Firestore rules language, checked against the shared policy by emulator tests.

## Files changed

- `functions/shared/enrollmentPolicy.js` and `enrollmentPolicy.d.ts`
- `functions/enrollment.js`
- `functions/index.js`
- `functions/firestore.enrollment.rules`
- `functions/test/enrollment.test.js`
- `functions/integration/security.test.js`
- `functions/ENROLLMENT-LIFECYCLE.md`
- `mobile/metro.config.js`
- `mobile/src/services/lessonService.ts`
- `mobile/src/types/index.ts`
- `mobile/_tests_/lessonEnrollment.test.ts`

## Client behavior

Enrollment reads still query only the current learner's records. They filter through the shared policy and sort locally, retaining legacy records without `updatedAt`. My Lessons additionally deduplicates lesson IDs, checks referenced lesson documents and skips absent, inaccessible, unpublished or deleting lessons. Network/service failures still surface. No broken Continue Learning card is produced from an orphan record loaded by this service.

Course Details and lesson access use the same active-only `getEnrollment`. Progress transactions recheck activity after loading, preventing a cancellation race from granting progress access. Legacy enrollment IDs are reused; progress records store a private optional `enrollmentId` reference. Completion rules verify that referenced enrollment belongs to the current learner and lesson and remains active. Include this optional field in any deployed progress-field whitelist while preserving its existing ownership restrictions.

The pure policy resides inside the Functions deploy source and is imported directly by the mobile service. Metro watches that shared folder. Public count components continue observing only `lesson.enrollmentCount`.

## Trusted membership and counts

Enrollment checks all existing records for that lesson through privileged access. An already-active learner is a no-op. Otherwise it reactivates one existing record, preferring the deterministic ID, or creates one record if none exists. Existing completion/progress data is preserved. The transaction writes the number of distinct active learners plus the new learner; this is an atomic query-and-write transaction sharing the lesson document with deletion, not a client-side counter read/increment sequence.

The new authenticated `cancelEnrollment` callable cancels only the caller's memberships, including legacy duplicates, and transactionally recomputes the remaining unique active count. Repeated cancellation cannot decrement twice or produce a negative count. No cancellation UI was added. Direct client membership/status changes remain prohibited; privileged external tools must use this protocol rather than raw status writes.

Rerun the existing privileged count migration after deployment to replace old all-record aggregates with active-only totals. It uses the shared policy and deduplicates learners. No production migration was executed here.

## Deletion and recovery

Deletion validates authenticated ownership and teacher/both role, queries actual records and rejects if any is active. It does not trust the aggregate and NEVER removes active records to make deletion eligible.

After acquiring the durable deletion marker, it transactionally removes history in pages of at most 500. Each page rechecks authorization and active enrollment existence; transaction conflicts prevent a record from being reactivated between validation and deletion. Historical cleanup does not decrement the aggregate again. Progress/PDF cleanup follows, retaining the prior retry-safe behavior. Final removal rechecks active membership and requires no remaining historical records, so newly introduced history requires another retry rather than becoming an orphan.

Already-deleted historical records are naturally absent on retry. `deleting: true` remains recoverable and is never blindly reset. Existing active orphans are hidden defensively by client listings; this change does not bulk-delete historical production corruption.

## Deployment and validation

Deploy the updated enrollment/deletion/cancellation functions, merge the scoped rules into the authoritative full ruleset, allow the optional private progress reference in any existing field whitelist, and release the mobile build. Do not deploy the scoped rules as a replacement for unrelated application policies. Then run the privileged count reconciliation.

Validation passed: TypeScript, Expo lint, 22 backend unit tests, 20 targeted mobile tests and all 9 Firestore emulator integration tests. Tests cover the active-status matrix, active versus mixed history deletion, reactivation without duplicates, cancellation without double decrement, partial historical cleanup/retry, orphan and duplicate cards, and progress access. Expo web export also succeeded (39 static routes), verifying Metro can bundle the shared policy. No live data or deployment was changed; Storage failures remain simulated in the integration suite, and no device UI testing was performed.
