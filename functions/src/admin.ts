import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp();
}

/** Admin writes bypass client Firestore Rules; never import this into the Expo app. */
export const adminDb = getFirestore();
