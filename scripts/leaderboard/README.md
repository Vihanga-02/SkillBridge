# Leaderboard backfill

The mobile app keeps `communityStats` up to date by itself: creating or deleting
a post, comment or reply updates the author's score in the same Firestore write
(`mobile/src/services/postService.ts`). No Cloud Function is involved.

This script rebuilds every score from the real content. Run it once to count
content created before the leaderboard existed, or later if the numbers ever
look wrong.

| Community action | Points |
| --- | ---: |
| Post | 5 |
| Comment | 2 |
| Reply | 1 |

## Run it (PowerShell)

1. Firebase Console → Project settings → Service accounts → **Generate new
   private key**. Keep it outside the repo (e.g. your Downloads folder).
2. From this folder:

```powershell
cd scripts\leaderboard
npm install
$env:GOOGLE_APPLICATION_CREDENTIALS = "$env:USERPROFILE\Downloads\<your-key-file>.json"
npm run preview    # dry run, prints the top 10, writes nothing
npm run backfill   # overwrites communityStats
```

Run the real backfill while nobody is posting, because a contribution made
during the run can be overwritten.
