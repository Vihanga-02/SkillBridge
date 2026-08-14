import { fireEvent, render, waitFor } from '@testing-library/react-native';

import RegisterScreen from '../app/(auth)/register';
import { register } from '../src/services/authService';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(Text, null, children);
  },
  router: { back: jest.fn(), push: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

jest.mock('../src/services/authService', () => ({
  register: jest.fn(),
}));

const mockedRegister = jest.mocked(register);

async function completeValidForm(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.changeText(screen.getByPlaceholderText('Chamath Perera'), 'Test User');
  await fireEvent.changeText(screen.getByPlaceholderText('you@campus.lk'), 'tester@example.com');
  await fireEvent.changeText(screen.getByPlaceholderText('Create a password'), 'secure12');
  await fireEvent.changeText(screen.getByPlaceholderText('Re-enter your password'), 'secure12');
}

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation errors and does not submit an incomplete form', async () => {
    const screen = await render(<RegisterScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Name is required.')).toBeTruthy();
    expect(screen.getByText('Email is required.')).toBeTruthy();
    expect(screen.getByText('Password is required.')).toBeTruthy();
    expect(screen.getByText('Please re-enter your password.')).toBeTruthy();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('requires acceptance of the terms before creating an account', async () => {
    const screen = await render(<RegisterScreen />);
    await completeValidForm(screen);

    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Please accept the terms to create an account.')).toBeTruthy();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('submits valid, accepted registration details', async () => {
    mockedRegister.mockResolvedValue({} as Awaited<ReturnType<typeof register>>);
    const screen = await render(<RegisterScreen />);
    await completeValidForm(screen);

    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Accept the community guidelines and privacy terms',
      })
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(mockedRegister).toHaveBeenCalledWith('tester@example.com', 'secure12', 'Test User');
    });
  });

  it('shows a readable message when registration fails', async () => {
    mockedRegister.mockRejectedValue({ code: 'auth/email-already-in-use' });
    const screen = await render(<RegisterScreen />);
    await completeValidForm(screen);

    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('That email is already registered. Try logging in.')
    ).toBeTruthy();
  });
});
