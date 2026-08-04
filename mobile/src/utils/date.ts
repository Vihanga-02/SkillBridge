import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

/**
 * Firestore hands back `null` for a `serverTimestamp()` that has not been
 * acknowledged yet, so every read has to tolerate a missing value.
 */
export const toDate = (value: Timestamp | null | undefined): Date | null =>
  value ? value.toDate() : null;

export function formatDate(value: Timestamp | null | undefined, pattern = 'd MMM yyyy'): string {
  const date = toDate(value);
  return date ? format(date, pattern) : '—';
}
