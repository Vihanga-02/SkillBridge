import type { DocumentData, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';

/**
 * The paging cursor is the last document snapshot of the previous page, which is
 * what `startAfter` needs. `null` means "start from the beginning" on the way in,
 * and "there is nothing after this" on the way out.
 */
export type PageCursor = QueryDocumentSnapshot<DocumentData> | null;

/** Only hand back a cursor when the page was full — otherwise the list is done. */
export function nextCursor(snapshot: QuerySnapshot<DocumentData>, pageSize: number): PageCursor {
  if (snapshot.docs.length < pageSize) return null;
  return snapshot.docs[snapshot.docs.length - 1] ?? null;
}
