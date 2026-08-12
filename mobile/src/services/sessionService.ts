/**
 * Component 3 — Peer Sessions.
 *
 * `sessions/{sessionId}` is a teacher's offer. Bookings claim seats; seat counts
 * only move inside `bookingService` transactions so two learners cannot take
 * the last seat at once.
 */

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { skillByTag } from '@/constants/skills';
import { db } from '@/firebase/config';
import type {
  Category,
  Level,
  Session,
  SessionMode,
  SessionStatus,
  SessionType,
  SkillTag,
  User,
} from '@/types';

export type CreateSessionInput = {
  title: string;
  description: string;
  skillTag: SkillTag;
  level: Level;
  type: SessionType;
  mode: SessionMode;
  meetingLink: string;
  locationText: string;
  /** Local date 'YYYY-MM-DD' */
  date: string;
  /** Local time 'HH:mm' (24h) */
  time: string;
  durationMins: number;
  capacity: number;
};

const sessionsCol = collection(db, 'sessions');

const toSession = (snapshot: QueryDocumentSnapshot<DocumentData>): Session =>
  ({ ...snapshot.data(), id: snapshot.id }) as Session;

function parseLocalStart(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const snapshot = await getDoc(doc(db, 'sessions', sessionId));
  return snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as Session) : null;
}

export type UpcomingSessionFilters = {
  teacherId?: string;
  skillTag?: SkillTag;
};

/** Browseable future sessions. Client sorting keeps this independent of indexes. */
export async function listUpcomingSessions(
  filters: UpcomingSessionFilters = {}
): Promise<Session[]> {
  const source = filters.teacherId
    ? query(sessionsCol, where('teacherId', '==', filters.teacherId))
    : sessionsCol;
  const snapshot = await getDocs(source);
  const now = Date.now();

  return snapshot.docs
    .map(toSession)
    .filter((session) => {
      if (session.status !== 'open') return false;
      if ((session.startAt?.toMillis?.() ?? 0) <= now) return false;
      if (filters.skillTag && session.skillTag !== filters.skillTag) return false;
      return true;
    })
    .sort((a, b) => (a.startAt?.toMillis?.() ?? 0) - (b.startAt?.toMillis?.() ?? 0));
}

/**
 * Open (and full) upcoming sessions for a teacher — powers the Book a Session
 * screen on their public profile.
 */
export async function getOpenSessionsByTeacher(teacherId: string): Promise<Session[]> {
  let rows: Session[] = [];
  try {
    const snapshot = await getDocs(
      query(sessionsCol, where('teacherId', '==', teacherId), orderBy('startAt', 'asc'))
    );
    rows = snapshot.docs.map(toSession);
  } catch {
    // Composite index may be missing — fall back so the book screen still loads.
    const snapshot = await getDocs(query(sessionsCol, where('teacherId', '==', teacherId)));
    rows = snapshot.docs
      .map(toSession)
      .sort((a, b) => (a.startAt?.toMillis?.() ?? 0) - (b.startAt?.toMillis?.() ?? 0));
  }

  const now = Date.now();
  return rows.filter((session) => {
    if (session.status === 'cancelled' || session.status === 'completed') return false;
    const startMs = session.startAt?.toMillis?.() ?? 0;
    return startMs >= now;
  });
}

/** Every session this teacher hosts — used on the Sessions tab "Teaching" view. */
export async function getSessionsByTeacher(teacherId: string): Promise<Session[]> {
  try {
    const snapshot = await getDocs(
      query(sessionsCol, where('teacherId', '==', teacherId), orderBy('startAt', 'desc'))
    );
    return snapshot.docs.map(toSession);
  } catch {
    const snapshot = await getDocs(query(sessionsCol, where('teacherId', '==', teacherId)));
    return snapshot.docs
      .map(toSession)
      .sort((a, b) => (b.startAt?.toMillis?.() ?? 0) - (a.startAt?.toMillis?.() ?? 0));
  }
}

export async function createSession(teacher: User, input: CreateSessionInput): Promise<string> {
  if (teacher.role === 'learner') {
    throw new Error('Only teachers can create sessions.');
  }

  const skill = skillByTag(input.skillTag);
  if (!skill) throw new Error('Pick a skill from the SkillBridge list.');
  if (!teacher.skillTagsOffered.includes(input.skillTag)) {
    throw new Error('You can only offer sessions for skills on your profile.');
  }

  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length < 3 || title.length > 120) {
    throw new Error('Title must be between 3 and 120 characters.');
  }
  if (description.length < 10 || description.length > 1000) {
    throw new Error('Description must be between 10 and 1000 characters.');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) {
    throw new Error('Use a valid 24-hour time such as 18:00.');
  }

  const startDate = parseLocalStart(input.date, input.time);
  if (Number.isNaN(startDate.getTime())) throw new Error('Pick a valid date and time.');
  if (startDate.getTime() <= Date.now()) throw new Error('Sessions must start in the future.');
  if (input.durationMins < 15 || input.durationMins > 240) {
    throw new Error('Duration must be between 15 and 240 minutes.');
  }

  const capacity = input.type === 'one_to_one' ? 1 : Math.max(2, Math.floor(input.capacity));
  if (input.type === 'group' && capacity < 2) {
    throw new Error('Group sessions need at least 2 seats.');
  }
  if (capacity > 50) throw new Error('A session can have at most 50 seats.');

  if (input.mode === 'online' && !input.meetingLink.trim()) {
    throw new Error('Online sessions need a meeting link.');
  }
  if (input.mode === 'online' && !/^https:\/\//i.test(input.meetingLink.trim())) {
    throw new Error('Meeting links must start with https://.');
  }
  if (input.mode === 'in_person' && !input.locationText.trim()) {
    throw new Error('In-person sessions need a location.');
  }

  const startAt = Timestamp.fromDate(startDate);
  const endAt = Timestamp.fromDate(new Date(startDate.getTime() + input.durationMins * 60_000));
  const ref = doc(sessionsCol);

  const batch = writeBatch(db);
  batch.set(ref, {
    id: ref.id,
    teacherId: teacher.uid,
    teacherName: teacher.name,
    teacherAvatarUrl: teacher.avatarUrl ?? '',
    teacherRatingAvg: teacher.ratingAvg ?? 0,
    title,
    description,
    descriptionSource: 'manual',
    skillTag: input.skillTag,
    category: skill.category as Category,
    level: input.level,
    type: input.type,
    mode: input.mode,
    meetingLink: '',
    locationText: input.mode === 'in_person' ? input.locationText.trim() : '',
    startAt,
    durationMins: input.durationMins,
    endAt,
    capacity,
    seatsTaken: 0,
    status: 'open' satisfies SessionStatus,
    coverImageUrl: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (input.mode === 'online') {
    batch.set(doc(db, 'sessionSecrets', ref.id), {
      sessionId: ref.id,
      teacherId: teacher.uid,
      meetingLink: input.meetingLink.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  return ref.id;
}

export async function cancelSession(sessionId: string, teacherId: string): Promise<void> {
  const existing = await getSession(sessionId);
  if (!existing) throw new Error('Session no longer exists.');
  if (existing.teacherId !== teacherId) throw new Error('Only the host can cancel this session.');

  await updateDoc(doc(db, 'sessions', sessionId), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
}
