import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SessionDetailScreen from '../app/session/[id]';
import { useAuth } from '@/hooks/useAuth';
import * as bookings from '@/services/bookingService';
import * as sessions from '@/services/sessionService';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: Object.assign(() => null, { glyphMap: {} }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'session-1' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/services/userService', () => ({ getUser: jest.fn(async () => null) }));
jest.mock('@/utils/share', () => ({ sessionShareText: jest.fn(), shareText: jest.fn() }));
jest.mock('@/services/sessionService', () => ({
  cancelSession: jest.fn(),
  getSession: jest.fn(),
  listUpcomingSessions: jest.fn(async () => []),
  subscribeToSession: jest.fn(() => () => {}),
}));
jest.mock('@/services/bookingService', () => {
  class BookingScheduleConflictError extends Error {}
  return {
    BookingScheduleConflictError,
    getBookingForSession: jest.fn(),
    requestBooking: jest.fn(),
    subscribeToSessionBookings: jest.fn(() => () => {}),
  };
});

const startAt = { toMillis: () => new Date(2030, 5, 15, 18, 30).getTime(), toDate: () => new Date(2030, 5, 15, 18, 30) };
const session = {
  id: 'session-1', teacherId: 'teacher-1', teacherName: 'Nimal', teacherAvatarUrl: '',
  teacherRatingAvg: 4.5, title: 'JavaScript basics', description: 'Learn JavaScript together.',
  skillTag: 'javascript', level: 'beginner', type: 'group', mode: 'online', locationText: '',
  startAt, durationMins: 60, capacity: 3, seatsTaken: 1, bookingCount: 1, status: 'open',
};
const learner = { uid: 'learner-1', name: 'Kamal', role: 'learner', avatarUrl: '' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date(2030, 0, 1, 12));
  (useAuth as jest.Mock).mockReturnValue({ profile: learner });
  (sessions.getSession as jest.Mock).mockResolvedValue(session);
  (bookings.getBookingForSession as jest.Mock).mockResolvedValue(null);
  (bookings.requestBooking as jest.Mock).mockResolvedValue('session-1_learner-1');
  (sessions.subscribeToSession as jest.Mock).mockImplementation((_id, next) => {
    next(session);
    return () => {};
  });
  (bookings.subscribeToSessionBookings as jest.Mock).mockImplementation(() => () => {});
  jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('lets a learner enter a note, confirm, and send a booking request', async () => {
  const screen = await render(<SessionDetailScreen />);
  const note = await screen.findByPlaceholderText('What would you like help with?');
  await fireEvent.changeText(note, 'Help me understand closures');
  await fireEvent.press(screen.getByRole('button', { name: 'Request booking' }));

  expect(Alert.alert).toHaveBeenCalledWith(
    'Request this session?',
    expect.any(String),
    expect.arrayContaining([expect.objectContaining({ text: 'Send request' })])
  );
  const confirmButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () => confirmButtons[1].onPress());

  await waitFor(() =>
    expect(bookings.requestBooking).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1' }),
      learner,
      'Help me understand closures'
    )
  );
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      'Request sent',
      'The teacher can now approve or decline your booking.',
      expect.any(Array)
    )
  );
});

it('shows an existing learner booking instead of another request button', async () => {
  (bookings.getBookingForSession as jest.Mock).mockResolvedValue({
    id: 'session-1_learner-1', learnerId: 'learner-1', status: 'pending',
  });

  const screen = await render(<SessionDetailScreen />);

  expect(await screen.findByText('Your booking')).toBeTruthy();
  expect(screen.getByText('Waiting for the teacher to respond.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Request booking' })).toBeNull();
});

it('disables learner booking when no seats remain', async () => {
  (sessions.getSession as jest.Mock).mockResolvedValue({ ...session, seatsTaken: 3, status: 'full' });
  (sessions.subscribeToSession as jest.Mock).mockImplementation((_id, next) => {
    next({ ...session, seatsTaken: 3, status: 'full' });
    return () => {};
  });

  const screen = await render(<SessionDetailScreen />);
  const button = await screen.findByRole('button', { name: 'Session full' });

  expect(button.props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(button);
  expect(bookings.requestBooking).not.toHaveBeenCalled();
});

it('shows a booking conflict returned for the learner', async () => {
  const conflict = new bookings.BookingScheduleConflictError('React class' as any);
  conflict.message = 'You already booked "React class" during this time.';
  (bookings.requestBooking as jest.Mock).mockRejectedValue(conflict);
  const screen = await render(<SessionDetailScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Request booking' }));
  const confirmButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () => confirmButtons[1].onPress());

  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      'Booking conflict',
      'You already booked "React class" during this time.'
    )
  );
  expect(await screen.findByText('You already booked "React class" during this time.')).toBeTruthy();
});
