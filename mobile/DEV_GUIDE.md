# SkillBridge — Team Dev Guide

Expo Go no longer runs SkillBridge, because LiveKit video needs native code.
Code on the **development build**, test on the **preview APK**, and let `main`
ship your changes: every merge reaches testers automatically.

## The two apps

| App | Use it for | Get it from |
|---|---|---|
| **Development build** | Coding. Loads your JS from your laptop with hot reload. | expo.dev → `skillbridge-team` → `skillbridge` → Builds → latest **development** |
| **Preview APK** | Testing and demos as a real user. Receives updates from `main`. | Same place → latest **preview** |

Both use the app ID `com.sliit.skillbridge.app`, so only one can be installed at
a time. Installing one replaces the other.

## 1. One-time setup

1. Uninstall any older SkillBridge test build from your phone.
2. Accept the invite to the `skillbridge-team` Expo organization.
3. Open the development build link on your phone and install the APK.
4. Clone and install:

```bash
git clone https://github.com/Vihanga-02/SkillBridge.git
cd SkillBridge/mobile
npm install
cp .env.example .env   # paste the 6 Firebase values from the group chat
```

## 2. Making a change

1. Start from the latest `main`:
   ```bash
   git checkout main
   git pull
   npm install          # needed when package.json changed
   ```
2. Create a branch: `git checkout -b feat/<short-name>` (or `fix/<short-name>`).
3. Start the dev server from `mobile/`:
   ```bash
   npx expo start --dev-client
   ```
   Add `-c` after editing `.env` or when something looks stale.
4. Open the **development build** on your phone. Your laptop and phone must be on
   the same Wi-Fi, or use `npx expo start --dev-client --tunnel`.
5. Edit code. The app reloads on save.

## 3. JS change or native change?

| Change | Examples | What to do |
|---|---|---|
| **JS/TS only** | Screens, services, styles, images | Nothing extra. Hot reload shows it. |
| **Native** | A new package with native code, `app.json` plugins, permissions, icon, splash, app ID | Announce it in the group first (`app.json` is a shared file). After merge, rebuild the dev build and everyone installs it: `npx eas-cli build -p android --profile development` |

Not sure which kind it is? Ask in the group before merging.

## 4. Before opening a PR

Run these from `mobile/`. All must pass:

```bash
npx tsc --noEmit
npx expo lint
npx jest
```

If you changed `mobile/functions/`, also run `npm run build` inside
`mobile/functions/`.

CI runs the same checks on every PR (**Typecheck, lint, test** and **Cloud
Functions build**). A PR cannot merge until both pass. The house rules in
[README.md](README.md) still apply.

## 5. After merge

Merging to `main` runs the **Deploy app** workflow (GitHub → Actions):

```
merge to main
  → checks run again
  → compare the app's native fingerprint with existing builds
      ├─ JS-only change → OTA update to the preview channel
      │                   testers close and reopen the app twice
      └─ native change  → new preview APK builds on expo.dev
                          share the link; testers install it
```

## 6. Cloud Functions

Changes in `mobile/functions/` are **not** deployed automatically. After merge,
the person responsible for functions deploys from an up-to-date `main`:

```bash
cd mobile
git checkout main
git pull
npx firebase-tools deploy --only functions --project concise-kayak-468613-m9
```

If a change touches both the function and the app, deploy the function first
and keep it working with the old app version.

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| App crashes on start with a missing env error | Check `.env` has all 6 values, then `npx expo start --dev-client -c` |
| Dev build can't reach your laptop | Same Wi-Fi, or add `--tunnel` |
| "App not installed" when installing an APK | Uninstall the old SkillBridge first (signed with a different key) |
| Lint error about a package you just installed | `npx expo lint --no-cache` |
| Metro behaves strangely | `npx expo start --dev-client -c` |
| Preview APK doesn't show the latest `main` | Close and reopen twice; check the Deploy app run passed in GitHub Actions |
| Video call fails to join | `npx firebase-tools functions:log --only createLiveKitToken --project concise-kayak-468613-m9` |
