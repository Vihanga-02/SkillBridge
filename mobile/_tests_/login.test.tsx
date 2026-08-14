import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import LoginScreen from '../app/(auth)/login';
import { login } from '../src/services/authService';

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
  login: jest.fn(),
}));

const mockedLogin = jest.mocked(login);
const mockedRouter = jest.mocked(router);

async function completeValidForm(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.changeText(screen.getByPlaceholderText('you@campus.lk'), 'tester@example.com');
  await fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'secure12');
}

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation errors and does not attempt login with invalid details', async () => {
    const screen = await render(<LoginScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Email is required.')).toBeTruthy();
    expect(screen.getByText('Password is required.')).toBeTruthy();
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it('submits valid email and password credentials', async () => {
    mockedLogin.mockResolvedValue({} as Awaited<ReturnType<typeof login>>);
    const screen = await render(<LoginScreen />);
    await completeValidForm(screen);

    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalledWith('tester@example.com', 'secure12');
    });
  });

  it('shows a readable error when the credentials are rejected', async () => {
    mockedLogin.mockRejectedValue({ code: 'auth/invalid-credential' });
    const screen = await render(<LoginScreen />);
    await completeValidForm(screen);

    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();
  });

  it('opens password recovery from the forgot-password link', async () => {
    const screen = await render(<LoginScreen />);

    await fireEvent.press(screen.getByText('Forgot password?'));

    expect(mockedRouter.push).toHaveBeenCalledWith('/(auth)/forgot-password');
  });
});
