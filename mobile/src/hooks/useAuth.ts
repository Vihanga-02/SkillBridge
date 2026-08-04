import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '@/context/AuthContext';

/** `const { profile, loading } = useAuth();` — every screen uses this. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>. Check app/_layout.tsx.');
  }
  return context;
}
