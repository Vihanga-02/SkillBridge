import { fireEvent, render } from '@testing-library/react-native';
import { EnrollmentCount } from '@/components/lesson/EnrollmentCount';
import { DeleteLessonButton } from '@/components/lesson/DeleteLessonButton';
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

it.each([[undefined, 'Enrollment count pending'], [0, '0 enrolled'], [1, '1 learner enrolled'], [5, '5 learners enrolled']])(
  'renders aggregate %s without loading learner records', async (count, text) => {
    const screen = await render(<EnrollmentCount count={count as number | undefined} />);
    expect(screen.getByText(text as string)).toBeTruthy();
  }
);
it('blocks an enrolled lesson and explains the disabled control', async () => {
  const onPress = jest.fn();
  const screen = await render(<DeleteLessonButton count={2} onPress={onPress} loading={false} />);
  const button = screen.getByRole('button', { name: 'Delete' });
  expect(button.props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
  expect(screen.getByText('Cannot delete: 2 learners are enrolled.')).toBeTruthy();
});
it('allows retrying a locked zero-enrollment lesson', async () => {
  const onPress = jest.fn();
  const screen = await render(<DeleteLessonButton count={0} deleting onPress={onPress} loading={false} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Retry deletion' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it.each([undefined, -1, NaN, 1.5])('never enables deletion for an invalid aggregate %s', async (count) => {
  const screen = await render(<DeleteLessonButton count={count} onPress={jest.fn()} loading={false} />);
  expect(screen.getByRole('button', { name: 'Delete' }).props.accessibilityState.disabled).toBe(true);
});
