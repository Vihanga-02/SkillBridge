# Secure community leaderboard backend

This folder is deliberately separate from the Expo app. The app may read
`communityStats`, but only the Firebase Admin SDK may calculate or change a
member's score.

## What is counted

| Community action | Points |
| --- | ---: |
| Post created | 5 |
| Top-level comment created | 2 |
| Direct reply created | 1 |

Deletes apply the matching negative score. Likes and reactions are not counted:
they are easy to manipulate and measure popularity, not contribution.

## First deployment

1. Set up a Firebase service account or Application Default Credentials on the
   trusted machine used for deployment. Never commit its JSON key.
2. From this folder run `npm install`, then `npm run check`.
3. Run `npm run backfill:leaderboard` once to include posts, comments and replies
   that existed before the trigger deployment. Keep community writes paused or
   very brief for this release step.
4. From the repository root deploy: `npx firebase-tools deploy --only functions`.
5. In Firestore Console create the `communityStats` composite index:
   `communityScore` descending, then `lastContributionAt` descending, scope
   `Collection`.
6. Add the Rules snippet below into the existing shared `firestore.rules`,
   review it with the team, and deploy the full shared rules file.

Cloud Firestore events are delivered at least once. `leaderboardEvents` makes
each trigger idempotent. Configure a Firestore TTL policy on its `processedAt`
field after confirming the maximum retry window your team wants to retain.

## Firestore Rules snippet

Merge these matches **inside the existing** `service cloud.firestore` block;
do not replace the project's other rules.

```rules
match /communityStats/{userId} {
  allow read: if request.auth != null;
  allow create, update, delete: if false;
}

match /leaderboardEvents/{eventId} {
  allow read, write: if false;
}
```

Firebase Admin SDK functions bypass these client rules. The existing posts,
comments and replies rules must still permit their normal owner-authenticated
flows; they should not permit clients to write either leaderboard collection.
