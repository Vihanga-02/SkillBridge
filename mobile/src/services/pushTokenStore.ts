/**
 * Where a user's push token lives. Firestore only — no native modules — so the
 * auth service can clear the token on logout without pulling notification code
 * into every screen and test that imports it.
 */

import { deleteField, doc, updateDoc } from 'firebase/firestore';

import { db } from '@/firebase/config';

export async function saveExpoPushToken(uid: string, token: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { expoPushToken: token });
}

/**
 * Stops this account's notifications reaching the phone it is signing out of.
 * Must run while still signed in (the rules require auth). Never throws, so a
 * failure here can never block logging out.
 */
export async function clearExpoPushToken(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), { expoPushToken: deleteField() });
  } catch (error) {
    console.warn('Could not clear push token:', error);
  }
}
