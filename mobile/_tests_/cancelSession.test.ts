import { getDocs } from 'firebase/firestore';

import { SESSION_CANCELLED_REASON, cancelSession } from '@/services/sessionService';

jest.mock('@/firebase/config', () => ({ db: {} }));

type Data = Record<string, any>;
type Ref = { path: string; id: string };
let mockRecords: Map<string, Data>;

jest.mock('firebase/firestore', () => {
  const snapshotOf = (ref: Ref) => {
    const value = mockRecords.get(ref.path);
    return { id: ref.id, ref, exists: () => value !== undefined, data: () => value };
  };
  return {
    Timestamp: { fromDate: jest.fn() },
    collection: jest.fn((_db, path) => ({ path })),
    doc: jest.fn((_db, col, id) => ({ path: `${col}/${id}`, id })),
    where: jest.fn((field, op, value) => ({ field, op, value })),
    query: jest.fn((col, ...filters) => ({ col, filters })),
    limit: jest.fn(), orderBy: jest.fn(), getDoc: jest.fn(), writeBatch: jest.fn(),
    serverTimestamp: jest.fn(() => 'ts'),
    getDocs: jest.fn(async ({ col, filters }) => ({
      docs: [...mockRecords]
        .filter(([path, value]) => path.startsWith(`${col.path}/`) &&
          filters.every((filter: Data) => value[filter.field] === filter.value))
        .map(([path]) => snapshotOf({ path, id: path.split('/')[1] })),
    })),
    runTransaction: jest.fn(async (_db, callback) => {
      const pending: (() => void)[] = [];
      const result = await callback({
        get: async (ref: Ref) => snapshotOf(ref),
        update: (ref: Ref, patch: Data) =>
          pending.push(() => mockRecords.set(ref.path, { ...mockRecords.get(ref.path), ...patch })),
      });
      pending.forEach((apply) => apply());
      return result;
    }),
  };
});

const HOUR = 60 * 60 * 1000;
const at = (ms: number) => ({ toMillis: () => ms });
const booking = (learner: string, status: string) =>
  mockRecords.set(`bookings/s1_${learner}`, { sessionId: 's1', learnerId: learner, status, cancelReason: '' });
const statusOf = (learner: string) => mockRecords.get(`bookings/s1_${learner}`)?.status;

beforeEach(() => {
  jest.clearAllMocks();
  mockRecords = new Map();
  mockRecords.set('sessions/s1', {
    teacherId: 'teacher', status: 'open', capacity: 5, seatsTaken: 2, startAt: at(Date.now() + 24 * HOUR),
  });
});

it('cancels every pending and confirmed booking, frees the seats and keeps finished ones', async () => {
  booking('pending', 'pending');
  booking('confirmed', 'confirmed');
  booking('declined', 'declined');
  booking('left', 'cancelled');

  await expect(cancelSession('s1', 'teacher')).resolves.toBe(2);

  expect(mockRecords.get('sessions/s1')).toMatchObject({ status: 'cancelled', seatsTaken: 0 });
  expect(statusOf('pending')).toBe('cancelled');
  expect(statusOf('confirmed')).toBe('cancelled');
  expect(mockRecords.get('bookings/s1_confirmed')?.cancelReason).toBe(SESSION_CANCELLED_REASON);
  expect(statusOf('declined')).toBe('declined');
  expect(mockRecords.get('bookings/s1_declined')?.cancelReason).toBe('');
});

it('stores the teacher’s own reason, trimmed', async () => {
  mockRecords.get('sessions/s1')!.seatsTaken = 1;
  booking('a', 'confirmed');
  await cancelSession('s1', 'teacher', '  Room unavailable  ');
  expect(mockRecords.get('bookings/s1_a')?.cancelReason).toBe('Room unavailable');
});

it('cancels a session with no bookings', async () => {
  mockRecords.get('sessions/s1')!.seatsTaken = 0;
  await expect(cancelSession('s1', 'teacher')).resolves.toBe(0);
  expect(mockRecords.get('sessions/s1')?.status).toBe('cancelled');
});

it.each([
  ['someone other than the host', { }, 'other', 'Only the teacher'],
  ['an already cancelled session', { status: 'cancelled' }, 'teacher', 'already cancelled'],
  ['a completed session', { status: 'completed' }, 'teacher', 'completed session'],
  ['a session that has started', { startAt: at(Date.now() - HOUR) }, 'teacher', 'already started'],
])('refuses %s and changes nothing', async (_label, patch, uid, message) => {
  Object.assign(mockRecords.get('sessions/s1')!, patch);
  booking('a', 'confirmed');
  const before = JSON.stringify([...mockRecords]);
  await expect(cancelSession('s1', uid)).rejects.toThrow(message);
  expect(JSON.stringify([...mockRecords])).toBe(before);
});

it('looks again when a booking lands after the first lookup, so no learner is missed', async () => {
  mockRecords.get('sessions/s1')!.seatsTaken = 2;
  booking('early', 'pending');
  const realGetDocs = (getDocs as jest.Mock).getMockImplementation()!;
  // The second learner's booking arrives just after the first lookup ran.
  (getDocs as jest.Mock).mockImplementationOnce(async (q) => {
    const result = await realGetDocs(q);
    booking('late', 'pending');
    return result;
  });

  await expect(cancelSession('s1', 'teacher')).resolves.toBe(2);
  expect(getDocs).toHaveBeenCalledTimes(2);
  expect(statusOf('early')).toBe('cancelled');
  expect(statusOf('late')).toBe('cancelled');
});

it('still cancels when an old seat count is higher than the bookings that exist', async () => {
  mockRecords.get('sessions/s1')!.seatsTaken = 4;
  booking('a', 'confirmed');
  await expect(cancelSession('s1', 'teacher')).resolves.toBe(1);
  expect(mockRecords.get('sessions/s1')).toMatchObject({ status: 'cancelled', seatsTaken: 0 });
});
