import { fireEvent, render, waitFor } from '@testing-library/react-native';

import CreateSessionScreen from '../app/session/create';
import { useAuth } from '@/hooks/useAuth';
import { createSession } from '@/services/sessionService';
import { router } from 'expo-router';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: Object.assign(() => null, { glyphMap: {} }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/services/sessionService', () => {
  class SessionScheduleConflictError extends Error {}
  return {
    SessionScheduleConflictError,
    createSession: jest.fn(),
    getEditableSession: jest.fn(),
    updateSession: jest.fn(),
  };
});
jest.mock('@/components/ui/DateField', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    DateField: ({ onChange }: { onChange: (value: string) => void }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: 'Choose test date',
          onPress: () => onChange('2030-06-15'),
        },
        React.createElement(Text, null, 'Choose test date')
      ),
  };
});

const teacher = {
  uid: 'teacher-1',
  name: 'Nimal',
  role: 'teacher',
  skillTagsOffered: ['javascript'],
  skillsOffered: [{ skill: 'javascript', label: 'JavaScript', level: 'beginner' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date(2030, 0, 1, 12));
  (useAuth as jest.Mock).mockReturnValue({ profile: teacher });
  (createSession as jest.Mock).mockResolvedValue('created-session');
});

afterEach(() => jest.useRealTimers());

it('submits the completed create-session form and opens the new session', async () => {
  const screen = await render(<CreateSessionScreen />);

  await fireEvent.changeText(
    screen.getByPlaceholderText('React Native Beginner Workshop'),
    'JavaScript workshop'
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText('What will learners cover?'),
    'Learn JavaScript fundamentals with practical examples.'
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Choose test date' }));
  await fireEvent.changeText(screen.getByPlaceholderText('10'), '6');
  await fireEvent.press(screen.getByRole('button', { name: 'Publish session' }));

  await waitFor(() =>
    expect(createSession).toHaveBeenCalledWith(
      teacher,
      expect.objectContaining({
        title: 'JavaScript workshop',
        description: 'Learn JavaScript fundamentals with practical examples.',
        skillTag: 'javascript',
        level: 'beginner',
        type: 'group',
        mode: 'online',
        date: '2030-06-15',
        time: '18:00',
        durationMins: 60,
        capacity: 6,
      })
    )
  );
  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/session/[id]',
    params: { id: 'created-session' },
  });
});

it('shows the service validation error and stays on the form', async () => {
  (createSession as jest.Mock).mockRejectedValue(new Error('Sessions must start in the future.'));
  const screen = await render(<CreateSessionScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Publish session' }));

  expect(await screen.findByText('Sessions must start in the future.')).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
});

it('does not show the creation form to a learner-only profile', async () => {
  (useAuth as jest.Mock).mockReturnValue({ profile: { ...teacher, role: 'learner' } });
  const screen = await render(<CreateSessionScreen />);

  expect(
    screen.getByText(
      'Switch your role to Teach or Teach & learn in Edit profile before offering sessions.'
    )
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Publish session' })).toBeNull();
});

it('guides a teacher without offered skills to edit their profile', async () => {
  (useAuth as jest.Mock).mockReturnValue({
    profile: { ...teacher, skillTagsOffered: [], skillsOffered: [] },
  });
  const screen = await render(<CreateSessionScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Edit profile' }));
  expect(router.push).toHaveBeenCalledWith('/profile/edit');
  expect(createSession).not.toHaveBeenCalled();
});
