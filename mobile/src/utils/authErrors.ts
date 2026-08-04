/**
 * Firebase error code -> human message. `auth/invalid-credential` must never
 * reach a user in a UX-graded module.
 */

const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'That email is already registered. Try logging in.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/missing-password': 'Please enter your password.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
  'auth/network-request-failed': 'No internet connection. Please try again.',
  'auth/requires-recent-login': 'Please log in again to continue.',
  'auth/operation-not-allowed':
    'Email sign-in is not enabled for this project. Enable it in the Firebase console.',
  'permission-denied': "You don't have permission to do that.",
  unavailable: 'Cannot reach the server. Check your connection and try again.',
};

export const authErrorMessage = (code: string): string =>
  MESSAGES[code] ?? 'Something went wrong. Please try again.';

/** Pulls the code off an unknown thrown value, so screens never inspect it themselves. */
export function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return authErrorMessage(String((error as { code: unknown }).code));
  }
  if (error instanceof Error && error.message) return error.message;
  return authErrorMessage('unknown');
}
