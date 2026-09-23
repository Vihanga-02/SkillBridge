# SkillBridge — Implementation Plan v2.4 (Plan + Implementation Tracker)
**SDG 4 & 8 — Community Skill-Exchange & Micro-Learning Mobile App**

Stack: React Native (Expo, TypeScript, Expo Router) · Firebase (Auth + Firestore + Storage) · optional later Cloud Functions + Gemini API
Team: 4 members · Timeline: 8 weeks · Deliverable: Android APK + UX report

---

## 0. What changed from v1

This version merges the three feature lists your group members suggested into the same 4 components, so nobody has to build a 5th component and nothing gets dropped silently.

| Change | Why |
|---|---|
| **Authentication is now a shared foundation, not a member's component** | All 4 components depend on `user.uid`. Built as a team in Week 1 so nobody is blocked. |
| Component 1 absorbed **Skill Portfolio, Experience Level, Skill Categories, Skill Verification Test** | From lists 1, 2 and 3 — all are profile/discovery concerns. |
| Component 2 absorbed **videos, PDFs, quizzes, flashcards, progress tracking** | List 1 & 2 wanted media lessons; list 3 wanted flashcards + progress. Same domain. |
| Component 3 renamed to **Peer Sessions** and absorbed **"Teach a Skill" listings + online sessions + group classes** | List 2 split "Teach a Skill" and "Booking" into two features — they're one flow (create a listing → someone books it). |
| Component 4 absorbed **Community Feed + Ratings/Reviews + Badges** | List 2 & 3 wanted a feed; it shares the same social data layer as chat and reviews. |
| **Auth persistence fixed** | v1's `getAuth(app)` does **not** keep users logged in after closing the app on React Native. See §4.2. |
| **`serverTimestamp()` replaces `new Date()`** | Device clocks lie. Ordering breaks if one phone's clock is off. |
| Added: composite index list, Storage layout, integration contracts, Gemini section, seed script, per-member DoD | These were the gaps that cause week-6 integration pain. |
| **Dropped for good** (state as "future work" in the report) | Admin panel, geolocation events, full credit-based skill exchange economy, offline mode. Too much for 8 weeks with 4 people. |

### Added in v2.1

| Addition | Why |
|---|---|
| **Skill Credentials** — teachers attach certificates / proof to each skill they offer; learners view them before booking (§5.1.1) | Discovery previously gave a learner nothing but a self-declared skill list. Credentials give a real trust signal, and they cost one subcollection + two screens. |
| **UI Design System with a 60:30:10 colour theme** (§13) | Four members building four components independently will produce four different-looking apps unless the palette, spacing and type scale are fixed on day one. This is also directly markable in a UX module. |
| **Complete final folder & file structure** (§14) | Every file that will exist when the project is finished, with its owner — so nobody invents a parallel structure mid-build. |
| Sections 13–20 renumbered to 14–21 | To make room for the design system section. |

### Added in v2.2

| Addition | Why |
|---|---|
| **Career Goals for learners** (§5.1.2) | Learners pick a career path (Software Engineer, Frontend Developer, …) and then choose skills from that goal's curated list. `skillsWanted` / `skillTagsWanted` stay the flat union M2/M3 already read — career goals are the richer source of truth underneath. |
| Shared catalog `src/constants/careerGoals.ts` | Same pattern as `skills.ts` — one file, typed tags, no free text. M2/M3 can later key lesson/session progress off the stable `goal` tag. |
| Discovery browse-by-goal + role filter | Discovery can filter by Category **or** Career goal, and by All / Teachers / Learners (replaces Top-rated / Newest sort). |
| Skill taxonomy trimmed | Languages, Music, Crafts, Fitness removed — catalog focuses on Programming, Design, Business, Academic plus cloud/security/analysis skills that career goals need. |

### Added in v2.3

| Addition | Why |
|---|---|
| **Implementation audit and live tracker** | Separates what is present in the repository from the original target scope, so file existence is not mistaken for a finished feature. |
| **Prioritized remaining-work backlog** | P0/P1/P2 priorities keep release reliability and end-to-end integration ahead of AI and stretch work. |
| **Low-change completeness suggestions** | Adds a few useful polish ideas that do not require a new backend domain or a major architecture change. |

### Added in v2.4

| Addition | Why |
|---|---|
| **Latest merged-development audit** | Updates the tracker after the profile-completeness, sessions/bookings and community/reputation branches were merged into `main`. |
| **Production access controls deferred** | Detailed Firestore/Storage access-control work is no longer part of the active campus-project scope. It can be added later if deployment requirements change. |

---

## Implementation Status — audited 23 September 2026

This section is the current source of truth for progress. Sections 1–21 below remain the **target design and acceptance criteria**. A route or type existing does not count as complete unless the feature is connected to real data and reachable from the UI.

**Legend:** ✅ implemented and wired · 🟡 partially implemented · ⬜ not implemented in this repository · ❓ external Firebase/deployment state cannot be confirmed from the repository

### Audit basis and current health

The audit inspected merged `main` commit `8e26afb`, including `mobile/app`, `mobile/src`, dependencies, tests and repository configuration. It did not assume that Firebase console configuration or a deployed APK exists unless a corresponding tracked file or artefact proves it.

| Check | Result | Notes |
|---|---|---|
| TypeScript | ✅ | `npm run typecheck` passes. |
| ESLint | ✅ | `npm run lint` passes with no reported warnings or errors. |
| Automated tests | 🟡 | 4 suites / 14 tests pass (register, login, deterministic chat ID and profile-completeness rules), including a clean `--detectOpenHandles` run. Coverage is still small for the implemented surface. |
| Source structure | ✅ | 34 route files, 10 service files and the shared theme/types/catalogues are present. |
| Manual UI report | 🟡 | `SCRUM-43_Manual_UI_Test_Report.pdf` exists, but this code audit did not validate its test cases against the current commit. |
| Local Firebase config | ✅ | `.env.example`, Firebase client initialization and persistent React Native auth are present; `.env` is ignored. |
| Release configuration | ⬜ | No `eas.json` or committed APK/build record is present. |

### Component progress summary

| Component | Status | Implemented now | Main remaining work |
|---|---|---|---|
| **0. Auth & app shell** | ✅ | Register, login, reset password, persistent login, live profile context, protected routing, role-aware onboarding, logout and an extra change-password screen. | Add broader integration tests and verify persistence/deep links on a release build. |
| **1. Profile, portfolio & discovery** | 🟡 Near complete | Discovery search/filter/pagination, role and career-goal browsing, public/own profile, profile editing, avatar, skills, career goals, credentials CRUD/viewer, fallback skill tests, profile completeness, public reviews, badges display, lesson cards, Book and Message CTAs. | Add offered sessions inline; add Gemini-generated/cached tests and related-skill suggestions only after core work. |
| **2. Micro-learning** | 🟡 Core flow works | Teacher lesson CRUD, multiple YouTube/PDF items, enrolment, lesson details/viewer, per-item completion, percentage progress, authored/enrolled lesson list and completion counters. | Add text/notes, flashcards, quizzes, practice content, progress dashboard/streak, full feed filters/pagination/refresh and AI generators. |
| **3. Peer sessions** | 🟡 Strong core | Session create/edit/delete-before-booking, browse/detail, teaching requests/schedule/history, calendar, transactional booking, approve/decline/cancel/complete lifecycle, participant messaging, review hand-off, profile stats and teacher credit awards. | Add booked-session cancellation flow, live session subscription, mode/date filters, attendee display, credential deep-link and missing service APIs/tests. |
| **4. Community & reputation** | 🟡 Core flow works | Feed/Chats tabs, real-time chat inbox/thread/read state, participant profile links, text posts with filters/pagination, likes/comments/deletion, review tags/list, learner review transaction and live ratings. | Add teacher-to-learner reviews or formally remove them, moderation, achievement auto-posts and optional images. |
| **Backend, AI & release** | 🟡 Client backend works | Firebase client SDK, service validations, transactions and pagination are implemented. | Create required composite indexes, Gemini proxy/quota layer, seed data, EAS profiles and APK smoke tests. Production access-control hardening is deferred. |

### Detailed tracker — Component 0 and shared foundation

- [x] Email/password registration and login with readable Firebase errors
- [x] Forgot-password email and success state
- [x] AsyncStorage-backed auth persistence
- [x] Live `AuthContext` for Firebase user + Firestore profile
- [x] Protected auth/onboarding/app routes
- [x] Role-aware onboarding with offered skills, optional career goal and wanted skills
- [x] Logout and change-password flow
- [x] Shared theme, skill catalogue, career-goal catalogue, types and reusable UI components
- [ ] Add tests for reset password, onboarding, routing guards, logout, password change and missing-profile recovery
- [ ] Verify cold-start persistence and protected deep links on a physical-device release build

### Detailed tracker — Component 1

- [x] Discovery by name, role, category, career goal, skill and level
- [x] Paginated discovery with loading, empty and error states
- [x] Public profile header, rating, portfolio, goal-grouped wanted skills and badges
- [x] Profile edit with role-gated offered/wanted sections and derived wanted-skill fields
- [x] Avatar upload
- [x] Credential add/edit/delete, public/private visibility, recount, file cleanup and viewer
- [x] Credential image zoom, PDF open and external verification link
- [x] Hardcoded skill-test bank, attempt recording and verified-skill update
- [x] Lessons by a user, lesson enrolment/continue actions, Book and Message CTAs
- [x] Role-aware profile-completeness checklist and next-action CTA in Me (client-derived; no schema change)
- [x] Paginated public reviews with ratings and quick feedback tags
- [ ] Render **sessions offered by this user** inline on the public profile
- [ ] Add Gemini generation/cache for skills outside the fallback bank
- [ ] Add related-skill suggestions only after P0/P1 core scope is complete

### Detailed tracker — Component 2

- [x] Teacher create/edit/delete lesson flow
- [x] Multiple YouTube links and PDF uploads in one lesson
- [x] Browse lesson cards and filter by career goal
- [x] Enrolment plus authored/enrolled lesson management
- [x] YouTube/PDF viewer with per-content completion and percentage progress
- [x] Completion updates lesson count and `users.stats.lessonsCompleted`
- [ ] Add category, skill and level filters, `FlatList` pagination and pull-to-refresh to the lesson feed
- [ ] Add text/notes content and practice exercises
- [ ] Add flashcard editor/viewer with saved card position
- [ ] Add lesson quiz route, scoring/review and quiz-attempt persistence
- [ ] Add progress dashboard: completed skills/lessons, minutes, streak and badges
- [ ] Implement the planned streak update using `lastActiveDate`
- [ ] Add editable AI-generated quiz and flashcard drafts with a manual fallback

### Detailed tracker — Component 3

- [x] Browse/search/category filtering and separate learner/teacher views
- [x] Create online or in-person, one-to-one or group sessions
- [x] Session detail and teacher calendar with marked available dates
- [x] Transactional booking with deterministic one-booking-per-learner ID and seat protection
- [x] Teacher approve/decline and learner cancel actions return seats correctly
- [x] Teacher completion guard and participant-stat updates
- [x] Booking status timeline, location/join-link handling and review CTA
- [x] Edit or delete an open session before any learner books it
- [x] Teaching views for requests, offered sessions, schedule and history
- [x] Message the teacher or learner from booking detail using deterministic direct chat
- [x] Award the teacher five Skill Credits after a completed booking
- [ ] Add a cancellation flow for a session that already has bookings, including participant handling
- [ ] Add mode and date filters promised by the session browser
- [ ] Add a live `subscribeToSession` path so seats/status update without a manual reload
- [ ] Show attendee avatars/count in session detail
- [ ] Show teacher credential count and deep-link to the profile credential section
- [ ] Add the missing `getBookingsForSession` / reusable busy-date API and concurrency tests
- [ ] Confirm the `sessionSecrets` flow never exposes an online meeting link before booking approval

### Detailed tracker — Component 4

- [x] Deterministic direct-chat creation from a public profile
- [x] Live text-message subscription and listener cleanup
- [x] Parent chat preview/unread counters updated with each message
- [x] Learner-to-teacher review after a completed booking
- [x] Transactional rating aggregate and duplicate-review prevention
- [x] Feed/Chats community tabs with loading, empty and error states
- [x] Real-time chat inbox sorted by latest message, unread badges and `markChatRead`
- [x] Link the other participant's chat header to their profile
- [x] Review tags, paginated review queries/list UI and the public-profile reviews section
- [x] Text post composer, filtered/paginated feed, post detail, likes, comments and author deletion
- [ ] Decide explicitly whether teacher-to-learner reviews remain in scope; implement them or update the target model/UI to learner-only reviews
- [ ] Auto-create an achievement post when a learner completes a lesson, if this integration remains in scope
- [ ] Add moderation for posts/chat before claiming the Gemini safety feature
- [ ] Add chat/post image uploads only after the text-only community flow is stable

### Cross-cutting, backend and release tracker

- [x] Shared 60:30:10 palette and typography are used across the app; the only screen-file hex is inside isolated YouTube player HTML
- [x] Firestore writes use `serverTimestamp()`; JavaScript `Date` is used only for local parsing/comparison/display
- [x] Core credentials, lesson progress, booking and rating operations use transactions/batches where consistency matters
- [ ] Finish the strict theme-token audit: discovery and the shared Chip still contain a few raw numeric size/padding values
- [ ] Add `firestore.indexes.json`; remove query fallbacks once required indexes are deployed
- [ ] Complete the remaining integration contracts in §6, especially inline profile sessions and achievement posts
- [ ] Add unit/service tests for credentials, lessons, bookings, ratings, posts and chats
- [ ] Add `scripts/seed.js` (the current `scripts/` directory is empty)
- [ ] Add `eas.json`, perform an Android preview build and smoke-test the APK on a real phone
- [ ] Rehearse and record the full §15 demo journey using seeded data
- [ ] Build the Gemini proxy and quota/cache layer only after the non-AI core journey passes
- [ ] Keep push notifications and the credits leaderboard as stretch goals, not blockers; the base teacher credit award is complete

### Prioritized remaining-work backlog

| Priority | Work package | Completion evidence |
|---|---|---|
| **P0 — complete the user journey** | Inline profile sessions and handling cancellation of a session that already has bookings | A user can inspect every teacher offering and no participant is left with an active booking for a cancelled session. |
| **P0 — demo reliability** | Seed script, EAS preview configuration, APK/device smoke test | Fresh demo data can be restored and the same build completes the demo journey on a real phone. |
| **P1 — planned learning scope** | Quiz, flashcards, progress dashboard/streak and feed filters/pagination | A learner can consume each advertised lesson format and see durable progress. |
| **P1 — community completion** | Achievement auto-post integration and final decision on teacher-to-learner reviews | Advertised reputation/community behavior matches the implemented UI and report. |
| **P1 — Firestore queries** | Create the composite indexes required by public reviews, filtered posts and ordered lists | All production queries work without temporary client-side fallbacks. |
| **P1 — confidence** | Service, transaction and component tests | Critical concurrency cases run automatically, including two learners competing for the last seat. |
| **P2 — AI** | Gemini proxy, quota/cache, generated tests/quizzes/flashcards, session drafting and moderation | No key ships in the app; offline/manual fallbacks remain usable. |
| **P2 — stretch** | Notifications and the remaining leaderboard UI (teacher credit awards are already implemented) | Attempt only when every P0 and P1 acceptance journey is stable. |

### Small completeness improvements not in the remaining plan

These are deliberately low-change additions. Do not start them before P0 work.

1. **Help, safety and privacy screen** — add one static route linked from the registration terms text and Me tab. Explain self-declared credentials, community conduct, privacy and how to report a problem. This closes the current dead-end T&C checkbox without a new backend.
2. **Native Share actions** — use React Native's built-in `Share` API on profiles, lessons and sessions. It needs no new collection and makes recruitment/demo sharing much easier.
3. ✅ **Profile-completeness checklist (implemented)** — derived client-side from avatar, bio, location, role-relevant offered/wanted skills and credentials; Me shows progress, checklist state and the next useful action. No schema change was required.
4. **Session timezone and copy-details action** — display the device timezone beside session time and let users copy/share date, location or meeting details. This avoids campus-demo confusion with little code.
5. **In-app “What does verified mean?” explainer** — reuse the existing distinction between skill tests and self-declared credentials in a small modal/notice reachable from badges.

**Scope guard:** saved items, blocking/report workflows, account deletion, calendar sync and offline downloads sound small but require new data lifecycle, permissions or moderation decisions. Treat them as future work unless all planned core features are already complete.

---

## 1. Component Ownership (Final)

| # | Component | Owner | UX Role | Primary collections |
|---|---|---|---|---|
| **0** | **Authentication & App Shell** | **All 4 (Week 1, pair-programmed)** | — | `users` |
| 1 | User Profile, Skill Portfolio & Discovery | Member 1 | UX Researcher / Information Architect | `users`, `users/{uid}/credentials`, `skillTests` |
| 2 | Micro-Learning Content & Progress | Member 2 | Interaction Designer | `lessons`, `lessonProgress` |
| 3 | Peer Sessions — Teach, Book & Schedule | Member 3 | UI Designer / Prototyping Lead | `sessions`, `bookings` |
| 4 | Community & Reputation — Chat, Feed, Reviews | Member 4 | Usability Evaluator | `chats`, `messages`, `posts`, `reviews` |

**Rules of engagement (agree on this in Week 1 — it prevents 80% of merge conflicts):**
1. You may only edit **your own** service file and **your own** screens.
2. Shared files (`src/types/index.ts`, `src/constants/skills.ts`, `src/constants/careerGoals.ts`, `src/constants/theme.ts`, `app/_layout.tsx`, `src/components/ui/`) change **only via Pull Request**, and you post in the group chat before merging.
3. If you need data another member owns, you **read** their collection directly (Firestore has no joins — reading is fine). You never **write** to a collection you don't own, except through the owner's service function.
4. Never rename a Firestore field after Week 2 without telling the team. There is no compile-time check — a typo just silently returns zero results.

---

## 2. Tech Stack & Dependencies

### 2.1 Install list

```bash
npx create-expo-app@latest mobile --template default   # TypeScript + Expo Router pre-configured
cd mobile

# Firebase
npm install firebase
npm install @react-native-async-storage/async-storage   # REQUIRED for auth persistence

# Feature libraries
npx expo install expo-image-picker         # avatars, credential photos, lesson images, post images
npx expo install expo-document-picker      # lesson PDFs, credential PDFs
npx expo install expo-video                # lesson video playback
npx expo install expo-linking expo-web-browser  # opening Zoom/Meet links
npm install react-native-calendars         # booking calendar
npm install react-native-gifted-chat       # chat + AI assistant UI
npm install date-fns                       # date formatting/relative time

# Stretch goal only (Week 7+, skip for now)
# npx expo install expo-notifications expo-device
```

> Use `npx expo install` (not `npm install`) for any package with native code — it picks the version that matches your Expo SDK. Use plain `npm install` for pure-JS packages.

### 2.2 Why this stack

- **Expo managed workflow** — no Android Studio / Xcode needed, everyone tests on their own phone via Expo Go.
- **Expo Router** — file-based routing, identical mental model to Next.js `app/`.
- **Firebase instead of Express + PostgreSQL** — this module is graded on UX. Firebase removes server hosting, ORM, and migrations, while the client service layer keeps validation and transactions in one place for this campus prototype.
- **One Cloud Function only** (for Gemini) — see §11. Everything else runs client-side through the service layer.

### 2.3 Prerequisites checklist

| Tool | Check |
|---|---|
| Node.js LTS v20+ | `node -v` |
| Git + GitHub account (all 4 members) | `git -v` |
| VS Code | — |
| Expo Go on your phone | Play Store / App Store |
| Google account (for Firebase + Gemini) | — |
| Same Wi-Fi network as your laptop | required for Expo Go |

---

## 3. Firebase Project Setup (Week 1, Day 1 — do once, together)

1. Firebase Console → **Add project** → name `skillbridge-app`. Disable Google Analytics (not needed).
2. **Authentication** → Get started → Sign-in method → enable **Email/Password**.
3. **Firestore Database** → Create → **Start in test mode** → region `asia-south1` (Mumbai — lowest latency from Sri Lanka).
4. **Storage** → Get started → test mode → same region.
5. **Project settings → General → Your apps → Web app (`</>`)** → register app `skillbridge-mobile` → copy the config object.
6. **Project settings → Users and permissions** → add all 4 member Google accounts as **Editor**, so everyone sees the same live data in the console.
7. Create **one shared `.env`** (pinned in your group chat, never committed) so all 4 members hit the same project.

> Before the final demonstration, confirm that the shared Firebase project still permits the reads, writes and uploads used by the app. Production access-control hardening is deferred from the current campus-project scope (§9).

**`.env`** (add to `.gitignore` immediately):
```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=skillbridge-app.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=skillbridge-app
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=skillbridge-app.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

Also commit a **`.env.example`** with the keys but blank values, so a new machine knows what's needed.

---

## 4. Component 0 — Authentication & App Shell (SHARED, Week 1)

**Owner: whole team.** This is the only part everyone builds together, because every other component calls `useAuth()`.

### 4.1 Scope

| Feature | Included in v2? |
|---|---|
| Email + password sign up | ✅ |
| Email + password login | ✅ |
| Forgot password (reset email) | ✅ — 3 lines of code, looks great in the demo |
| Persistent login (stay logged in after closing app) | ✅ |
| Onboarding wizard after signup (name → role → skills offered → skills wanted) | ✅ |
| Logout | ✅ |
| Protected routing (can't reach tabs while logged out) | ✅ |
| Google / Facebook sign-in | ❌ — needs OAuth config + a dev build, not worth the time |
| Email verification enforcement | ❌ — mention as future work |

### 4.2 `src/firebase/config.ts` — the persistence fix

```ts
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// initializeAuth + AsyncStorage persistence — NOT getAuth(app).
// With plain getAuth(), the user is logged out every time the app restarts.
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export default app;
```

> **Troubleshooting:** if TypeScript can't find `getReactNativePersistence`, add `// @ts-ignore` above the import — the runtime export exists even when the types lag behind. If `onSnapshot` listeners hang forever on a campus/hostel network, swap `getFirestore(app)` for
> `initializeFirestore(app, { experimentalForceLongPolling: true })`.

### 4.3 `src/services/authService.ts`

```ts
import { auth, db } from '../firebase/config';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail, updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function register(email: string, password: string, name: string) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: name });

  // Create the Firestore profile immediately — every other component assumes it exists.
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    name,
    nameLower: name.toLowerCase(),      // enables prefix search in Component 1
    email: email.trim(),
    role: 'both',
    bio: '',
    avatarUrl: '',
    location: '',
    skillsOffered: [],
    skillTagsOffered: [],               // flat array — the only field array-contains can query
    careerGoals: [],                    // learner source of truth — see §5.1.2
    extraSkillsWanted: [],              // wanted skills with no goal attached
    skillsWanted: [],                   // DERIVED union of careerGoals + extraSkillsWanted
    skillTagsWanted: [],                // DERIVED — M2/M3 read this, never write it
    verifiedSkills: [],
    credentialCount: 0,                 // denormalized count of the credentials subcollection
    ratingAvg: 0,
    ratingCount: 0,
    credits: 10,                        // welcome credits (stretch goal hook)
    badges: [],
    stats: { sessionsTaught: 0, sessionsAttended: 0, lessonsCompleted: 0 },
    onboardingComplete: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return cred.user;
}

export const login = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email.trim(), password);

export const logout = () => signOut(auth);

export const resetPassword = (email: string) =>
  sendPasswordResetEmail(auth, email.trim());
```

**Map Firebase error codes to human messages** in one shared helper — `auth/invalid-credential` must never be shown raw to a user in a UX-graded module:

```ts
// src/utils/authErrors.ts
export const authErrorMessage = (code: string) => ({
  'auth/email-already-in-use': 'That email is already registered. Try logging in.',
  'auth/invalid-email':        'Please enter a valid email address.',
  'auth/weak-password':        'Password must be at least 6 characters.',
  'auth/invalid-credential':   'Email or password is incorrect.',
  'auth/network-request-failed':'No internet connection. Please try again.',
}[code] ?? 'Something went wrong. Please try again.');
```

### 4.4 `src/context/AuthContext.tsx`

Exposes `{ firebaseUser, profile, loading, refreshProfile }`. It listens to **two** things:
- `onAuthStateChanged(auth, ...)` — is someone logged in?
- `onSnapshot(doc(db,'users',uid), ...)` — live profile, so a name/avatar change reflects instantly everywhere.

```ts
const { profile, loading } = useAuth();   // every screen uses this
```

### 4.5 Protected routing in `app/_layout.tsx`

```
loading            → <SplashScreen />
no user            → redirect to /(auth)/login
user + !onboardingComplete → redirect to /(auth)/onboarding
user + onboardingComplete  → redirect to /(tabs)/discovery
```

### 4.6 Screens

| Route | Contents |
|---|---|
| `app/(auth)/login.tsx` | Email, password, "Forgot password?", link to register |
| `app/(auth)/register.tsx` | Name, email, password, confirm password, T&C checkbox |
| `app/(auth)/forgot-password.tsx` | Email → `resetPassword()` → success state |
| `app/(auth)/onboarding.tsx` | Wizard: role → (skills offered) → (**career goal**) → (skills wanted from that goal, or flat picker if skipped). Sets `onboardingComplete: true`. Role gates which steps appear. |

---

## 5. The Four Components — Full Detail

### 5.1 Component 1 — User Profile, Skill Portfolio & Discovery (Member 1)

**Covers from the group's lists:** Smart User Profiles · Skill Portfolio · Skills offered/wanted · **Career Goals** · Experience level · Skill Listing & Discovery · Skill Marketplace (browse/search/filter by category, career goal & difficulty) · Skill Assessment / Verification Test · **Skill Credentials (certificates & proof)** · Achievement badges (display only).

#### Screens

| Route | What it does |
|---|---|
| `app/(tabs)/discovery.tsx` | **Home of the app.** Search bar (by name) + **Show: All / Teachers / Learners** + **Browse by: Category \| Career goal** chip rows + skill drill-down + difficulty filter. `FlatList` of `UserCard`s. Empty state + skeleton loaders. |
| `app/user/[id].tsx` | Public profile: avatar, name, bio, location, rating stars, verified-skill badges, skills offered (with level chips), **Credentials grouped by skill**, **skills wanted grouped by career goal** (plus an "Other skills" tail), achievement badges, **Reviews list** (owned by M4), **Lessons by this user** (owned by M2), **Sessions offered** (owned by M3), and two CTA buttons: **Book a session** → M3, **Message** → M4. |
| `app/profile/edit.tsx` | Edit name, bio, location, role, avatar upload, skills offered with level picker, **career goals** (add / edit skills per goal / remove) + **other skills wanted** (no-goal bucket). Role gates teach vs learn sections. |
| `app/(auth)/onboarding.tsx` | Wizard: role → (skills offered, if can teach) → (**career goal**, if can learn) → (skills wanted from that goal, or flat picker if skipped). |
| `app/profile/credentials/index.tsx` | **My Credentials** — the teacher's own manage list, grouped by skill. Add / edit / delete, visibility toggle, recount action. Only reachable when `role` is `teacher` or `both`. |
| `app/profile/credentials/add.tsx` | Add or edit one credential: type, title, issuer, the skill it backs, dates, reference number, verification URL, file upload. |
| `app/credential/[id].tsx` | **Credential viewer** — full screen. Images pinch-to-zoom; PDFs open in `WebBrowser`. Shows issuer, dates, reference number, and an "Open verification link" button when one was supplied. This is the screen learners land on. |
| `app/profile/skill-test/[skill].tsx` | Skill Verification Test: 3–5 questions for that skill, submit answers, get pass/fail, on pass adds the skill to `verifiedSkills`. Questions generated by Gemini (§11) with a hardcoded fallback bank for the top 8 skills so the demo never depends on the network. |
| `app/(tabs)/me.tsx` *(optional 5th tab)* | Own profile shortcut + Logout + links to My Bookings / My Lessons / My Credentials. Can also live as a header avatar button. |

#### `src/services/userService.ts`

```ts
getUser(uid): Promise<User | null>
subscribeToUser(uid, cb): Unsubscribe            // live profile
updateProfile(uid, partial): Promise<void>       // always sets updatedAt: serverTimestamp()
uploadAvatar(uid, localUri): Promise<string>     // → Storage, returns download URL
searchUsersBySkill(skillTag, opts?): Promise<UserPage>
searchUsersByName(prefix): Promise<UserPage>     // nameLower >= p, nameLower <= p+''
listUsersByCategory(category): Promise<UserPage>
listUsersByCareerGoal(goalTag): Promise<UserPage> // array-contains-any over skillsInGoal(goalTag)
searchUsers(filters): Promise<UserPage>          // one entry for Discovery
setSkillsOffered(uid, drafts): Promise<void>     // replaces whole offered set + skillTagsOffered
setCareerGoals(uid, goals, extraSkillsWanted): Promise<void>
  // writes careerGoals + extraSkillsWanted AND the derived skillsWanted / skillTagsWanted
deriveWantedSkills(careerGoals, extraSkillsWanted)  // pure helper — also used by authService
markSkillVerified(uid, skill): Promise<void>     // arrayUnion into verifiedSkills
saveTestAttempt(uid, skill, questions, answers, score, passed): Promise<string>
```

**Critical data-model detail:** Firestore's `array-contains` only matches whole array elements. You cannot query inside an array of objects. So store skills **twice**:
- `skillsOffered: { skill, label, level, verified, credentialCount }[]` — for **display**
- `skillTagsOffered: string[]` (lowercase, e.g. `["python","photoshop"]`) — for **querying**

Both are updated in the same `updateDoc` call. Every other component queries the flat array.

**Wanted skills are derived, not hand-edited** — see §5.1.2. M2 and M3 keep reading `skillsWanted` / `skillTagsWanted` exactly as before.

---

### 5.1.1 Skill Credentials — proof attached to each skill a teacher offers

**The problem this solves:** until now Discovery showed a learner nothing but a self-declared skill list — anyone could type "I teach Python". Credentials let a teacher attach a certificate, transcript, course completion, award or portfolio link **to a specific skill**, and let a learner inspect that evidence before spending an hour of their time on a session.

#### Who sees what

| Role | Behaviour |
|---|---|
| `role: 'teacher'` or `'both'` | Sees **My Credentials** in the profile menu and the **+ Add credential** button. Can add, edit, delete and hide their own. |
| `role: 'learner'` | The whole management section is hidden. If they switch role in `profile/edit`, it appears — gate on the **live** `profile.role` from `useAuth()`, not on a value captured once at mount. |
| **Any signed-in user** | Can **view** another user's public credentials on `user/[id]` and open the full viewer. That is the entire point of the feature. |

#### Data placement — a subcollection, not an array on the user doc

`users/{uid}/credentials/{credentialId}`. This is a deliberate choice and worth being able to justify in the viva:

- **The user document is the hottest read in the app.** Every Discovery card, every lesson author, every session card reads it. Adding an array of certificate metadata and URLs would slow the most-read document in the project down, for data needed on exactly one screen.
- **Ownership is clear from the path** — credential service calls always use `users/{uid}/credentials/...`, so the owner UID is explicit and no separate `ownerId` field can drift out of sync.
- **Documents can be added and removed independently.** Two rapid writes to the same array can clobber each other; two writes to different subcollection documents cannot.
- **The cost is one extra query on one screen.** The profile is already doing four reads; a fifth is free.

#### Two different trust signals — do not merge them in the UI

| Signal | Where it comes from | What it actually means |
|---|---|---|
| **Verified skill badge** (`verifiedSkills`) | The user passed SkillBridge's own AI-generated skill test | *The app tested them.* |
| **Credential** (this feature) | The teacher uploaded a document and typed its details | *They claim it and supplied evidence — the learner judges it.* |

Render them differently: a filled ✔ badge for the app-verified one, an outlined document chip for a credential. Label credentials **"Self-declared"** in the viewer. There is no admin panel in scope to approve them, so the app must never imply it verified something it didn't. State this in the report; admin or peer verification is named as future work.

#### `src/services/credentialService.ts` (Member 1)

```ts
listCredentials(uid): Promise<Credential[]>                  // orderBy skillTag, then issueDate desc
listCredentialsBySkill(uid, skillTag): Promise<Credential[]>
getCredential(uid, credentialId): Promise<Credential | null>

addCredential(uid, data, fileUri?): Promise<string>
  // 1. create the doc first, to get an id
  // 2. upload the file to credentials/{uid}/{credentialId}.{ext}
  // 3. patch the doc with fileUrl + filePath + fileType + fileSizeBytes
  // 4. increment users/{uid}.credentialCount and the matching skillsOffered[].credentialCount

updateCredential(uid, credentialId, partial): Promise<void>

deleteCredential(uid, credentialId): Promise<void>
  // delete the Storage file FIRST, then the doc, then decrement the counters —
  // in that order, so a partial failure never leaves a doc pointing at a missing file

toggleVisibility(uid, credentialId): Promise<void>           // 'public' ↔ 'private'
recountCredentials(uid): Promise<void>                       // repair action, see below
```

#### Form fields and validation (`credentials/add.tsx`)

| Field | Required | Validation |
|---|---|---|
| Skill it backs | ✅ | Must be one of the user's **own** `skillTagsOffered` — a picker, never free text. If they have no skills yet, show an empty state that routes them to `profile/edit` first. |
| Type | ✅ | `certificate` · `degree` · `course` · `award` · `work_experience` · `portfolio` · `other` |
| Title | ✅ | 3–120 chars — e.g. "Google IT Support Professional Certificate" |
| Issuer | ✅ | 2–80 chars — e.g. "Coursera / Google" |
| Issue date | ✅ | Cannot be in the future |
| Expiry date | ❌ | Must be after the issue date. If it's already past, show an "Expired" chip — don't hide the credential, just mark it. |
| Reference / certificate number | ❌ | Free text |
| Verification URL | ❌ | Must start with `https://`. Rendered as an "Open verification link" button in the viewer. |
| Description | ❌ | Max 300 chars |
| File (image or PDF) | ❌ but strongly encouraged | ≤ 5 MB either way. A credential with no file shows a "No document attached" state — which is itself useful information for the learner. |
| Visibility | defaults to `public` | `private` credentials are visible only to the owner |

#### Denormalized counters — so lists never touch the subcollection

- **`users.credentialCount`** — one number on the user doc, so a Discovery card can show a "📄 3" chip with no extra read.
- **`skillsOffered[].credentialCount`** — per-skill, so a skill chip can render "Python · 2 certificates" before the subcollection query even resolves.

Both are written in the same operation that adds or deletes a credential. Like every denormalized value in this project they can drift if a write half-fails, so `recountCredentials(uid)` — read the subcollection, rewrite both counters — is exposed as a quiet "Recount" action in the owner's own list. Two lines of code, and it saves a confusing demo.

#### What the learner actually sees on `user/[id].tsx`

Credentials are grouped **under the skill they back**, never as one flat list — that grouping *is* the design intent. A learner looking at a Python teacher sees:

```
Python  ·  Advanced  ·  ✔ Verified by test  ·  📄 2
   ├── Google IT Support Professional Certificate — Coursera · 2025
   └── BSc Computer Science — University of Colombo · 2024

Photoshop  ·  Intermediate  ·  📄 0
   └── No credentials added
```

Tapping a row opens `credential/[id]`. Skills with zero credentials still appear with a quiet empty line — absence is information too, and hiding it would mislead.

#### Storage

`credentials/{uid}/{credentialId}.{jpg|png|pdf}` — 5 MB cap enforced client-side **before** the upload starts. Use `expo-image-picker` for a photo of a certificate and `expo-document-picker` for a PDF; both are already in the dependency list for other components, so this feature adds nothing new to install.

#### Optional AI hook

Gemini 2.5 Flash accepts images. A "Scan certificate" action could send the photo and get back `{ title, issuer, issueDate }` as JSON to pre-fill the form. Genuinely nice, but it means pushing image bytes through the Cloud Function — so it's listed as feature #7 in §11.3 and should only be attempted after the six text-only AI features work.

---

#### Search implementation reality check
Firestore has no full-text search. Your search bar does:
- **Skill search** → `where('skillTagsOffered', 'array-contains', tag)` — exact tag match, driven by chips, not free typing.
- **Name search** → prefix range query on `nameLower`. "cha" finds "Chamath" but "math" does not.
Document this limitation in the report and note Algolia/Typesense as future work. Making the search UI **chip-driven** rather than free-text is both the honest fix and better UX.

#### Storage
`avatars/{uid}.jpg` — resize with `expo-image-picker`'s `quality: 0.5` and `allowsEditing: true, aspect: [1,1]` before upload. Overwrite the same path so old avatars don't accumulate.

---

### 5.1.2 Career Goals — the layer on top of "skills to learn"

**The problem this solves:** a flat "pick skills you want to learn" list gives learners no direction. Career goals let a learner say "I want to become a Software Engineer" and then pick from a curated skill curriculum for that path. Teachers who offer any of those skills still surface in Discovery — the same skill can back multiple goals (e.g. `sql` appears under Software Engineer, Backend Developer, Business Analyst and Data Scientist).

#### Why this shape (not a rewrite of wanted-skills)

Integration contract #13 already tells M2 (lessons) and M3 (sessions) they can default their filters to the learner's `skillsWanted` / `skillTagsWanted`. Those fields **must keep meaning "everything this learner wants to learn"** or that contract breaks silently. So:

| Field | Who edits it | Meaning |
|---|---|---|
| `careerGoals[]` | Learner (onboarding + profile edit) | Source of truth — one entry per goal, with the subset of that goal's skills they chose |
| `extraSkillsWanted[]` | Learner | Source of truth — skills wanted with **no** goal attached (hybrid model) |
| `skillsWanted` / `skillTagsWanted` | **Never hand-edited** — recomputed by `deriveWantedSkills` on every write | Flat union M2/M3 already expect |

```
careerGoals[].skillTags  ──┐
                           ├──► deriveWantedSkills() ──► skillsWanted / skillTagsWanted
extraSkillsWanted[]      ──┘
```

Teach-only flows (`role: 'teacher'`) never see goal or wanted-skill UI. Learner-only flows never see skills-offered UI. `role: 'both'` sees both.

#### Shared catalog — `src/constants/careerGoals.ts`

Same pattern as `skills.ts`: a const array + typed `CareerGoalTag` + helpers. **No free-typed goal names.** Adding an 11th goal later is a one-line entry.

| Goal tag | Skills (subset of `skills.ts`) |
|---|---|
| `software-engineer` | html-css, javascript, python, java, sql, git, data-structures-algorithms, rest-apis, system-design |
| `frontend-developer` | html-css, javascript, react, git, ui-ux, figma |
| `backend-developer` | python, java, sql, rest-apis, system-design, git, docker-devops |
| `cloud-engineer` | cloud-computing, linux, networking, docker-devops, python, system-design |
| `ui-ux-designer` | figma, ui-ux, photoshop, illustrator, video-editing |
| `business-analyst` | business-analysis, sql, excel, digital-marketing, public-speaking, research-writing |
| `data-scientist` | python, sql, mathematics, machine-learning, excel, research-writing |
| `project-manager` | project-management, public-speaking, excel, entrepreneurship, digital-marketing |
| `cybersecurity-engineer` | cybersecurity, networking, linux, python, cloud-computing |
| `network-engineer` | networking, linux, cloud-computing, cybersecurity, system-design |

Helpers: `careerGoalByTag(tag)`, `goalLabel(tag)`, `skillsInGoal(tag)`.

#### Document shape on `users/{uid}`

```ts
type CareerGoal = {
  goal: CareerGoalTag;   // stable key — M2/M3 can later key progress off this
  label: string;         // denormalized display label from the catalog
  skillTags: SkillTag[]; // the subset of skillsInGoal(goal) the learner actually picked
};
```

A user has **at most one entry per goal tag** (same uniqueness pattern as `skillsOffered[].skill`).

#### Onboarding flow

Steps: `role` → (`offered`, if can teach) → (`goal`, if can learn) → (`wanted`, if can learn).

- **Goal step:** single-select cards from `CAREER_GOALS` + "Skip — I'll add a goal later" (hybrid model allows zero goals).
- **Wanted step:** if a goal was picked, show only that goal's skills + "Select all". If skipped, fall back to the category-filtered flat picker — those tags go into `extraSkillsWanted`.
- `completeOnboarding` calls `deriveWantedSkills` so the flat fields are correct from day one.

#### Profile edit

- **Career goals** — a card per entry (label + chosen skill chips + Edit skills / Remove). "+ Add a career goal" opens the goal's full skill multi-select + Select all.
- **Other skills you want to learn** — flat chip picker scoped to `extraSkillsWanted` only.
- Save calls `setCareerGoals(uid, draftGoals, draftExtra)` — never `setSkillsWanted` directly (that helper no longer exists as a public write path).

#### Discovery

- **Show:** All / Teachers / Learners (Teachers = `teacher` + `both`; Learners = `learner` + `both`). Replaces the old Top-rated / Newest sort toggle.
- **Browse by:** Category | Career goal — mutually exclusive at the UI. Career-goal mode shows the 10 goal chips, then that goal's skills as a second row (mirrors category → skill drill-down). `listUsersByCareerGoal` runs `array-contains-any` on `skillTagsOffered` against `skillsInGoal(goalTag)`.

#### What M2 / M3 need to know

- **Keep reading `skillsWanted` / `skillTagsWanted`.** No change required for default filters (contract #13).
- **Optional later:** key lesson/session progress or "path" UI off `careerGoals[].goal`. The tag is stable and comes from `careerGoals.ts` — do not invent parallel IDs.
- **Do not write** `careerGoals`, `extraSkillsWanted`, `skillsWanted`, or `skillTagsWanted`. Member 1 owns those writes via `setCareerGoals` / `completeOnboarding`.

---

### 5.2 Component 2 — Micro-Learning Content & Progress (Member 2)

**Covers from the group's lists:** Micro-Learning Content · 5–15 minute lessons · Videos · PDFs · Notes · Interactive quizzes · Flashcards · Practice exercises · Progress tracking · Skills completed / hours learned / streak.

#### Screens

| Route | What it does |
|---|---|
| `app/(tabs)/feed.tsx` | Lesson feed: category chips + skill-tag filter + level filter. `FlatList` of `LessonCard` (thumbnail, title, author, duration, format badge, level). Pull-to-refresh + pagination (`limit(10)` + `startAfter`). |
| `app/lesson/[id].tsx` | Lesson viewer — renders by `format`: `text` → scrollable article; `flashcards` → swipeable card deck with flip animation; `video` → `expo-video` player; `pdf` → open in `WebBrowser`. "Mark complete" button at the end. |
| `app/lesson/[id]/quiz.tsx` | Quiz runner: one question per screen, MCQ options, progress bar, score screen with correct/incorrect review. Pass ≥ 60% → writes `lessonProgress` as completed. |
| `app/lesson/create.tsx` | Create lesson: title, description, category + skill tag pickers, level, format picker, duration, content editor / media upload, optional **"Generate quiz with AI"** and **"Generate flashcards with AI"** buttons (§11). |
| `app/lesson/my-lessons.tsx` | Lessons I authored (edit/delete) + lessons I'm learning (with % progress). |
| `app/progress.tsx` | Progress dashboard: skills completed, lessons completed, total minutes learned, current streak, badges earned. |

#### `src/services/lessonService.ts`

```ts
getLessons({ category?, skillTag?, level?, pageSize, cursor? }): Promise<{ items: Lesson[]; cursor }>
getLesson(id): Promise<Lesson | null>
getLessonsByOwner(uid): Promise<Lesson[]>        // ← used by Component 1's profile screen
createLesson(data): Promise<string>
updateLesson(id, partial) / deleteLesson(id)     // delete must also delete Storage files
uploadLessonMedia(lessonId, localUri, kind): Promise<{ url, path, sizeBytes }>
incrementViewCount(id): Promise<void>            // increment(1)

// progress
startLesson(uid, lesson): Promise<void>
saveCardPosition(uid, lessonId, index): Promise<void>
completeLesson(uid, lesson, quizScore?): Promise<void>   // updates streak + users.stats
getMyProgress(uid): Promise<LessonProgress[]>
getProgressSummary(uid): Promise<{ completed, minutes, streak, skills }>
```

#### Media / Storage rules of thumb
- Path: `lessons/{lessonId}/{filename}` — always store the `storagePath` in the doc so delete works.
- **Images:** compress to `quality: 0.6`, cap ~2 MB.
- **PDFs:** cap 10 MB.
- **Video:** cap **50 MB / 3 minutes** and enforce it client-side before upload. Firebase Storage free tier is 5 GB stored / 1 GB downloaded per day — four members testing 100 MB videos will burn that in a week. If time is short, **make video "link only"** (paste a YouTube URL) and put real video upload in future work.
- Generate a `thumbnailUrl` for video by asking the uploader to also pick a cover image — no server-side transcoding available.

#### Streak logic (keep it simple)
On `completeLesson`, compare `lastActiveDate` on the user doc to today: same day → no change; yesterday → `streak + 1`; older → reset to 1.

---

### 5.3 Component 3 — Peer Sessions: Teach, Book & Schedule (Member 3)

**Covers from the group's lists:** Teach a Skill (create/manage listings with description, schedule, format) · Online Learning Session · Learning Requests & Session Booking · One-to-one mentoring · Group classes · Live workshops · Q&A sessions.

#### The two-document model (this is the key design decision)

- **`sessions/{sessionId}`** = a teacher's **offer** ("Python Basics, Sat 3pm, online, 5 seats").
- **`bookings/{bookingId}`** = a learner's **claim on a seat** in that session.

One session can have many bookings (group class) or exactly one (`capacity: 1`, one-to-one). This cleanly covers both "Teach a Skill" and "Booking" from your group's list without two components.

#### Screens

| Route | What it does |
|---|---|
| `app/(tabs)/sessions.tsx` | Two tabs: **Browse** (upcoming open sessions, filter by skill/category/mode/date) and **My Sessions** (as teacher: sessions I host + pending requests to approve; as learner: my bookings with status badges). |
| `app/session/create.tsx` | Create/edit a session: title, description (**"Draft with AI"** button — §11), skill tag, level, mode (online/in-person), meeting link or location, date+time picker, duration, type (1-to-1 / group), capacity, optional cover image. |
| `app/session/[id].tsx` | Session detail: teacher card, full description, when/where, seats left, attendee avatars, **Request to Book** button (or Cancel if already booked). |
| `app/booking/calendar.tsx` | `react-native-calendars` month view with dots on days that have sessions; tap a day → list of that day's sessions/bookings. |
| `app/booking/[id].tsx` | Booking detail: status timeline (pending → confirmed → completed), Join link button (online) or map/location text, teacher actions (Approve / Decline / Mark completed), learner actions (Cancel), **Message teacher** → M4, and after completion a **Leave a review** button → M4. |

#### `src/services/sessionService.ts` + `bookingService.ts`

```ts
// sessions
createSession(data): Promise<string>
updateSession(id, partial) / cancelSession(id)
getSession(id) / subscribeToSession(id, cb)
listUpcomingSessions({ skillTag?, category?, mode?, fromDate?, pageSize, cursor? })
getSessionsByTeacher(uid)                 // ← used by Component 1's profile screen

// bookings
requestBooking(session, learnerProfile, note?): Promise<string>   // transactional, see below
approveBooking(bookingId) / declineBooking(bookingId, reason?)
cancelBooking(bookingId, byUid)
markCompleted(bookingId)                  // teacher only — unlocks reviews for BOTH sides
getMyBookings(uid): Promise<Booking[]>    // one query, thanks to participantIds
subscribeToMyBookings(uid, cb): Unsubscribe
getBookingsForSession(sessionId)
getBusyDates(teacherUid, month): Promise<string[]>   // powers the calendar dots
```

**`requestBooking` must be a transaction** — this is the one piece of genuine concurrency logic in the whole app, and it's worth calling out in your report:

```ts
export async function requestBooking(session: Session, learner: User, note = '') {
  const bookingRef = doc(collection(db, 'bookings'));

  await runTransaction(db, async (tx) => {
    const sRef = doc(db, 'sessions', session.id);
    const snap = await tx.get(sRef);                    // ALL reads before ANY write
    if (!snap.exists()) throw new Error('Session no longer exists.');

    const s = snap.data();
    if (s.status !== 'open')        throw new Error('This session is closed.');
    if (s.seatsTaken >= s.capacity) throw new Error('This session is full.');
    if (s.teacherId === learner.uid) throw new Error('You cannot book your own session.');

    tx.update(sRef, {
      seatsTaken: s.seatsTaken + 1,
      status: s.seatsTaken + 1 >= s.capacity ? 'full' : 'open',
    });

    tx.set(bookingRef, {
      sessionId: session.id,
      sessionTitle: session.title,
      skillTag: session.skillTag,
      startAt: session.startAt,
      durationMins: session.durationMins,
      mode: session.mode,
      meetingLink: session.meetingLink ?? '',
      locationText: session.locationText ?? '',
      teacherId: session.teacherId,
      teacherName: session.teacherName,
      teacherAvatarUrl: session.teacherAvatarUrl ?? '',
      learnerId: learner.uid,
      learnerName: learner.name,
      learnerAvatarUrl: learner.avatarUrl ?? '',
      participantIds: [session.teacherId, learner.uid],   // one array-contains query
      note,
      status: 'pending',
      reviewedByLearner: false,
      reviewedByTeacher: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return bookingRef.id;
}
```

**Why `participantIds`:** v1 needed two queries (`teacherId == uid` OR `learnerId == uid`) merged client-side. With `participantIds: [teacherId, learnerId]`, "my bookings" is a single `array-contains` query that can also be `orderBy('startAt')` and paginated. Do the same on `chats`.

**`markCompleted` also increments stats** (in the same transaction): `users/{teacherId}.stats.sessionsTaught + 1`, `users/{learnerId}.stats.sessionsAttended + 1`, and `+credits` if you do the stretch goal.

#### Storage
`sessions/{sessionId}/cover.jpg` — optional. If you're short on time, drop cover images and use a generated colour + skill icon instead. Component 3 is the **least** dependent on Storage.

---

### 5.4 Component 4 — Community & Reputation (Member 4)

**Covers from the group's lists:** Community Chat · Messaging · Ratings, Reviews & feedback · Community Feed (achievements, tips, discussions) · Trust score / Top contributors · Verified badges display · Q&A discussions.

#### Screens

| Route | What it does |
|---|---|
| `app/(tabs)/community.tsx` | Two tabs: **Feed** (posts from everyone, filter: All / Achievements / Tips / Questions) and **Chats** (conversation list, sorted by `lastMessageAt`, unread badge). |
| `app/post/create.tsx` | Compose a post: type picker, text, optional image, optional skill tag. Runs the Gemini moderation check before saving (§11). |
| `app/post/[id].tsx` | Post detail + like + comments list + comment composer. |
| `app/chat/[chatId].tsx` | `GiftedChat` fed by a live `onSnapshot`. Header shows the other person's avatar/name and links to their profile (→ M1). |
| `app/review/[bookingId].tsx` | Star rating (1–5) + comment + quick tag chips ("Punctual", "Explained clearly"). Submits via transaction. |
| `app/user/[id]` → Reviews section | A component M4 exports and M1 renders inside the profile screen — see §6. |
| `app/leaderboard.tsx` *(stretch)* | Top contributors by `stats.sessionsTaught`. |

#### `src/services/chatService.ts`

```ts
chatIdFor(uidA, uidB): string                  // [a,b].sort().join('_') — deterministic, no duplicate threads
getOrCreateChat(me: User, other: User): Promise<string>
subscribeToMyChats(uid, cb): Unsubscribe       // participantIds array-contains, orderBy lastMessageAt desc
subscribeToMessages(chatId, cb): Unsubscribe   // orderBy createdAt desc, limit(50)
sendMessage(chatId, sender, text, imageUrl?): Promise<void>   // batch: message + chat summary
markChatRead(chatId, uid): Promise<void>
uploadChatImage(chatId, localUri): Promise<string>
```

**Deterministic chat IDs matter.** Without them, Member 1's "Message" button and Member 3's "Message teacher" button create two separate threads between the same two people. `chatIdFor` guarantees they land in the same conversation.

`sendMessage` writes **both** documents in one `writeBatch`: the message subdoc, and the parent chat's `lastMessage` / `lastMessageAt` / `unreadCount` — otherwise your chat list can't sort or show previews without reading every subcollection.

#### `src/services/reviewService.ts`

```ts
submitReview({ booking, fromUser, toUserId, rating, comment, tags }): Promise<void>
getReviewsForUser(uid, pageSize?): Promise<Review[]>
getReviewForBooking(bookingId, fromUserId): Promise<Review | null>
canReview(booking, uid): boolean   // status === 'completed' && !already reviewed by this side
```

The rating transaction (replaces a SQL `AVG()`), now also flipping the booking's review flag so nobody can review twice:

```ts
await runTransaction(db, async (tx) => {
  const userRef    = doc(db, 'users', toUserId);
  const bookingRef = doc(db, 'bookings', booking.id);

  const [userSnap, bookingSnap] = await Promise.all([tx.get(userRef), tx.get(bookingRef)]);   // reads first
  if (bookingSnap.data()?.status !== 'completed') throw new Error('Session is not completed yet.');

  const isLearner = fromUser.uid === booking.learnerId;
  const flag = isLearner ? 'reviewedByLearner' : 'reviewedByTeacher';
  if (bookingSnap.data()?.[flag]) throw new Error('You already reviewed this session.');

  const u = userSnap.data()!;
  const newCount = (u.ratingCount ?? 0) + 1;
  const newAvg   = ((u.ratingAvg ?? 0) * (u.ratingCount ?? 0) + rating) / newCount;

  tx.set(doc(collection(db, 'reviews')), {
    bookingId: booking.id, sessionId: booking.sessionId, skillTag: booking.skillTag,
    fromUserId: fromUser.uid, fromUserName: fromUser.name, fromUserAvatarUrl: fromUser.avatarUrl ?? '',
    toUserId, rating, comment: comment ?? '', tags: tags ?? [],
    role: isLearner ? 'learner_to_teacher' : 'teacher_to_learner',
    createdAt: serverTimestamp(),
  });

  tx.update(userRef, { ratingAvg: Math.round(newAvg * 100) / 100, ratingCount: newCount });
  tx.update(bookingRef, { [flag]: true });
});
```

> **Transaction rule that trips everyone up:** every `tx.get()` must happen **before** the first `tx.set()`/`tx.update()`. Reads-then-writes, never interleaved.

#### `src/services/postService.ts`

```ts
createPost(author, { type, text, imageUrl?, skillTag? }): Promise<string>
listPosts({ type?, pageSize, cursor? })
toggleLike(postId, uid): Promise<void>     // arrayUnion/arrayRemove + increment(±1)
addComment(postId, author, text) / listComments(postId)
deletePost(postId)                          // author only
```

#### Storage
- `chats/{chatId}/{messageId}.jpg` — image messages (optional, nice demo moment)
- `posts/{postId}/{fileId}.jpg` — feed images

---

## 6. Integration Map — Exactly Where Components Touch

These are your **integration contracts**. Agree on them in Week 1; they're what Week 6 integration actually tests. Eighteen touch points, and every one of them is a place where two members' assumptions can quietly disagree.

| # | From → To | Touch point | Contract |
|---|---|---|---|
| 1 | **All → Auth** | `useAuth()` | Every screen reads `profile.uid`, `profile.name`, `profile.avatarUrl`. Nobody calls `auth.currentUser` directly. |
| 2 | **M1 → M3** | "Book a session" on `user/[id]` | Navigates to `/session/browse?teacherId={id}`. M3 exports `<TeacherSessionsList teacherId />` that M1 renders inline. |
| 3 | **M1 → M4** | "Message" button on `user/[id]` | Calls `chatService.getOrCreateChat(me, other)` → `router.push('/chat/' + chatId)`. |
| 4 | **M4 → M1** | Rating on the profile | M4's review transaction writes `users.ratingAvg` / `ratingCount`. M1 only ever **reads** those two fields — M1 must never write them. |
| 5 | **M4 → M1** | Reviews section | M4 exports `<UserReviews userId />`; M1 renders it inside `user/[id].tsx`. M1 does not query the `reviews` collection. |
| 6 | **M2 → M1** | "Lessons by this user" | M2 exports `<UserLessons userId />` (calls `getLessonsByOwner`); M1 renders it. |
| 7 | **M3 → M1** | Stats on profile | M3's `markCompleted` increments `users.stats.sessionsTaught` / `sessionsAttended`. M1 displays them. |
| 8 | **M3 → M4** | Review prompt | When `booking.status === 'completed'` and `!reviewedByX`, M3's booking screen shows "Leave a review" → `/review/{bookingId}`. |
| 9 | **M3 → M4** | "Message teacher" on a booking | Same `getOrCreateChat` call as #3 — that's why the chat ID must be deterministic. |
| 10 | **M4 → M3** | Review guard | `submitReview` reads and updates `bookings/{id}`. M3 must guarantee `status` and the two `reviewedBy*` flags exist on **every** booking doc from creation. |
| 11 | **M2 → M4** | Achievement post | On `completeLesson`, optionally auto-create a feed post (`type: 'achievement'`). M2 calls `postService.createPost` — M2 does not write to `posts` directly. |
| 12 | **M1 ↔ M2 ↔ M3** | Skill taxonomy | All three filter by `skillTag` and `category`. **All values come from `src/constants/skills.ts`.** Free-typed tags are forbidden — one typo silently breaks discovery, the feed, and session browse at once. |
| 13 | **M1 → M2/M3** | `skillsWanted` / `skillTagsWanted` | Feed and session browse can default their filter to these fields. They mean **"everything this learner wants to learn"** — a derived union of `careerGoals[].skillTags` + `extraSkillsWanted` (§5.1.2). M2/M3 **read only**; never write them, and never assume they were typed by hand. |
| 14 | **All → shared UI** | `src/components/ui/` | `Avatar`, `SkillChip`, `RatingStars`, `Button`, `Input`, `Card`, `EmptyState`, `LoadingState`, `ErrorState`, `ScreenHeader`, `CredentialCard`. Built Week 1 by Member 4 (usability role); everyone else consumes them. |
| 15 | **M1 → M3** | Credentials on the booking path | `session/[id]` and `booking/[id]` show the teacher's `credentialCount` as a chip that deep-links to `user/{teacherId}#credentials`. M3 reads the denormalized counter only — M3 never queries the credentials subcollection. |
| 16 | **M1 → M1** | Credential ↔ skill link | A credential's `skillTag` must be one of the owner's `skillTagsOffered`. If a skill is removed in `profile/edit`, its credentials are **not** deleted — they're shown in an "Unlinked" group in the owner's own list, so evidence is never silently destroyed by an unrelated edit. |
| 17 | **All → theme** | `src/constants/theme.ts` | Nobody writes a raw hex value, pixel value or font size in a screen file. Every colour, space, radius and text style comes from the theme — see §13. This is what makes four independently built components look like one app. |
| 18 | **M1 → M2/M3** | `careerGoals[].goal` | Optional later: key path/progress UI off the stable goal tag from `src/constants/careerGoals.ts`. Do not invent parallel goal IDs. Until then, contract #13 is enough. |

### 6.1 `src/constants/skills.ts` — build this on Day 3, before anyone writes a query

```ts
export const CATEGORIES = [
  'Programming', 'Design', 'Business', 'Academic',
] as const;

export const SKILLS: { tag: string; label: string; category: Category }[] = [
  { tag: 'python',      label: 'Python',           category: 'Programming' },
  { tag: 'javascript',  label: 'JavaScript',       category: 'Programming' },
  { tag: 'react',       label: 'React',            category: 'Programming' },
  { tag: 'git',         label: 'Git & Version Control', category: 'Programming' },
  { tag: 'cloud-computing', label: 'Cloud Computing', category: 'Programming' },
  { tag: 'figma',       label: 'Figma',            category: 'Design' },
  { tag: 'ui-ux',       label: 'UI/UX Design',     category: 'Design' },
  { tag: 'excel',       label: 'Excel & Spreadsheets', category: 'Business' },
  { tag: 'project-management', label: 'Project Management', category: 'Business' },
  { tag: 'mathematics', label: 'Mathematics',      category: 'Academic' },
  // …~30 total across the four categories. tag = lowercase-kebab, ALWAYS.
];

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
```

Every picker, chip, and filter in all four components reads from this file. **This single file prevents the most common Firestore group-project bug.**

Languages, Music, Crafts and Fitness were dropped in v2.2 — the catalog stays focused on career-relevant skills that the career-goal curricula actually use.

### 6.2 `src/constants/careerGoals.ts` — build alongside skills.ts

```ts
export const CAREER_GOALS = [
  {
    tag: 'software-engineer',
    label: 'Software Engineer',
    skillTags: ['html-css', 'javascript', 'python', 'java', 'sql', 'git', /* … */],
  },
  // …10 goals total — full table in §5.1.2
] as const;

export type CareerGoalTag = (typeof CAREER_GOALS)[number]['tag'];
// helpers: careerGoalByTag, goalLabel, skillsInGoal
```

Same rule as skills: **no free-typed goal tags.** M2/M3 that later adopt goals for progress tracking import from this file only.

---

## 7. Complete Firestore Data Model

Legend: `T` = Firestore `Timestamp` · **denorm** = copied from another doc for list rendering.

### `users/{uid}` — owner: Member 1 (created by Auth)

| Field | Type | Notes |
|---|---|---|
| `uid` | string | same as doc id, duplicated for convenience in query results |
| `name` | string | |
| `nameLower` | string | lowercase, powers prefix search |
| `email` | string | |
| `role` | `'learner' \| 'teacher' \| 'both'` | |
| `bio` | string | max 300 chars |
| `avatarUrl` | string | Storage download URL, `''` if none |
| `location` | string | e.g. "NSBM, Homagama" |
| `skillsOffered` | `{ skill, label, level, verified, credentialCount }[]` | **display** shape |
| `skillTagsOffered` | string[] | **query** shape — `array-contains` |
| `careerGoals` | `{ goal, label, skillTags }[]` | **learner source of truth** — see §5.1.2. At most one entry per `goal` tag from `careerGoals.ts` |
| `extraSkillsWanted` | string[] | **learner source of truth** — wanted skill tags with no goal attached |
| `skillsWanted` | `{ skill, label }[]` | **derived** display union of the two sources above — M2/M3 read this |
| `skillTagsWanted` | string[] | **derived** query union — M2/M3 read this; never hand-edit |
| `verifiedSkills` | string[] | tags passed via the skill test — *the app tested them* |
| `credentialCount` | number | denormalized size of the `credentials` subcollection, so Discovery cards need no extra read |
| `ratingAvg` | number | 0–5, **written only by M4's transaction** |
| `ratingCount` | number | **written only by M4's transaction** |
| `credits` | number | starts at 10 (stretch-goal hook) |
| `badges` | string[] | e.g. `['first_lesson','5_sessions']` |
| `stats` | `{ sessionsTaught, sessionsAttended, lessonsCompleted }` | map, written by M2 & M3 |
| `streak` | number | consecutive learning days (M2) |
| `lastActiveDate` | string | `'YYYY-MM-DD'` — streak comparison |
| `expoPushToken` | string? | stretch goal only |
| `onboardingComplete` | boolean | drives routing |
| `createdAt` / `updatedAt` | T | `serverTimestamp()` |

### `users/{uid}/credentials/{credentialId}` — owner: Member 1

A **subcollection**, not an array on the user doc — see §5.1.1 for why. Written only by the profile owner; readable by any signed-in user (that's the point).

| Field | Type | Notes |
|---|---|---|
| `id` | string | same as doc id |
| `userId` | string | denormalized, so a future collection-group query ("all credentials for `python`") works without restructuring |
| `skillTag` | string | **must be one of the owner's `skillTagsOffered`** — this is what groups credentials under a skill on the profile |
| `type` | `'certificate' \| 'degree' \| 'course' \| 'award' \| 'work_experience' \| 'portfolio' \| 'other'` | drives the icon in the list |
| `title` | string | 3–120 chars, e.g. "Google IT Support Professional Certificate" |
| `issuer` | string | 2–80 chars, e.g. "Coursera / Google" |
| `issueDate` | T | required, never in the future |
| `expiryDate` | T? | optional; if past, the UI shows an "Expired" chip rather than hiding the row |
| `referenceNo` | string | optional certificate / serial number |
| `verifyUrl` | string | optional `https://` link to the issuer's verification page |
| `description` | string | optional, max 300 chars |
| `fileUrl` | string | Storage download URL, `''` when no document was attached |
| `filePath` | string | Storage path — **required for deletion**, same rule as lesson media |
| `fileType` | `'image' \| 'pdf' \| 'none'` | decides zoom viewer vs `WebBrowser` |
| `fileSizeBytes` | number | for the 5 MB client-side check and for your Storage-usage audit |
| `visibility` | `'public' \| 'private'` | `private` is owner-only; default `public` |
| `verificationStatus` | `'self_declared'` | one value for now. Kept as a field, not a boolean, so admin/peer verification can be added later without a migration. **Always displayed as "Self-declared".** |
| `createdAt` / `updatedAt` | T | `serverTimestamp()` |

> **Deletion order matters:** Storage file → document → counter decrement. Reverse it and a failed step leaves a document pointing at a file that no longer exists, which renders as a broken image on someone else's profile.

### `skillTests/{testId}` — owner: Member 1

| Field | Type | Notes |
|---|---|---|
| `userId` | string | |
| `skillTag` | string | |
| `questions` | `{ q, type, options?, answer }[]` | as generated/served |
| `answers` | string[] | what the user submitted |
| `score` | number | 0–100 |
| `passed` | boolean | `score >= 60` |
| `source` | `'gemini' \| 'fallback'` | shows the AI actually ran |
| `createdAt` | T | |

### `lessons/{lessonId}` — owner: Member 2

| Field | Type | Notes |
|---|---|---|
| `ownerId` / `ownerName` / `ownerAvatarUrl` | string | **denorm** from `users` |
| `title` / `description` | string | |
| `skillTag` / `category` | string | from `constants/skills.ts` |
| `level` | `'beginner' \| 'intermediate' \| 'advanced'` | |
| `format` | `'text' \| 'flashcards' \| 'video' \| 'pdf'` | drives the viewer |
| `content` | string | article text (format `text`) |
| `cards` | `{ front, back }[]` | flashcards, keep ≤ 30 |
| `mediaUrl` / `mediaPath` / `mediaSizeBytes` | string / string / number | Storage URL + path (path needed for delete) |
| `thumbnailUrl` | string | |
| `durationMins` | number | 5–15 |
| `quiz` | `{ q, options[4], answerIndex }[]` | embedded, ≤ 10 questions |
| `quizSource` | `'gemini' \| 'manual'` | |
| `viewCount` / `completeCount` | number | `increment(1)` |
| `createdAt` / `updatedAt` | T | |

> Embedding `cards` and `quiz` is fine — the 1 MB per-document limit is nowhere near reached with 30 cards. If you ever add 100+ cards, move them to a subcollection.

### `lessonProgress/{uid}_{lessonId}` — owner: Member 2

Composite doc ID makes progress idempotent — no duplicate rows, no query needed to find "my progress on this lesson".

| Field | Type |
|---|---|
| `userId` / `lessonId` | string |
| `lessonTitle` / `skillTag` | string (**denorm**, for the progress dashboard) |
| `status` | `'in_progress' \| 'completed'` |
| `lastCardIndex` | number |
| `quizScore` / `quizAttempts` | number |
| `minutesSpent` | number |
| `startedAt` / `completedAt` / `updatedAt` | T |

### `sessions/{sessionId}` — owner: Member 3

| Field | Type | Notes |
|---|---|---|
| `teacherId` / `teacherName` / `teacherAvatarUrl` / `teacherRatingAvg` | | **denorm** |
| `title` / `description` | string | |
| `descriptionSource` | `'gemini' \| 'manual'` | |
| `skillTag` / `category` / `level` | string | |
| `type` | `'one_to_one' \| 'group'` | |
| `mode` | `'online' \| 'in_person'` | |
| `meetingLink` | string | required when `mode === 'online'` |
| `locationText` | string | required when `mode === 'in_person'` |
| `startAt` | T | **the** sort/filter field |
| `durationMins` | number | |
| `endAt` | T | `startAt + duration` — needed for "is it over?" checks |
| `capacity` / `seatsTaken` | number | `capacity: 1` for one-to-one |
| `status` | `'open' \| 'full' \| 'cancelled' \| 'completed'` | |
| `coverImageUrl` | string | optional |
| `createdAt` / `updatedAt` | T | |

### `bookings/{bookingId}` — owner: Member 3

| Field | Type | Notes |
|---|---|---|
| `sessionId` / `sessionTitle` / `skillTag` / `startAt` / `durationMins` / `mode` / `meetingLink` / `locationText` | | **denorm** from the session — so "My Bookings" renders with zero extra reads |
| `teacherId` / `teacherName` / `teacherAvatarUrl` | string | **denorm** |
| `learnerId` / `learnerName` / `learnerAvatarUrl` | string | **denorm** |
| `participantIds` | `[teacherId, learnerId]` | single-query "my bookings" and shared participant checks |
| `note` | string | learner's message when requesting |
| `status` | `'pending' \| 'confirmed' \| 'declined' \| 'cancelled' \| 'completed'` | |
| `cancelReason` | string | optional |
| `reviewedByLearner` / `reviewedByTeacher` | boolean | **must exist from creation** — M4 depends on them |
| `createdAt` / `updatedAt` | T | |

### `reviews/{reviewId}` — owner: Member 4

| Field | Type |
|---|---|
| `bookingId` / `sessionId` / `skillTag` | string |
| `fromUserId` / `fromUserName` / `fromUserAvatarUrl` | string (**denorm**) |
| `toUserId` | string |
| `rating` | number 1–5 |
| `comment` | string |
| `tags` | string[] — e.g. `['punctual','clear']` |
| `role` | `'learner_to_teacher' \| 'teacher_to_learner'` |
| `createdAt` | T |

### `chats/{chatId}` — owner: Member 4 · doc id = `[uidA, uidB].sort().join('_')`

| Field | Type | Notes |
|---|---|---|
| `participantIds` | string[] (length 2) | `array-contains` query + shared participant checks |
| `participants` | `{ [uid]: { name, avatarUrl } }` | **map, not parallel arrays** — v1's parallel arrays make "who is the other person?" awkward |
| `lastMessage` / `lastSenderId` | string | |
| `lastMessageAt` | T | list sort key |
| `unreadCount` | `{ [uid]: number }` | reset to 0 on open |
| `createdAt` | T | |

### `chats/{chatId}/messages/{messageId}` — owner: Member 4

| Field | Type |
|---|---|
| `senderId` / `senderName` | string |
| `text` | string |
| `imageUrl` / `imagePath` | string? |
| `moderation` | `'clean' \| 'flagged' \| 'skipped'` |
| `createdAt` | T |

### `posts/{postId}` + `posts/{postId}/comments/{commentId}` — owner: Member 4

| Field | Type |
|---|---|
| `authorId` / `authorName` / `authorAvatarUrl` | string (**denorm**) |
| `type` | `'achievement' \| 'tip' \| 'question'` |
| `text` | string |
| `imageUrl` / `imagePath` | string? |
| `skillTag` | string? |
| `likedBy` | string[] — fine at campus scale; note the 1 MB ceiling in the report |
| `likeCount` / `commentCount` | number |
| `moderation` | `'clean' \| 'flagged' \| 'skipped'` |
| `createdAt` | T |

Comments: `authorId`, `authorName`, `authorAvatarUrl`, `text`, `createdAt`.

### `aiUsage/{uid}` — owner: whoever builds the Gemini function

| Field | Type | Notes |
|---|---|---|
| `date` | string `'YYYY-MM-DD'` | |
| `count` | number | reset when `date` changes |
| `lastPromptType` | string | |

Simple per-user daily cap (e.g. 20 calls/day) so one member's test loop can't burn the whole free quota the night before the demo.

### Denormalization rule

Copy a field into another document **only when a list screen needs it without an extra read per row.** Source of truth stays in `users/{uid}`. Accept staleness (rename your name → old bookings still show the old one) and state it as a known limitation in the report — the professional fix is a Cloud Function fan-out, which is correctly out of scope here.

---

## 8. Firebase Storage — Layout & Ownership

| Path | Component | Content | Limit to enforce client-side |
|---|---|---|---|
| `avatars/{uid}.jpg` | **M1** | Profile photo (overwritten) | 1 MB, square crop |
| `credentials/{uid}/{credentialId}.{jpg\|png\|pdf}` | **M1** | Certificate scans / photos / PDFs | 5 MB |
| `lessons/{lessonId}/{filename}` | **M2** ← heaviest user | Images, PDFs, video, thumbnails | img 2 MB · pdf 10 MB · video 50 MB |
| `sessions/{sessionId}/cover.jpg` | **M3** (optional) | Session cover | 1 MB |
| `chats/{chatId}/{messageId}.jpg` | **M4** (optional) | Image messages | 2 MB |
| `posts/{postId}/{fileId}.jpg` | **M4** | Feed images | 2 MB |

**Components 1 and 2 are the only ones that genuinely need Storage** — M1 for avatars and credentials, M2 for lesson media. If you fall behind schedule, cut in this order: session covers → chat images → post images → lesson video (keep lesson images). Avatars and credentials stay: avatars carry most of the perceived polish, and credentials are the feature's whole point.

### Upload helper (put in `src/utils/storage.ts`, everyone reuses it)

```ts
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';

export async function uploadFile(path: string, localUri: string, maxBytes: number) {
  const res  = await fetch(localUri);
  const blob = await res.blob();                  // Expo: fetch() on a file:// URI gives a Blob
  if (blob.size > maxBytes)
    throw new Error(`File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`);

  const r = ref(storage, path);
  await uploadBytes(r, blob);
  return { url: await getDownloadURL(r), path, sizeBytes: blob.size };
}

export const deleteFile = (path: string) => deleteObject(ref(storage, path));
```

## 9. Deferred Production Hardening

Production-grade server-side access controls are intentionally outside the active campus-project scope. The current prototype relies on Firebase project settings plus validation and ownership checks in the client service layer. Revisit this only if publication, assessment requirements or wider external testing make it necessary.

---

## 10. Composite Indexes You Will Need

Firestore auto-handles single-field indexes; any query mixing a filter with a different `orderBy` needs a composite index. **You don't have to write these by hand** — run the query, and Firestore throws an error containing a "click here to create the index" link. Click it. But knowing the list up front stops you from panicking during integration week:

| Priority | Collection | Fields | Current behavior without it |
|---|---|---|---|
| Required | `reviews` | `toUserId` == + `createdAt` desc | Public profile review list fails. |
| Required | `chats` | `participantIds` (array-contains) + `lastMessageAt` desc | Chat inbox subscription fails. |
| Recommended | `posts` | `type` == + `createdAt` desc | Filter works through a client-sort fallback, but filtered pagination is disabled. |
| Recommended | `bookings` | `participantIds` (array-contains) + `startAt` desc | Bookings fall back to client-side sorting. |
| Recommended | `sessions` | `teacherId` == + `startAt` asc/desc | Teacher sessions fall back to client-side sorting. |
| Recommended | `lessons` | `published` == + `updatedAt` desc | Lesson feed falls back to client-side sorting. |
| Recommended | `lessons` | `teacherId` == + `updatedAt` desc | Teacher lesson list falls back to client-side sorting. |
| Recommended | `lessonEnrollments` | `userId` == + `updatedAt` desc | Enrolments fall back to client-side sorting. |

Index builds take 1–3 minutes. **Create all of these by end of Week 5**, not on demo day.

---

## 11. Gemini AI Features (add after core works — Week 6/7)

### 11.1 Where to put the API key — read this first

**Never call Gemini directly from the React Native app with the key in `.env`.** `EXPO_PUBLIC_*` vars are compiled into the JS bundle; anyone can unzip your APK and read the key. Someone will then spend your quota.

Three options, pick one:

| Option | Setup | Key safe? | Cost |
|---|---|---|---|
| **A. Firebase Cloud Function proxy** *(recommended)* | `firebase init functions`, key in function config, app calls `httpsCallable` | ✅ Key never leaves the server | Functions require the **Blaze (pay-as-you-go)** plan — needs a card on file. The free monthly allowance covers a student project many times over, but **confirm this with your group before adding a card.** |
| **B. Firebase AI Logic client SDK** (`firebase/ai`) | Enable in the Firebase console, call Gemini from the app, protect with App Check | ✅ No key in the app at all | Check the current plan requirement in the console before committing — verify it on the day, don't trust a plan doc |
| **C. Direct call with key in `.env`** | 10 minutes | ❌ Key is extractable | Free. **Only acceptable for a local demo APK that you never publish, with the key deleted/rotated in Google AI Studio right after the presentation.** |

If your group can't add a card, use **C for development and be honest about it in the report** — "we prototyped with a client-side key and documented the Cloud Function proxy as the production fix" is a much better answer than pretending the problem doesn't exist. Write the service so switching is a one-line change:

```ts
// src/services/aiService.ts — one function, all features are just different prompts
export async function askGemini(prompt: string, jsonSchema?: object): Promise<string> { … }
```

### 11.2 The Cloud Function (Option A)

```js
// functions/index.js
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const GEMINI_KEY = defineSecret('GEMINI_API_KEY');

exports.askGemini = onCall({ secrets: [GEMINI_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Login required');

  const { prompt, responseSchema } = req.data;
  if (!prompt || prompt.length > 6000)
    throw new HttpsError('invalid-argument', 'Bad prompt');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: responseSchema
      ? { responseMimeType: 'application/json', responseSchema }
      : { temperature: 0.7 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY.value()}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new HttpsError('internal', 'Gemini request failed');

  const json = await res.json();
  return { text: json.candidates?.[0]?.content?.parts?.[0]?.text ?? '' };
});
```

```bash
firebase init functions            # JavaScript, no ESLint (keeps it simple)
firebase functions:secrets:set GEMINI_API_KEY
firebase deploy --only functions
```

**Model:** use `gemini-2.5-flash` (or `gemini-2.5-flash-lite` for the moderation check — cheapest and fastest). Pro models are behind the paid tier; you don't need them for any of these tasks. Confirm the current free-tier limits in Google AI Studio before demo day — they change.

**Always request JSON with `responseSchema`.** Asking for JSON in the prompt and hoping is how you end up parsing ```` ```json ```` fences at 2am. Example schema for the quiz generator:

```js
{
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      q: { type: 'STRING' },
      options: { type: 'ARRAY', items: { type: 'STRING' } },
      answerIndex: { type: 'INTEGER' },
    },
    required: ['q', 'options', 'answerIndex'],
  },
}
```

### 11.3 The AI features — one function, six prompt templates (plus two optional)

| # | Component | Feature | Prompt (abbreviated) | UI |
|---|---|---|---|---|
| 1 | **M1** | **Skill Verification Test** | "Generate 4 multiple-choice questions testing basic competency in {skill}, difficulty {level}. Return JSON." | `profile/skill-test/[skill].tsx` — pass ≥ 60% → `verifiedSkills` badge appears on the profile |
| 2 | **M1** | **Related-skill suggestions** | "A user can teach {skills}. Suggest 5 related skills they might also teach, from this list: {SKILLS}. Return JSON array of tags." | Chips under the skill editor: "You might also teach…" |
| 3 | **M2** | **Quiz generator from lesson text** | "From this lesson content, write 5 MCQs with 4 options each. Content: {content}. Return JSON." | "✨ Generate quiz" button on `lesson/create` — teacher can edit before saving |
| 4 | **M2** | **Flashcard generator** | "Convert these notes into up to 12 flashcards as `{front, back}` pairs. Notes: {notes}. Return JSON." | "✨ Generate flashcards" on `lesson/create` |
| 5 | **M3** | **Session description drafter** | "Write a friendly 60-word session description and 4 bullet-point agenda for a {duration}-min {level} session on {skill}. Return JSON `{description, agenda[]}`." | "✨ Draft with AI" on `session/create` |
| 6 | **M4** | **Content moderation** | "Does this message contain harassment, hate speech, or spam? Reply only `SAFE` or `UNSAFE`. Message: {text}" | Runs before saving a post or chat message; `UNSAFE` → block + show a warning, save `moderation: 'flagged'` |
| 7 | **M1** *(optional, do last)* | **Certificate scanner** | Send the uploaded credential image and ask: "Extract the certificate title, issuing organisation and issue date. Return JSON `{title, issuer, issueDate}`." | "✨ Scan certificate" on `credentials/add` — pre-fills the form, user edits before saving. Needs image bytes through the Cloud Function, so it's more work than the six above — build it only once they all work. |
| ⭐ | **Cross-cutting** | **AI Learning Assistant** | System prompt: "You are SkillBridge's learning assistant. Help with study questions concisely. If asked something unrelated to learning, politely redirect." | New route `app/assistant.tsx` — `GiftedChat` UI (M4's library, reused), reachable from a floating action button on the feed |

**Every one of these must have a fallback.** Wrap each call in try/catch: on failure, hide the AI button or fall back to a hardcoded question bank / manual entry. Your demo must work with the Wi-Fi off — an AI feature that crashes the app on stage costs more marks than not having it.

Also: show a spinner with a real label ("Generating your quiz…"), and always let the user **edit** the AI output before saving. AI-as-a-draft, never AI-as-final — that's a genuine UX argument you can defend in the viva.

### 11.4 Cost & quota control
- Cap each user at ~20 AI calls/day via `aiUsage/{uid}`.
- Cache generated skill tests: check `skillTests` for an existing question set for that skill before calling Gemini again.
- Truncate `content` to ~4000 characters before sending.
- Disable the assistant chat's history beyond the last 6 messages.

---

## 12. Stretch Goals — Only Two (pick these, in this order)

Do **not** start either until Week 7 and only if the core 4 components are demo-ready.

### 12.1 Push Notifications (biggest impact for least effort) ⭐
Every trigger already exists in Components 3 and 4 — you're reacting to data, not creating new domain logic.

- `npx expo install expo-notifications expo-device`
- On login, request permission → save `expoPushToken` on `users/{uid}`
- Cloud Function triggers: `onDocumentCreated('bookings/{id}')` → notify the teacher; `onDocumentUpdated('bookings/{id}')` on status change → notify the learner; `onDocumentCreated('chats/{id}/messages/{mid}')` → notify the other participant
- POST to `https://exp.host/--/api/v2/push/send`
- ⚠️ Push does **not** work in Expo Go for Android on SDK 53+. You need a development build (`eas build --profile development`). Budget half a day for that, or demo it on iOS/an EAS preview build.

### 12.2 Skill Credits + Leaderboard (the "SDG 8" story) ⭐
Directly supports the "exchange skills instead of money" idea from your group's list, without building an economy.

- [x] `users.credits` exists and starts at 10
- [x] `markCompleted` awards the teacher `+5` credits without blocking learner bookings
- [x] Me shows the credit balance and booking completion shows a `+5 Skill Credits` message
- [ ] `app/leaderboard.tsx` — `orderBy('stats.sessionsTaught', 'desc').limit(20)`, top 3 highlighted
- **Deliberately skip** "must spend credits to book" — it blocks your demo flow the moment an account runs out. Award-only is the smart scope cut, and say so in the report.

**Explicitly out of scope (list these as "Future Work" in the report):** admin web panel, geolocation/nearby events, offline mode, dark mode, full credit economy, video calling inside the app (use external Zoom/Meet links), **admin or peer verification of uploaded credentials** (uploading and viewing them *is* in scope — see §5.1.1; only third-party approval is not), auto-generated completion certificates, full-text search.

---

## 13. UI Design System — Colour, Type & Spacing

Four members building four components independently will produce four different-looking apps unless the visual language is fixed **before** anyone builds a screen. This section is that fix. It is also directly markable: in a UX-graded module, a defensible palette applied consistently is worth more than any single feature.

> **Non-negotiable rule:** no screen file ever contains a raw hex code, a raw pixel number, or a raw font size. Everything comes from `src/constants/theme.ts`. If a value isn't in the theme, it doesn't go in the app — you add it to the theme first, via PR. This is integration point #17 in §6.

### 13.1 The 60:30:10 rule, applied to a mobile app

The classic interior-design ratio, adapted for screens:

| Share | Role | In SkillBridge |
|---|---|---|
| **60% — Dominant** | The canvas everything sits on | Neutral off-white backgrounds, white cards and sheets, light hairline borders. This is most of the pixels on every screen. |
| **30% — Secondary** | Structure and legibility | A deep navy — all text, headers, the tab bar, icons, dividers, section titles. Carries the layout without competing for attention. |
| **10% — Accent** | Where you want the eye to go | One teal. Primary buttons, the FAB, the active tab, selected chips, links, filled stars, progress fill, unread badges. **Nothing else.** |

**Why this ratio and not a brand-heavy design:** SkillBridge is content-dense — user cards, lesson cards, session cards, chat bubbles, credential rows. Dense screens read badly when the brand colour is everywhere. Restricting the accent to roughly a tenth of the screen means that when a learner sees teal, it always means *"this is the thing to tap."* That is a usability argument, not a taste argument, and it's the one to make in your report.

### 13.2 The palette

**60% — Dominant (neutral canvas)**

| Token | Hex | Used for |
|---|---|---|
| `bg` | `#F6F7F9` | Every screen background |
| `surface` | `#FFFFFF` | Cards, list rows, sheets, inputs, modals |
| `surfaceAlt` | `#EEF1F5` | Pressed rows, skeleton loaders, disabled fields, incoming chat bubbles, progress-bar track |
| `border` | `#E2E6EC` | Hairlines, card outlines, dividers, input borders |

**30% — Secondary (structure & text)**

| Token | Hex | Used for |
|---|---|---|
| `ink` | `#16233A` | Headings, body text, tab-bar background, active icons |
| `inkMuted` | `#5A6B85` | Secondary text, timestamps, placeholders, inactive tab icons, "Self-declared" labels |
| `inkFaint` | `#7A8AA3` | Decorative icons and 18 pt+ text only — **never** small body text (see the contrast table) |
| `inkInverse` | `#FFFFFF` | Text and icons on top of `ink` or `accent` |

**10% — Accent (the one brand colour)**

| Token | Hex | Used for |
|---|---|---|
| `accent` | `#0B7A6D` | Primary buttons, FAB, active tab, links, filled stars, progress fill, unread badges, sent chat bubbles |
| `accentPressed` | `#095F55` | Pressed / held state of anything accent-filled |
| `accentSurface` | `#E6F4F1` | Selected chip background, accent badge background, tinted banners — accent *text* sits on this |

**Semantic status colours — outside the ratio**

These communicate state, not brand, so they don't count toward the 10%. Use them **only** for state.

| Token | Hex | Meaning in SkillBridge |
|---|---|---|
| `success` | `#15734A` | Confirmed booking, completed session, passed quiz, completed lesson |
| `warning` | `#9A5A0B` | Pending booking, expiring credential, quota nearly used |
| `danger` | `#B3261E` | Cancelled / declined, destructive actions, validation errors, flagged content |
| `info` | `#1D4ED8` | Informational banners, "AI-generated" notices |

### 13.3 Contrast — checked, not guessed

WCAG AA needs **4.5:1** for normal text and **3:1** for large text and UI components. These were computed, so you can put them in the report as evidence rather than a claim:

| Foreground on background | Ratio | Verdict |
|---|---|---|
| `ink` on `bg` | 14.7:1 | ✅ AAA |
| `ink` on `surface` | 15.7:1 | ✅ AAA |
| `inkMuted` on `bg` | 5.1:1 | ✅ AA |
| `inkFaint` on `bg` | 3.3:1 | ⚠️ **Large text and icons only** — never body text |
| `accent` on `surface` | 5.2:1 | ✅ AA (links, filled stars) |
| `inkInverse` on `accent` | 5.2:1 | ✅ AA (white text on a teal button) |
| `accent` on `accentSurface` | 4.6:1 | ✅ AA (selected chip) |
| `inkInverse` on `ink` | 15.7:1 | ✅ AAA (tab bar, dark headers) |
| `success` / `warning` / `danger` / `info` on `surface` | 5.9 / 5.5 / 6.5 / 6.7:1 | ✅ AA |

> Recheck any colour you change with a free contrast checker before merging it. One member "improving" the teal to something brighter is exactly how a project fails its own accessibility claim.

### 13.4 Four discipline rules that keep the accent at 10%

1. **One filled-accent button per screen.** Everything secondary is an outlined or text button. Two primary buttons side by side means neither is primary.
2. **The accent is never decoration.** No accent card backgrounds, no accent section headers, no accent dividers, no accent-coloured illustrations.
3. **Status colours are not accents.** A green "Confirmed" badge is semantic. Don't reach for `success` because you want a bit of colour.
4. **If a screen looks flat in review, fix spacing and type hierarchy — not colour.** Adding a second accent is the single most reliable way to make an app look like a student project.

### 13.5 Per-component application — so nobody invents their own

| Screen | 60% dominant | 30% secondary | 10% accent |
|---|---|---|---|
| **M1 — Discovery** | `bg` screen, white user cards with `border` | Name in `ink`, location and skill count in `inkMuted`, unselected chips `inkMuted` on `surfaceAlt` | Selected category chip (`accent` on `accentSurface`), filled rating stars, the "Book" button |
| **M1 — Profile** | White header block and section cards on `bg` | Bio and section titles in `ink`, "Self-declared" and dates in `inkMuted`, credential type icon in `inkFaint` | ✔ Verified-by-test badge, the two CTA buttons, the credential-count chip |
| **M2 — Lesson feed** | White lesson cards on `bg`, `surfaceAlt` thumbnail placeholder | Title `ink`, author and duration `inkMuted`, level badge `inkMuted` on `surfaceAlt` | Active filter chip, progress-bar fill (track is `surfaceAlt`) |
| **M2 — Quiz** | White question card | Question text `ink`, option text `ink`, helper `inkMuted` | Selected option outline. **Result screen uses `success` / `danger`, not the accent** |
| **M3 — Sessions** | White session cards on `bg` | All metadata in `ink` / `inkMuted` | "Request to book" button; calendar selected-day circle and session dots |
| **M3 — Booking detail** | White timeline card | Timeline labels `ink`, past steps `inkFaint` | Current step marker. **Status badge uses the status colours plus a text word — never colour alone** |
| **M4 — Chat** | `bg` behind the thread, incoming bubbles `surfaceAlt` | Incoming text `ink`, timestamps `inkMuted` | Outgoing bubbles `accent` with `inkInverse` text, send button, unread badge |
| **M4 — Feed & reviews** | White post cards on `bg` | Post text `ink`, author line `inkMuted` | Liked heart, filled stars, the star-rating input |

> Chat is the one place the accent legitimately covers a large area — outgoing bubbles. That's the universal messaging convention and it's self-limiting (it grows only with your own messages), so it's a deliberate exception, not a violation. Say that in the report if an examiner asks.

### 13.6 Typography

**One family: the system font** (San Francisco on iOS, Roboto on Android). It costs nothing to load, it's what users already read everything else in, and it renders Sinhala and Tamil correctly if any content needs it. If you want one custom font, use it for headings only, via `expo-font`, and load it in the root layout with a splash hold — never for body text.

| Token | Size | Weight | Line height | Used for |
|---|---|---|---|---|
| `display` | 28 | 700 | 34 | The one screen title, used once per screen |
| `h1` | 22 | 700 | 28 | Section headers |
| `h2` | 18 | 600 | 24 | Card titles, modal titles |
| `body` | 15 | 400 | 22 | Default body text |
| `bodyStrong` | 15 | 600 | 22 | Names, emphasised body |
| `label` | 13 | 500 | 18 | Chips, badges, form labels, buttons |
| `caption` | 12 | 400 | 16 | Timestamps, helper text, counts |

Never go below 12. Seven styles is the whole scale — if you need an eighth, you probably need a different layout.

### 13.7 Spacing, radius, elevation — a 4-point grid

| Scale | Value | Where |
|---|---|---|
| `xs` | 4 | Gap between a chip's icon and its label |
| `sm` | 8 | Gap between chips, between a label and its field |
| `md` | 12 | Gap between cards in a list |
| `lg` | 16 | **Screen horizontal padding** (always), padding inside a card |
| `xl` | 24 | Gap between major sections |
| `xxl` | 32 | Space above a screen's primary action |

| Radius | Value | Where |
|---|---|---|
| `sm` | 8 | Chips, inputs, small badges |
| `md` | 12 | Cards, buttons, sheets' inner blocks |
| `lg` | 20 | Bottom sheets, modals |
| `full` | 999 | Avatars, pills, the FAB |

**Elevation:** one soft shadow token for cards, and one only. Never stack two elevation levels on a screen — Android and iOS render shadows differently enough that a two-level hierarchy looks correct on one and wrong on the other. Check your card shadow on both if anyone has an iPhone.

**Touch targets:** minimum 44×44 regardless of how small the icon looks. Pad the pressable, don't grow the icon.

### 13.8 `src/constants/theme.ts` — build this in Week 1, before any screen

```ts
export const colors = {
  // 60% — dominant
  bg:          '#F6F7F9',
  surface:     '#FFFFFF',
  surfaceAlt:  '#EEF1F5',
  border:      '#E2E6EC',

  // 30% — secondary
  ink:         '#16233A',
  inkMuted:    '#5A6B85',
  inkFaint:    '#7A8AA3',   // icons / 18pt+ only — 3.3:1
  inkInverse:  '#FFFFFF',

  // 10% — accent
  accent:        '#0B7A6D',
  accentPressed: '#095F55',
  accentSurface: '#E6F4F1',

  // semantic — state only, not brand
  success: '#15734A',
  warning: '#9A5A0B',
  danger:  '#B3261E',
  info:    '#1D4ED8',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius  = { sm: 8, md: 12, lg: 20, full: 999 } as const;

export const type = {
  display:    { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  h1:         { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  h2:         { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body:       { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  label:      { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  caption:    { fontSize: 12, fontWeight: '400', lineHeight: 16 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#16233A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,          // Android
  },
} as const;

// Booking / session status -> semantic colour. Both M3 and M4 import this,
// so a "confirmed" badge is the same green everywhere in the app.
export const statusColor = {
  pending:   colors.warning,
  confirmed: colors.success,
  completed: colors.success,
  declined:  colors.danger,
  cancelled: colors.danger,
} as const;

export const theme = { colors, spacing, radius, type, shadow, statusColor };
export default theme;
```

### 13.9 Dark mode — deliberately out of scope

Do **not** half-implement it. A partially dark app looks broken and will cost you more than not having it. Say in the report that it was scoped out, and note that because every colour is a token behind one object, adding it later means a second palette selected by `useColorScheme()` — not a rewrite. Being able to say *why* a decision was cheap to reverse is worth marks on its own.

### 13.10 How to present this in the report

- State the ratio and show the palette swatches with their token names.
- Include the contrast table from §13.3 — it turns "we considered accessibility" into evidence.
- Annotate **one** screenshot with the 60 / 30 / 10 breakdown so the ratio is visible, not just asserted.
- State the four discipline rules from §13.4 and give one concrete example where you *removed* colour during usability testing.
- Note the deliberate chat-bubble exception and why it doesn't break the rule.

---

## 14. Complete Repository & File Structure (Final)

This is what the project looks like when it's finished. Owner tags: **[S]** shared / whole team, **[M1]**–**[M4]** per member, **[AI]** touches the Gemini service.

```
skillbridge/
│
├── .gitignore                              [S]  .env, node_modules, .expo, *.log, serviceAccountKey.json
├── README.md                               [S]  setup steps, env var list, who owns what
├── firestore.indexes.json                  [S]  §10 — generated by the CLI, committed
│
├── scripts/
│   ├── seed.js                             [S]  Admin-SDK demo data: 6 users, credentials,
│   │                                            lessons, sessions, bookings, reviews, chats, posts
│   └── serviceAccountKey.json              ***  GITIGNORED — never commit this
│
├── functions/                              [AI] the ONLY server-side code in the project
│   ├── index.js                                 askGemini callable (+ push triggers if stretch)
│   ├── package.json
│   └── .gitignore
│
└── mobile/
    │
    ├── app/                                     Expo Router — every file here is a route
    │   ├── _layout.tsx                     [S]  AuthProvider + theme + protected routing
    │   ├── index.tsx                       [S]  redirect gate (splash -> login / onboarding / tabs)
    │   ├── +not-found.tsx                  [S]  404 route
    │   │
    │   ├── (auth)/
    │   │   ├── _layout.tsx                 [S]  stack, no header
    │   │   ├── login.tsx                   [S]
    │   │   ├── register.tsx                [S]
    │   │   ├── forgot-password.tsx         [S]
    │   │   └── onboarding.tsx              [S]  role -> offered -> career goal -> wanted skills
    │   │
    │   ├── (tabs)/
    │   │   ├── _layout.tsx                 [S]  4 tabs + assistant FAB
    │   │   ├── discovery.tsx               [M1] search, category chips, user cards
    │   │   ├── feed.tsx                    [M2] lesson feed + filters
    │   │   ├── sessions.tsx                [M3] Browse | My Sessions
    │   │   └── community.tsx               [M4] Feed | Chats
    │   │
    │   ├── user/
    │   │   └── [id].tsx                    [M1] public profile — hosts M2/M3/M4 sub-components
    │   │
    │   ├── profile/
    │   │   ├── edit.tsx                    [M1] name, bio, location, role, avatar, skills
    │   │   ├── credentials/
    │   │   │   ├── index.tsx               [M1] My Credentials — manage list, grouped by skill
    │   │   │   └── add.tsx                 [M1][AI] add / edit one credential (+ scan option)
    │   │   └── skill-test/
    │   │       └── [skill].tsx             [M1][AI] AI skill verification test
    │   │
    │   ├── credential/
    │   │   └── [id].tsx                    [M1] full-screen credential viewer (learner-facing)
    │   │
    │   ├── lesson/
    │   │   ├── [id]/
    │   │   │   ├── index.tsx               [M2] viewer: text | flashcards | video | pdf
    │   │   │   └── quiz.tsx                [M2] quiz runner + score screen
    │   │   ├── create.tsx                  [M2][AI] create/edit lesson (+ generate quiz/cards)
    │   │   └── my-lessons.tsx              [M2] authored + in-progress
    │   │
    │   ├── progress.tsx                    [M2] progress dashboard: skills, minutes, streak
    │   │
    │   ├── session/
    │   │   ├── create.tsx                  [M3][AI] create/edit session (+ draft description)
    │   │   └── [id].tsx                    [M3] session detail + request to book
    │   │
    │   ├── booking/
    │   │   ├── calendar.tsx                [M3] month view, session dots
    │   │   └── [id].tsx                    [M3] status timeline, approve/decline/complete
    │   │
    │   ├── chat/
    │   │   └── [chatId].tsx                [M4] GiftedChat + live listener
    │   │
    │   ├── post/
    │   │   ├── create.tsx                  [M4][AI] compose + moderation check
    │   │   └── [id].tsx                    [M4] post detail + comments
    │   │
    │   ├── review/
    │   │   └── [bookingId].tsx             [M4] stars + comment + tag chips
    │   │
    │   ├── assistant.tsx                   [AI] AI learning assistant chat
    │   └── leaderboard.tsx                 [M4] STRETCH — top contributors
    │
    ├── src/
    │   │
    │   ├── firebase/
    │   │   └── config.ts                   [S]  initializeApp + initializeAuth(AsyncStorage)
    │   │                                        exports auth, db, storage, functions
    │   │
    │   ├── context/
    │   │   └── AuthContext.tsx             [S]  onAuthStateChanged + live profile listener
    │   │
    │   ├── hooks/
    │   │   ├── useAuth.ts                  [S]  consumes AuthContext
    │   │   ├── usePaginatedQuery.ts        [S]  limit + startAfter, reused by all four feeds
    │   │   ├── useDebounce.ts              [M1] search input debouncing
    │   │   └── useMediaPicker.ts           [S]  image + document picking, size checks
    │   │
    │   ├── services/                            THIS LAYER REPLACES "BACKEND ROUTES"
    │   │   ├── authService.ts              [S]  register, login, logout, resetPassword
    │   │   ├── userService.ts              [M1] profile, skills, avatar, search
    │   │   ├── credentialService.ts        [M1] credential CRUD + counters + files
    │   │   ├── lessonService.ts            [M2] lesson CRUD + media
    │   │   ├── progressService.ts          [M2] progress, streak, summary
    │   │   ├── sessionService.ts           [M3] session offers
    │   │   ├── bookingService.ts           [M3] requestBooking transaction, status flow
    │   │   ├── chatService.ts              [M4] deterministic chat ids, messages
    │   │   ├── reviewService.ts            [M4] review + rating transaction
    │   │   ├── postService.ts              [M4] feed posts, likes, comments
    │   │   └── aiService.ts                [AI] ONE askGemini wrapper — all prompts go through it
    │   │
    │   ├── components/
    │   │   ├── ui/                         [M4] the shared design-system layer
    │   │   │   ├── Avatar.tsx                   circle image + initials fallback
    │   │   │   ├── Button.tsx                   primary | secondary | ghost | danger + loading
    │   │   │   ├── Input.tsx                    label + error + helper text
    │   │   │   ├── Card.tsx                     surface + border + shadow.card
    │   │   │   ├── Chip.tsx                     selectable, used for skills/categories/filters
    │   │   │   ├── SkillChip.tsx                skill + level + verified tick + credential count
    │   │   │   ├── RatingStars.tsx              display and input modes
    │   │   │   ├── StatusBadge.tsx              statusColor + a text label (never colour alone)
    │   │   │   ├── EmptyState.tsx               icon + message + CTA
    │   │   │   ├── LoadingState.tsx             skeletons shaped like the real content
    │   │   │   ├── ErrorState.tsx               message + retry
    │   │   │   ├── ScreenHeader.tsx             title + back + optional action
    │   │   │   └── AiBadge.tsx             [AI] "AI-generated — please review" marker
    │   │   │
    │   │   ├── user/                       [M1]
    │   │   │   ├── UserCard.tsx                  discovery list row
    │   │   │   ├── SkillPortfolio.tsx            skills offered/wanted with levels
    │   │   │   ├── CredentialCard.tsx            one credential row
    │   │   │   ├── CredentialsBySkill.tsx        grouped viewer used on user/[id]
    │   │   │   └── ProfileHeader.tsx             avatar, name, rating, location, CTAs
    │   │   │
    │   │   ├── lesson/                     [M2]
    │   │   │   ├── LessonCard.tsx
    │   │   │   ├── FlashcardDeck.tsx             swipe + flip
    │   │   │   ├── QuizQuestion.tsx
    │   │   │   ├── ProgressRing.tsx
    │   │   │   └── UserLessons.tsx               exported for M1's profile screen
    │   │   │
    │   │   ├── session/                    [M3]
    │   │   │   ├── SessionCard.tsx
    │   │   │   ├── BookingCard.tsx
    │   │   │   ├── SeatIndicator.tsx
    │   │   │   └── TeacherSessionsList.tsx       exported for M1's profile screen
    │   │   │
    │   │   └── community/                  [M4]
    │   │       ├── PostCard.tsx
    │   │       ├── CommentRow.tsx
    │   │       ├── ChatListRow.tsx
    │   │       ├── ReviewCard.tsx
    │   │       └── UserReviews.tsx               exported for M1's profile screen
    │   │
    │   ├── constants/
    │   │   ├── theme.ts                    [S]  §13 — colours, spacing, radius, type, shadow
    │   │   ├── skills.ts                   [S]  §6.1 — THE shared skill taxonomy
    │   │   ├── careerGoals.ts              [S]  §6.2 / §5.1.2 — career goal catalog + helpers
    │   │   ├── skillTestBank.ts            [M1] offline fallback questions for skill tests
    │   │   └── config.ts                   [S]  file size caps, page sizes, AI daily quota
    │   │
    │   ├── types/
    │   │   └── index.ts                    [S]  User, CareerGoal, Credential, Lesson, LessonProgress,
    │   │                                        Session, Booking, Review, Chat, Message, Post
    │   │
    │   └── utils/
    │       ├── storage.ts                  [S]  uploadFile / deleteFile with size guard
    │       ├── authErrors.ts               [S]  Firebase code -> human message
    │       ├── date.ts                     [S]  formatting, relative time, streak comparison
    │       ├── validation.ts               [S]  shared form rules
    │       └── format.ts                   [S]  file size, rating, plural helpers
    │
    ├── assets/
    │   ├── images/
    │   │   ├── icon.png                         1024x1024 app icon
    │   │   ├── adaptive-icon.png                Android adaptive foreground
    │   │   ├── splash.png                       splash screen
    │   │   ├── favicon.png
    │   │   ├── empty-discovery.png              empty-state illustrations —
    │   │   ├── empty-lessons.png                one per major list, in theme colours
    │   │   ├── empty-sessions.png
    │   │   └── empty-chats.png
    │   └── fonts/                               only if you add one heading font
    │
    ├── app.json                            [S]  name, slug, icon, splash, android package
    ├── eas.json                            [S]  preview + development build profiles
    ├── tsconfig.json                       [S]  path alias: "@/*" -> "./src/*"
    ├── package.json                        [S]
    ├── .env                                ***  GITIGNORED — the 6 Firebase vars
    ├── .env.example                        [S]  same keys, blank values, committed
    └── .gitignore                          [S]
```

### 14.1 File-count sanity check

| Area | Files | Owner |
|---|---|---|
| Routes (`app/`) | ~29 | split 4 ways + 6 shared auth/shell |
| Services | 11 | 1–2 each |
| Shared UI (`components/ui/`) | 13 | M4 |
| Component-specific components | ~19 | 4–5 each |
| Constants / types / utils / hooks | 12 | shared |
| Config, optional AI functions, scripts | ~9 | shared |

Roughly **95 files**. If your repo is drifting well past that, someone is building something that isn't in this plan — check before the sprint ends, not during integration week.

### 14.2 `src/types/index.ts` — the single source of truth

Every interface in §7 lives here as a TypeScript type — including `Credential`. **This file is the contract between the four components.** If Member 3 needs a new field on `Booking`, they open a PR and tell the group. Also add:

```ts
export type SkillTag = typeof SKILLS[number]['tag'];
```

so a mistyped tag becomes a *compile* error instead of a query that silently returns nothing.

### 14.3 Two structural conventions worth agreeing on now

1. **A component another member renders is exported from your folder, not copied into theirs.** `UserLessons`, `TeacherSessionsList` and `UserReviews` all live with their owner and are imported by M1. Nobody re-implements someone else's query.
2. **Path alias `@/`** — configure `"@/*": ["./src/*"]` in `tsconfig.json` so imports are `@/services/userService` rather than `../../../src/services/userService`. Set it in Week 1; retrofitting it later touches every file.

---

## 15. 8-Week Timeline

| Week | Whole team | Member 1 | Member 2 | Member 3 | Member 4 |
|---|---|---|---|---|---|
| **1** | Firebase project, repo, Expo app, **Auth built together**, `types/index.ts` + `constants/skills.ts` + `constants/careerGoals.ts` + **`theme.ts` (§13) agreed and merged before any screen** | Onboarding wizard (incl. career goal step) | — | — | Shared UI components, built against the theme |
| **2** | Data model frozen. Tab shell wired. | `userService` + discovery list (category + career-goal browse) | `lessonService` + feed list | `sessionService` + browse list | `chatService` + chat list |
| **3** | Mid-point demo to each other (raw UI, real data) | Profile detail + edit (career goals + skills) | Lesson viewer + create | Session create + detail | Chat screen (GiftedChat) |
| **4** | Re-test the full real-data journey and fix integration failures. | Avatar upload + search/filters (All / Teachers / Learners) | Media upload + flashcards | `requestBooking` transaction + calendar | Reviews + rating transaction |
| **5** | Create all composite indexes. Freeze new features. | **Credentials (§5.1.1)** + **Career goals (§5.1.2)** polish + skill test screen | Quiz runner + progress dashboard | Approve/decline/complete flow | Community feed + posts |
| **6** | **Integration week** — wire all 18 touch points in §6. Full journey end-to-end. **Theme audit: grep every screen file for a raw `#` hex value and remove it.** | | | | |
| **7** | AI features (§11) + **usability testing with 5 outside users** + regression testing | Feature 1 & 2 (7 only if time) | Feature 3 & 4 | Feature 5 | Feature 6 + assistant |
| **8** | Polish, seed demo data, build APK, write report, rehearse the demo twice | | | | |

**Weeks 6–8 are non-negotiable.** Every group underestimates integration. If you're behind in Week 5, cut features (session covers, chat images, post images, video upload) — never cut integration week.

### Demo journey to rehearse (the thread through all four components)
Register → onboarding picks a **career goal** + skills → discovery finds a Python teacher (Browse by Career goal: Software Engineer, or Show: Teachers) → open their profile (rating + verified badge + **goal-grouped wanted skills** + their lessons) → **open one of their credentials and see the actual certificate** → **book a session** → *(switch to teacher account)* approve it → chat about it → mark completed → *(back to learner)* leave a 5-star review → rating updates live on the profile → open a lesson → take the AI-generated quiz → post the achievement to the community feed.

The credential step is short but it's the one that makes the trust story concrete — don't skip it in the demo.

---

## 16. Git Workflow

```bash
git checkout main && git pull
git checkout -b feat/m3-booking-calendar
git add . && git commit -m "feat(booking): add calendar month view with busy dots"
git push -u origin feat/m3-booking-calendar
# → open a PR, one teammate reviews, then merge
```

- Branch naming: `feat/m{1-4}-{thing}`, `fix/m{n}-{thing}`
- **Pull `main` every morning.** A 3-day-old branch in a 4-person repo is a merge conflict waiting to happen.
- Protect `main`: no direct pushes, PRs need one approval.
- `.gitignore` must contain `.env`, `node_modules/`, `.expo/`, `*.log`, `functions/node_modules/`, and any service-account JSON.
- Never commit the Gemini key or a Firebase service account file. If you do, rotate it immediately — GitHub scanning bots find them within minutes.

---

## 17. Things That Are Easy to Forget

### 17.1 Every data-fetching screen needs four states
`loading` (skeleton, not a bare spinner) · `empty` (illustration + a CTA, never a blank screen) · `error` (message + Retry) · `success`. In a UX-graded module, **empty states are marks**. Write `<EmptyState>` once in Week 1 and use it everywhere.

### 17.2 Form validation
Validate on blur, not on every keystroke. Show the error under the field, disable submit while invalid, and show a spinner on the button during submit. Put the rules in `utils/validation.ts` so all four members validate identically.

### 17.3 Always clean up listeners
```ts
useEffect(() => {
  const unsub = subscribeToMessages(chatId, setMessages);
  return unsub;          // ← forgetting this causes memory leaks + "update on unmounted component" warnings
}, [chatId]);
```

### 17.4 Keyboard handling
`KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` on every screen with a text input at the bottom (chat, comments, forms). Android and iOS behave differently — test both if anyone has an iPhone.

### 17.5 Seed script (`scripts/seed.js`)
Write this in Week 5, not Week 8. It creates 6 users, ~15 lessons, ~8 sessions, some bookings, reviews, chats and posts using the Firebase Admin SDK. Being able to reset to a known-good demo state in 30 seconds is worth every minute it takes to write — and it means your demo never depends on live typing.

### 17.6 Accessibility (cheap marks in a UX module)
`accessibilityLabel` on every icon-only button · minimum 44×44 touch targets · 4.5:1 text contrast (the ratios are already computed in §13.3 — cite them) · never encode meaning in colour alone (use `StatusBadge`, which pairs `statusColor` with a text word).

### 17.7 Theme discipline
Nobody writes `color: '#0B7A6D'` in a screen. Everything comes from `theme.ts` (§13). Before integration week, run a search for `#` across `app/` and `src/components/{user,lesson,session,community}/` — every hit is a bug. This one habit is the difference between four components that look like one app and four that look like four.

### 17.8 Build the APK
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview     # produces an installable .apk
```
Do a **test build in Week 6**, not Week 8. First builds fail for boring config reasons and the queue can take 30+ minutes.

### 17.9 Report artefacts to collect as you go
Screenshots of every screen · the Firestore collection diagram (your ER-diagram equivalent, with arrows for which field references which collection, including the `credentials` subcollection) · **the 60:30:10 palette swatch sheet and the contrast table from §13.3** · **one screenshot annotated with its 60/30/10 breakdown** · booking/ratings transaction test evidence · usability test notes from 5 outside users · a "why Firebase over Express/PostgreSQL for a UX-graded module" paragraph · known limitations (stale denormalized names, prefix-only search, self-declared credentials with no admin verification, deferred production hardening, and a client-side AI key if you chose option C).

---

## 18. Per-Member Definition of Done

Tick all of these before you say your component is finished:

- [ ] All screens listed for my component exist and are reachable from a tab or a link
- [ ] Every list screen has loading / empty / error / success states
- [ ] Every form validates and shows human-readable errors (no raw Firebase codes)
- [ ] My service functions are all called from the UI — no dead code
- [ ] All `onSnapshot` listeners are cleaned up in `useEffect` returns
- [ ] My writes use `serverTimestamp()`, never `new Date()`
- [ ] Required composite indexes are created in the console
- [ ] I only read (never write) collections owned by other members
- [ ] All my skill tags/categories come from `constants/skills.ts` (and career goal tags from `constants/careerGoals.ts` if I touch goals)
- [ ] **No raw hex, pixel or font-size value appears in any file I own** — everything comes from `theme.ts` (§13)
- [ ] **Every status I display uses `StatusBadge`** (colour *and* a word), never colour alone
- [ ] Every integration point in §6 that touches me is wired and tested against another member's real screen
- [ ] Tested on a **real phone**, not just the emulator
- [ ] My AI feature degrades gracefully with the network off

**Member 1 additionally:**
- [ ] The credentials section is hidden for `role: 'learner'` and appears immediately when the role is changed
- [ ] A learner on someone else's profile can open a credential and see the actual file
- [ ] Deleting a credential removes the Storage file, the document, **and** decrements both counters
- [ ] Public-profile credential queries include `visibility == 'public'`; the owner view can still show private credentials
- [ ] Career-goal / wanted-skill UI is hidden for `role: 'teacher'`; skills-offered UI is hidden for `role: 'learner'`
- [ ] Saving career goals recomputes `skillsWanted` / `skillTagsWanted` via `deriveWantedSkills` — M2/M3 can still default filters off those fields
- [ ] Discovery Browse-by Career goal returns teachers who offer any skill in that goal's curriculum
- [ ] Onboarding allows skipping the goal step; skipped picks land in `extraSkillsWanted`

---

## 19. Risk Checklist (review every Monday)

- [ ] Can the final demo accounts still read, write and upload successfully in the shared Firebase project?
- [ ] Does everyone agree on the exact field names? Any query returning `[]` is a typo until proven otherwise.
- [ ] Are all composite indexes created, and did they finish building?
- [ ] Is the booking transaction actually preventing overbooking? Test it: two phones, one seat, tap simultaneously.
- [ ] Is the rating average correct after 5 reviews? (Compute by hand and compare.)
- [ ] Is `getReactNativePersistence` wired, or are users logged out on every app restart?
- [ ] Is the Gemini key server-side — or, if not, is that documented and is the key scheduled for rotation after the demo?
- [ ] Is Storage usage under 5 GB? (Check the console — lesson video and credential scans are the usual culprits.)
- [ ] Has anyone hardcoded a colour instead of importing it from `theme.ts`? (Search for `#` in screen files.)
- [ ] Do orphaned Storage files exist — credentials or lesson media whose document was deleted but whose file wasn't?
- [ ] Has anyone accidentally committed `.env`?
- [ ] Do service functions reject invalid ownership/status actions, such as another user completing a booking?
- [ ] Do you have a working APK **and** an Expo Go fallback for demo day? Campus Wi-Fi fails at the worst moment.
- [ ] Has someone rehearsed the full demo journey (§15) end-to-end, out loud, twice?

---

## 20. Quick Command Reference

```bash
# App
npx expo start                     # dev server; scan QR with Expo Go
npx expo start -c                  # clear cache when something looks stale
npx tsc --noEmit                   # type-check the whole project

# Firebase
npm install -g firebase-tools
firebase login
firebase init                      # indexes and functions, only when needed
firebase deploy --only firestore:indexes
firebase deploy --only functions
firebase functions:secrets:set GEMINI_API_KEY

# Build
eas build -p android --profile preview

# Seed demo data
node scripts/seed.js
```

---

## 21. One-Page Summary (for your report's overview section)

> SkillBridge is a peer-to-peer skill-exchange app for campus communities, built with React Native (Expo) and Firebase. Learners discover peers by skill, inspect teacher credentials, study teacher-created YouTube/PDF lessons with progress tracking, book one-to-one or group sessions, chat in real time, share community posts, and leave feedback afterwards — building a reputation system that makes free peer teaching trustworthy. It addresses **SDG 4 (Quality Education)** by making learning free and peer-driven, and **SDG 8 (Decent Work)** by rewarding peer teaching with reputation and Skill Credits.
>
> The architecture is deliberately serverless: Firebase provides authentication, document storage and file storage; client service functions centralize validation; and Firestore transactions protect seat allocation, ratings and counters. Four members each own one vertical slice — Discovery, Micro-Learning, Sessions, and Community — connected through documented integration points, one shared skill taxonomy (plus a career-goal catalog layered on top for learners), and a single design system built on a 60:30:10 colour ratio with WCAG AA-verified contrast throughout. Gemini remains an optional later enhancement after the campus demo flow is stable.
