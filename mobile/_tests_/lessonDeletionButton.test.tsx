jest.mock('@/components/ui/Button', () => ({ Button: 'Button' }));
import { DeleteLessonButton } from '@/components/lesson/DeleteLessonButton';
function buttonProps(count: number | undefined, retry = false, loading = false) {
  return DeleteLessonButton({ count, onPress: jest.fn(), loading, retry }).props.children[0].props;
}
it.each([0, 9])('allows a server-validated retry with displayed count %i', (count) => {
  expect(buttonProps(count, true)).toMatchObject({ label: 'Retry Delete', disabled: false });
});
it('uses loaded counts and the legacy zero fallback for the convenience guard', () => {
  expect(buttonProps(1).disabled).toBe(true);
  expect(buttonProps(0).disabled).toBe(false);
  expect(buttonProps(undefined).disabled).toBe(false);
});
it('clears the busy state so a failed attempt can be retried', () => {
  expect(buttonProps(0, true, true)).toMatchObject({ label: 'Deleting...', loading: true });
  expect(buttonProps(0, true)).toMatchObject({ label: 'Retry Delete', loading: false, disabled: false });
});
