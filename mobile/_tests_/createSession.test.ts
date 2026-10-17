jest.mock('@/firebase/config', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  Timestamp: { fromDate: jest.fn((date: Date) => ({ toMillis: () => date.getTime() })) },
  collection: jest.fn((_db, path) => ({ path })),
  doc: jest.fn((collectionRef) => ({ path: `${collectionRef.path}/session-1`, id: 'session-1' })),
  getDocs: jest.fn(),
  query: jest.fn((collectionRef, ...filters) => ({ collectionRef, filters })),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  getDoc: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-time'),
  writeBatch: jest.fn(),
}));

import { getDocs, writeBatch } from 'firebase/firestore';

import { createSession, type CreateSessionInput } from '@/services/sessionService';
import type { User } from '@/types';

const teacher = {
  uid: 'teacher-1',
  name: 'Nimal',
  role: 'teacher',
  avatarUrl: 'avatar.jpg',
  ratingAvg: 4.8,
  skillTagsOffered: ['javascript'],
} as User;

const validInput: CreateSessionInput = {
  title: '  JavaScript basics  ',
  description: '  Learn JavaScript fundamentals together.  ',
  skillTag: 'javascript',
  level: 'beginner',
  type: 'group',
  mode: 'online',
  locationText: 'ignored for online sessions',
  date: '2030-06-15',
  time: '18:30',
  durationMins: 60,
  capacity: 8,
};

let batchSet: jest.Mock;
let batchCommit: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date(2030, 0, 1, 12));
  batchSet = jest.fn();
  batchCommit = jest.fn().mockResolvedValue(undefined);
  (writeBatch as jest.Mock).mockReturnValue({ set: batchSet, commit: batchCommit });
  (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
});

afterEach(() => jest.useRealTimers());

it('creates a trimmed online group session with the expected defaults', async () => {
  await expect(createSession(teacher, validInput)).resolves.toBe('session-1');

  expect(batchSet).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'session-1' }),
    expect.objectContaining({
      id: 'session-1',
      teacherId: 'teacher-1',
      teacherName: 'Nimal',
      title: 'JavaScript basics',
      description: 'Learn JavaScript fundamentals together.',
      category: 'Programming',
      type: 'group',
      mode: 'online',
      locationText: '',
      capacity: 8,
      seatsTaken: 0,
      bookingCount: 0,
      status: 'open',
      createdAt: 'server-time',
      updatedAt: 'server-time',
    })
  );
  const saved = batchSet.mock.calls[0][1];
  expect(saved.startAt.toMillis()).toBe(new Date(2030, 5, 15, 18, 30).getTime());
  expect(saved.endAt.toMillis()).toBe(new Date(2030, 5, 15, 19, 30).getTime());
  expect(batchCommit).toHaveBeenCalledTimes(1);
});

it('forces a one-to-one session to one seat and keeps a trimmed location', async () => {
  await createSession(teacher, {
    ...validInput,
    type: 'one_to_one',
    mode: 'in_person',
    locationText: '  Colombo  ',
    capacity: 40,
  });

  expect(batchSet.mock.calls[0][1]).toMatchObject({ capacity: 1, locationText: 'Colombo' });
});

it.each([
  ['a learner', { ...teacher, role: 'learner' }, validInput, 'Only teachers'],
  ['a skill missing from the profile', teacher, { ...validInput, skillTag: 'python' }, 'skills on your profile'],
  ['a short title', teacher, { ...validInput, title: 'Hi' }, 'Title must be'],
  ['a short description', teacher, { ...validInput, description: 'Too short' }, 'Description must be'],
  ['an invalid time', teacher, { ...validInput, time: '25:00' }, 'valid 24-hour time'],
  ['a past start time', teacher, { ...validInput, date: '2029-12-31' }, 'start in the future'],
  ['a short duration', teacher, { ...validInput, durationMins: 10 }, 'Duration must be'],
  ['too many seats', teacher, { ...validInput, capacity: 51 }, 'at most 50 seats'],
  ['an empty in-person location', teacher, { ...validInput, mode: 'in_person', locationText: '  ' }, 'need a location'],
])('rejects %s without writing', async (_label, user, input, message) => {
  await expect(createSession(user as User, input as CreateSessionInput)).rejects.toThrow(message);
  expect(batchSet).not.toHaveBeenCalled();
  expect(batchCommit).not.toHaveBeenCalled();
});

it('rejects a session that overlaps another active session by the teacher', async () => {
  (getDocs as jest.Mock).mockResolvedValue({
    docs: [{
      id: 'existing',
      data: () => ({
        title: 'Existing class',
        status: 'open',
        startAt: { toMillis: () => new Date(2030, 5, 15, 18).getTime() },
        endAt: { toMillis: () => new Date(2030, 5, 15, 19).getTime() },
        durationMins: 60,
      }),
    }],
  });

  await expect(createSession(teacher, validInput)).rejects.toThrow(
    'You already created "Existing class" during this time'
  );
  expect(batchCommit).not.toHaveBeenCalled();
});

it('allows the same time when the existing session is cancelled', async () => {
  (getDocs as jest.Mock).mockResolvedValue({
    docs: [{
      id: 'cancelled',
      data: () => ({
        title: 'Cancelled class',
        status: 'cancelled',
        startAt: { toMillis: () => new Date(2030, 5, 15, 18).getTime() },
        durationMins: 60,
      }),
    }],
  });

  await expect(createSession(teacher, validInput)).resolves.toBe('session-1');
  expect(batchCommit).toHaveBeenCalledTimes(1);
});
