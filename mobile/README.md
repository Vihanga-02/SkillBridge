# SkillBridge — mobile app

Community skill-exchange and micro-learning app for campus communities (SDG 4 & 8).
React Native (Expo, TypeScript, Expo Router) · Firebase Auth + Firestore + Storage.

See `../SkillBridge-Implementation-Plan-v2.md` for the full plan. This README covers
only what you need to run the project.

## Run it

**Expo Go does not work for this app.** In-app video (LiveKit) needs native code,
so you develop on the SkillBridge **development build** APK instead. Install it once
from expo.dev (`skillbridge-team` → `skillbridge` → Builds → latest *development*).
Full step-by-step setup, branching and release flow: [DEV_GUIDE.md](DEV_GUIDE.md).

```bash
npm install
cp .env.example .env              # then paste the six values from the group chat
npx expo start --dev-client       # open the development build on your phone
```

Run every command from `mobile/` — outside it, `npx expo` downloads an unrelated Expo version.

`npx expo start --dev-client -c` clears the Metro cache — use it whenever something
looks stale, and always after editing `.env` (env values are inlined at bundle time).

## Environment variables

All six are required; the app throws a readable error on startup if any is missing.
They are `EXPO_PUBLIC_*` because the Firebase web config is not a secret — but the
Gemini key never goes here (§11.1 of the plan).

| Variable | Where to find it |
|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase console → Project settings → Your apps → Web app |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | same |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | same |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | same |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | same |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | same |

`.env` is gitignored. Never commit it.

## Checks to run before opening a PR

```bash
npx tsc --noEmit    # type-check everything
npx expo lint       # must be clean, not just error-free
npx jest            # every test must pass
```

GitHub Actions runs the same checks on every PR, and a merge to `main` ships the app
automatically (an OTA update, or a new preview build when native code changed).

## Backend (deployed by hand)

Nothing here deploys from CI. Run from `mobile/` on an up-to-date `main`:

| What | File | Deploy |
|---|---|---|
| Cloud Functions (LiveKit meeting tokens) | `functions/` | `npx firebase-tools deploy --only functions --project concise-kayak-468613-m9` |
| Firestore composite indexes | `firestore.indexes.json` | `npx firebase-tools deploy --only firestore:indexes --project concise-kayak-468613-m9` |

Firestore and Storage **security rules are managed in the Firebase console** (signed-in
users only), not in this repo — `firebase.json` deliberately has no `rules` entry so a
deploy can never overwrite them. LiveKit secrets setup: [LIVEKIT_SETUP.md](LIVEKIT_SETUP.md).

## Layout

```
app/            Expo Router — every file is a route
src/
  firebase/     app, auth (AsyncStorage persistence), db, storage, functions
  context/      AuthContext — auth state + live profile listener
  hooks/        useAuth
  services/     the layer that replaces "backend routes"
  components/ui/  shared design-system components
  constants/    theme.ts (§13), skills.ts (§6.1), config.ts
  types/        every Firestore document shape (§7)
  utils/        authErrors, validation, date
functions/      Firebase Cloud Functions (LiveKit token)
_tests_/        Jest tests
```

## House rules

1. Edit only your own service file and your own screens. Shared files
   (`src/types/index.ts`, `src/constants/*`, `app/_layout.tsx`,
   `src/components/ui/`) change by PR only, announced in the group chat first.
2. Read another member's collection freely; never write to one you don't own.
3. Every skill tag, category and level comes from `src/constants/skills.ts`.
   Free-typed tags are forbidden.
4. Every colour, spacing, radius and font size comes from `src/constants/theme.ts`.
   No raw hex, pixel or font-size value in any screen file.
5. All writes use `serverTimestamp()`, never `new Date()`.
6. Nobody calls `auth.currentUser`. Use `useAuth()`.

## Component ownership

| # | Component | Owner |
|---|---|---|
| 0 | Authentication & App Shell | whole team (done) |
| 1 | Profile, Skill Portfolio, Credentials & Discovery | Member 1 |
| 2 | Micro-Learning Content & Progress | Member 2 |
| 3 | Peer Sessions — Teach, Book & Schedule | Member 3 |
| 4 | Community & Reputation — Chat, Feed, Reviews | Member 4 |
