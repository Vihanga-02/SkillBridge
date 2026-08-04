# SkillBridge — mobile app

Community skill-exchange and micro-learning app for campus communities (SDG 4 & 8).
React Native (Expo, TypeScript, Expo Router) · Firebase Auth + Firestore + Storage.

See `../SkillBridge-Implementation-Plan-v2.md` for the full plan. This README covers
only what you need to run the project.

## Run it

```bash
npm install
cp .env.example .env        # then paste the six values from the group chat
npx expo start              # scan the QR code with Expo Go
```

`npx expo start -c` clears the Metro cache — use it whenever something looks stale,
and always after editing `.env` (env values are inlined at bundle time).

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
```

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
