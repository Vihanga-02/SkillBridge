# LiveKit development setup

The application code is ready, but LiveKit credentials and the native Android
binary must be created once for each Firebase/LiveKit environment.

## 1. Create a LiveKit Cloud project

In the LiveKit Cloud dashboard, copy the project WebSocket URL, API key, and API
secret. The URL must start with `wss://`.

Do not add these values to the mobile `.env` file or commit them to Git.

## 2. Store credentials in the existing Firebase project

Run these commands from `mobile/`. Pass the existing Firebase project id
explicitly so the CLI does not change the project's saved alias.

```bash
npx firebase-tools functions:secrets:set LIVEKIT_URL --project <firebase-project-id>
npx firebase-tools functions:secrets:set LIVEKIT_API_KEY --project <firebase-project-id>
npx firebase-tools functions:secrets:set LIVEKIT_API_SECRET --project <firebase-project-id>
```

Paste one corresponding LiveKit value when each command prompts for it.

Deploy only the Functions source:

```bash
npx firebase-tools deploy --only functions --project <firebase-project-id>
```

The callable function uses `us-central1`, matching the Firebase client default.

## 3. Build the Android development client

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile development
```

Install the resulting APK on the Android phone. LiveKit contains native WebRTC
code and therefore cannot run in Expo Go.

For normal JavaScript/TypeScript development after installing the APK:

```bash
npx expo start --dev-client --clear
```

A new APK is needed only when native dependencies or native app configuration
change.

## 4. Test teacher-to-learner joining

1. A teacher creates an online session. No external meeting link is required.
2. A learner requests the session.
3. The teacher approves the booking.
4. The teacher opens the session or booking and taps **Join in-app meeting**.
5. The confirmed learner opens the booking and taps the same button.
6. Firebase issues separate short-lived tokens that put both users in the room
   named from the session id.

Pending, declined, and cancelled learners are rejected by the backend even if
they discover the meeting route.
