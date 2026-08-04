import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// `getReactNativePersistence` exists in firebase/auth's React Native bundle but is
// missing from its published web type definitions, so this import needs silencing.
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  throw new Error(
    `Firebase config is incomplete (${missingKeys.join(', ')}). Copy .env.example to .env, ` +
      'fill in the six EXPO_PUBLIC_FIREBASE_* values, then restart with `npx expo start -c`.'
  );
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createAuth(): Auth {
  try {
    /**
     * initializeAuth + AsyncStorage persistence — NOT getAuth(app).
     * With plain getAuth() the user is signed out every time the app restarts.
     */
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Fast Refresh re-runs this module; Auth is already initialized for this app.
    return getAuth(app);
  }
}

export const auth = createAuth();

/**
 * If `onSnapshot` listeners hang forever on a restricted campus/hostel network,
 * swap this for `initializeFirestore(app, { experimentalForceLongPolling: true })`.
 */
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;
