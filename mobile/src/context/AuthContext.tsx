/**
 * The one place the app learns who is signed in.
 *
 * Listens to two things:
 *  - `onAuthStateChanged` — is someone logged in?
 *  - `onSnapshot(users/{uid})` — the live profile, so a name or avatar change
 *    reflects instantly on every screen that shows it.
 *
 * No screen may call `auth.currentUser` directly (integration contract #1).
 */

import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { auth, db } from '@/firebase/config';
import type { User } from '@/types';
import { errorMessage } from '@/utils/authErrors';

export type AuthContextValue = {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  /** True until BOTH the auth state and (if signed in) the profile have resolved. */
  loading: boolean;
  /** Profile-read failure, e.g. rules denied or the device is offline. */
  error: string | null;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const toProfile = (uid: string, data: Record<string, unknown>): User =>
  ({ ...data, uid }) as User;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  const [profile, setProfile] = useState<User | null>(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uid = firebaseUser?.uid ?? null;

  useEffect(() => {
    // Persistence is AsyncStorage-backed, so on a cold start this fires with the
    // restored user rather than null — which is what keeps people logged in.
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthResolved(true);
    });
  }, []);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setProfileResolved(true);
      setError(null);
      return;
    }

    setProfileResolved(false);

    const unsubscribe = onSnapshot(
      doc(db, 'users', uid),
      (snapshot) => {
        setProfile(snapshot.exists() ? toProfile(uid, snapshot.data()) : null);
        setProfileResolved(true);
        setError(null);
      },
      (snapshotError) => {
        setProfile(null);
        setProfileResolved(true);
        setError(errorMessage(snapshotError));
      }
    );

    return unsubscribe;
  }, [uid]);

  const refreshProfile = useCallback(async () => {
    if (!uid) return;
    try {
      const snapshot = await getDoc(doc(db, 'users', uid));
      setProfile(snapshot.exists() ? toProfile(uid, snapshot.data()) : null);
      setError(null);
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [uid]);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      // Waiting for the profile too means routing never flashes the onboarding
      // screen at an already-onboarded user during the one-frame gap.
      loading: !authResolved || (uid !== null && !profileResolved),
      error,
      refreshProfile,
    }),
    [firebaseUser, profile, authResolved, uid, profileResolved, error, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
