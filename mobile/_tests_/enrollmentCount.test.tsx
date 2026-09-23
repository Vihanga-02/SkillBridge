jest.mock('firebase/firestore', () => ({ onSnapshot: jest.fn(), getDocs: jest.fn(), getDoc: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
import { onSnapshot, getDocs, getDoc } from 'firebase/firestore';
import { EnrollmentCount } from '@/components/lesson/EnrollmentCount';

it.each([0, 1, 25])('renders %i enrolled from props', (count) => {
  expect(EnrollmentCount({ count }).props.children[1].props.children).toBe(`${count} enrolled`);
});
it('renders the legacy fallback and updates when the parent supplies a new count', () => {
  expect(EnrollmentCount({}).props.children[1].props.children).toBe('0 enrolled');
  expect(EnrollmentCount({ count: 5 }).props.children[1].props.children).toBe('5 enrolled');
});
it('100 count components perform zero Firestore reads or subscriptions', () => {
  for (let count = 0; count < 100; count++) EnrollmentCount({ count });
  expect(onSnapshot).not.toHaveBeenCalled();
  expect(getDocs).not.toHaveBeenCalled();
  expect(getDoc).not.toHaveBeenCalled();
});
