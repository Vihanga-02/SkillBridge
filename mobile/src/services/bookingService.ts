/**
 * Component 3 — Bookings.
 *
 * A booking is a learner's claim on a seat. Seat counts move only inside
 * transactions so two taps on the last seat cannot both succeed.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/firebase/config';
import type { Booking, BookingStatus, Session, User } from '@/types';

const bookingsCol = collection(db, 'bookings');

/** One learner can hold at most one booking record for a session. */
export const bookingIdFor = (sessionId: string, learnerId: string): string =>
  `${sessionId}_${learnerId}`;

const toBooking = (snapshot: QueryDocumentSnapshot<DocumentData>): Booking =>
  ({ ...snapshot.data(), id: snapshot.id }) as Booking;

export async function getBooking(bookingId: string): Promise<Booking | null> {
  const snapshot = await getDoc(doc(db, 'bookings', bookingId));
  return snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as Booking) : null;
}

export function getBookingForSession(
  sessionId: string,
  learnerId: string
): Promise<Booking | null> {
  return getBooking(bookingIdFor(sessionId, learnerId));
}

function sortBookingsDesc(rows: Booking[]): Booking[] {
  return [...rows].sort((a, b) => (b.startAt?.toMillis?.() ?? 0) - (a.startAt?.toMillis?.() ?? 0));
}

/** Single `array-contains` query — why participantIds exists on every booking. */
export async function getMyBookings(uid: string): Promise<Booking[]> {
  try {
    const snapshot = await getDocs(
      query(bookingsCol, where('participantIds', 'array-contains', uid), orderBy('startAt', 'desc'))
    );
    return snapshot.docs.map(toBooking);
  } catch {
    const snapshot = await getDocs(
      query(bookingsCol, where('participantIds', 'array-contains', uid))
    );
    return sortBookingsDesc(snapshot.docs.map(toBooking));
  }
}

export function subscribeToMyBookings(
  uid: string,
  onNext: (bookings: Booking[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  // Sort client-side so the Sessions tab works without a composite index.
  return onSnapshot(
    query(bookingsCol, where('participantIds', 'array-contains', uid)),
    (snapshot) => onNext(sortBookingsDesc(snapshot.docs.map(toBooking))),
    (error) => onError?.(error)
  );
}

/**
 * Learner claims a seat. Status starts as `pending` until the teacher approves.
 * If this was the last seat, the session flips to `full` in the same write.
 */
export async function requestBooking(
  session: Session,
  learner: User,
  note = ''
): Promise<string> {
  if (session.teacherId === learner.uid) {
    throw new Error('You cannot book your own session.');
  }
  if (learner.role === 'teacher') {
    throw new Error('Switch to Teach & learn before booking a session.');
  }

  const bookingRef = doc(db, 'bookings', bookingIdFor(session.id, learner.uid));

  await runTransaction(db, async (tx) => {
    const sessionRef = doc(db, 'sessions', session.id);
    const [snap, existingBooking] = await Promise.all([
      tx.get(sessionRef),
      tx.get(bookingRef),
    ]);
    if (!snap.exists()) throw new Error('This session no longer exists.');

    const live = snap.data() as Session;
    if (
      existingBooking.exists() &&
      ['pending', 'confirmed', 'completed'].includes(
        (existingBooking.data() as Booking).status
      )
    ) {
      throw new Error('You already have a booking for this session.');
    }
    if (live.status !== 'open') throw new Error('This session is closed.');
    if (live.seatsTaken >= live.capacity) throw new Error('This session is full.');
    if (live.teacherId === learner.uid) throw new Error('You cannot book your own session.');
    if ((live.startAt?.toMillis?.() ?? 0) <= Date.now()) {
      throw new Error('This session has already started.');
    }

    const nextTaken = live.seatsTaken + 1;

    tx.update(sessionRef, {
      seatsTaken: nextTaken,
      bookingCount: increment(1),
      status: nextTaken >= live.capacity ? 'full' : 'open',
      updatedAt: serverTimestamp(),
    });

    tx.set(bookingRef, {
      id: bookingRef.id,
      sessionId: session.id,
      sessionTitle: live.title,
      skillTag: live.skillTag,
      startAt: live.startAt,
      durationMins: live.durationMins,
      mode: live.mode,
      // Added only when the teacher approves. Pending requests never receive it.
      meetingLink: '',
      locationText: live.locationText ?? '',
      teacherId: live.teacherId,
      teacherName: live.teacherName,
      teacherAvatarUrl: live.teacherAvatarUrl ?? '',
      learnerId: learner.uid,
      learnerName: learner.name,
      learnerAvatarUrl: learner.avatarUrl ?? '',
      participantIds: [live.teacherId, learner.uid],
      note: note.trim(),
      status: 'pending' satisfies BookingStatus,
      cancelReason: '',
      reviewedByLearner: false,
      reviewedByTeacher: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return bookingRef.id;
}

export async function approveBooking(bookingId: string, teacherId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const bookingRef = doc(db, 'bookings', bookingId);
    const snap = await tx.get(bookingRef);
    if (!snap.exists()) throw new Error('Booking no longer exists.');

    const booking = snap.data() as Booking;
    if (booking.teacherId !== teacherId) {
      throw new Error('Only the teacher can approve this booking.');
    }
    if (booking.status !== 'pending') {
      throw new Error('Only pending bookings can be approved.');
    }

    const sessionRef = doc(db, 'sessions', booking.sessionId);
    const secretRef = doc(db, 'sessionSecrets', booking.sessionId);
    const [sessionSnap, secretSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(secretRef),
    ]);
    if (!sessionSnap.exists()) throw new Error('The session no longer exists.');

    const session = sessionSnap.data() as Session;
    if (session.status === 'cancelled' || session.status === 'completed') {
      throw new Error('This session is no longer accepting bookings.');
    }
    const meetingLink =
      booking.mode === 'online'
        ? ((secretSnap.data()?.meetingLink as string | undefined) ?? session.meetingLink ?? '')
        : '';

    tx.update(bookingRef, {
      status: 'confirmed' satisfies BookingStatus,
      meetingLink,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Teacher declines a pending request and returns the seat to the session.
 */
export async function declineBooking(
  bookingId: string,
  teacherId: string,
  reason = ''
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists()) throw new Error('Booking no longer exists.');

    const booking = bookingSnap.data() as Booking;
    if (booking.teacherId !== teacherId) {
      throw new Error('Only the teacher can decline this booking.');
    }
    if (booking.status !== 'pending') {
      throw new Error('Only pending bookings can be declined.');
    }

    const sessionRef = doc(db, 'sessions', booking.sessionId);
    const sessionSnap = await tx.get(sessionRef);

    tx.update(bookingRef, {
      status: 'declined' satisfies BookingStatus,
      cancelReason: reason.trim(),
      updatedAt: serverTimestamp(),
    });

    if (sessionSnap.exists()) {
      const session = sessionSnap.data() as Session;
      const nextTaken = Math.max(0, (session.seatsTaken ?? 0) - 1);
      const nextStatus =
        session.status === 'cancelled' || session.status === 'completed'
          ? session.status
          : nextTaken >= session.capacity
            ? 'full'
            : 'open';

      tx.update(sessionRef, {
        seatsTaken: nextTaken,
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function cancelBooking(bookingId: string, byUid: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists()) throw new Error('Booking no longer exists.');

    const booking = bookingSnap.data() as Booking;
    if (booking.learnerId !== byUid && booking.teacherId !== byUid) {
      throw new Error('You cannot cancel this booking.');
    }
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      throw new Error('This booking can no longer be cancelled.');
    }

    const sessionRef = doc(db, 'sessions', booking.sessionId);
    const sessionSnap = await tx.get(sessionRef);

    tx.update(bookingRef, {
      status: 'cancelled' satisfies BookingStatus,
      updatedAt: serverTimestamp(),
    });

    if (sessionSnap.exists() && (booking.status === 'pending' || booking.status === 'confirmed')) {
      const session = sessionSnap.data() as Session;
      const nextTaken = Math.max(0, (session.seatsTaken ?? 0) - 1);
      const nextStatus =
        session.status === 'cancelled' || session.status === 'completed'
          ? session.status
          : nextTaken >= session.capacity
            ? 'full'
            : 'open';

      tx.update(sessionRef, {
        seatsTaken: nextTaken,
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

/** Teacher completes a confirmed booking and updates both participants' stats. */
export async function markCompleted(bookingId: string, teacherId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const bookingRef = doc(db, 'bookings', bookingId);
    const snapshot = await tx.get(bookingRef);
    if (!snapshot.exists()) throw new Error('Booking no longer exists.');

    const booking = snapshot.data() as Booking;
    if (booking.teacherId !== teacherId) {
      throw new Error('Only the teacher can complete this booking.');
    }
    if (booking.status !== 'confirmed') {
      throw new Error('Only confirmed bookings can be completed.');
    }

    const endMs =
      (booking.startAt?.toMillis?.() ?? 0) + booking.durationMins * 60_000;
    if (endMs > Date.now()) {
      throw new Error('Complete the booking after the session has ended.');
    }

    tx.update(bookingRef, {
      status: 'completed' satisfies BookingStatus,
      updatedAt: serverTimestamp(),
    });
    tx.update(doc(db, 'users', booking.teacherId), {
      'stats.sessionsTaught': increment(1),
      updatedAt: serverTimestamp(),
    });
    tx.update(doc(db, 'users', booking.learnerId), {
      'stats.sessionsAttended': increment(1),
      updatedAt: serverTimestamp(),
    });
  });
}
