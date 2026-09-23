jest.mock('@/hooks/useLessonEnrollmentCount', () => ({ useLessonEnrollmentCount: jest.fn() }));
jest.mock('@/components/ui/Button', () => ({ Button: 'Button' }));
import { DeleteLessonButton } from '@/components/lesson/DeleteLessonButton';
import { useLessonEnrollmentCount } from '@/hooks/useLessonEnrollmentCount';

function buttonProps(retry: boolean, loading = false) {
  const view = DeleteLessonButton({ lessonId: 'lesson', onPress: jest.fn(), loading, retry });
  return view.props.children[0].props;
}

it.each([
  { count: 0, error: false },
  { count: null, error: true },
  { count: 9, error: false },
])('offers server-validated retry after a failure or stale marker: %j', (state) => {
  (useLessonEnrollmentCount as jest.Mock).mockReturnValue(state);
  expect(buttonProps(true)).toMatchObject({ label: 'Retry Delete', disabled: false, loading: false });
});

it('keeps ordinary deletion disabled for enrolled lessons and unavailable counts', () => {
  for (const state of [{ count: 1, error: false }, { count: null, error: true }]) {
    (useLessonEnrollmentCount as jest.Mock).mockReturnValue(state);
    expect(buttonProps(false).disabled).toBe(true);
  }
});

it('uses the shared Button busy state only while the current request is running', () => {
  (useLessonEnrollmentCount as jest.Mock).mockReturnValue({ count: 0, error: false });
  expect(buttonProps(true, true)).toMatchObject({ label: 'Deleting...', loading: true });
  expect(buttonProps(true, false)).toMatchObject({ label: 'Retry Delete', loading: false, disabled: false });
});
