import { act, render } from '@testing-library/react-native';
import MeScreen from '../app/(tabs)/me';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToEnrollmentsByUser, subscribeToLessonsByTeacher } from '@/services/lessonService';
import { nonNegativeCount } from '@/utils/counts';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/services/authService', () => ({ logout: jest.fn() }));
jest.mock('@/services/lessonService', () => ({ subscribeToEnrollmentsByUser: jest.fn(), subscribeToLessonsByTeacher: jest.fn() }));
jest.mock('@/components/user/SkillPortfolio', () => ({ SkillPortfolio: () => null }));

let emitCreated: (rows: any[]) => void;
let emitEnrolled: (rows: any[]) => void;
const stopCreated = jest.fn();
const stopEnrolled = jest.fn();
const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: String(i), lessonId: String(i) }));
const profile = (role: string) => ({ uid: 'current', role, name: 'Test', email: 'test@example.com',
  avatarUrl: '', bio: '', location: '', skillsOffered: [], skillsWanted: [], skillTagsWanted: [],
  careerGoals: [], credentialCount: 0, credits: 0,
  stats: { sessionsTaught: -2, sessionsAttended: -1, lessonsCompleted: -1 } });
beforeEach(() => {
  jest.clearAllMocks();
  (subscribeToLessonsByTeacher as jest.Mock).mockImplementation((_uid, next) => {
    emitCreated = next; next([]); return stopCreated;
  });
  (subscribeToEnrollmentsByUser as jest.Mock).mockImplementation((_uid, next) => {
    emitEnrolled = next; next([]); return stopEnrolled;
  });
});
it.each([
  ['learner', 0, 0, 'Lessons you enrolled in'],
  ['learner', 0, 3, 'Lessons you enrolled in'],
  ['teacher', 0, 0, 'Lessons you created'],
  ['teacher', 3, 0, 'Lessons you created'],
  ['both', 2, 4, 'Created and enrolled lessons'],
])('%s shows independent created=%s enrolled=%s counts', async (role, created, enrolled, hint) => {
  (useAuth as jest.Mock).mockReturnValue({ profile: profile(role as string) });
  const screen = await render(<MeScreen />);
  await act(() => {
    if (role !== 'learner') emitCreated(rows(created as number));
    if (role !== 'teacher') emitEnrolled(rows(enrolled as number));
  });
  expect(screen.getByLabelText('Taught: 0')).toBeTruthy();
  expect(screen.getByLabelText('Attended: 0')).toBeTruthy();
  expect(screen.getByText(hint)).toBeTruthy();
  expect(screen.queryByText('Lessons')).toBeNull();
  if (role !== 'learner') {
    expect(screen.getByLabelText(`Created Lessons: ${created}`)).toBeTruthy();
    expect(subscribeToLessonsByTeacher).toHaveBeenCalledWith('current', expect.any(Function), expect.any(Function));
  } else expect(screen.queryByText('Created Lessons')).toBeNull();
  if (role !== 'teacher') {
    expect(screen.getByLabelText(`Enrolled Lessons: ${enrolled}`)).toBeTruthy();
    expect(subscribeToEnrollmentsByUser).toHaveBeenCalledWith('current', expect.any(Function), expect.any(Function));
  } else expect(screen.queryByText('Enrolled Lessons')).toBeNull();
});
it('tracks creation, deletion, enrollment and removal independently, including repeated empty snapshots', async () => {
  (useAuth as jest.Mock).mockReturnValue({ profile: profile('both') });
  const screen = await render(<MeScreen />);
  await act(() => emitCreated(rows(2)));
  expect(screen.getByLabelText('Enrolled Lessons: 0')).toBeTruthy();
  await act(() => emitEnrolled(rows(4)));
  expect(screen.getByLabelText('Created Lessons: 2')).toBeTruthy();
  expect(screen.getByLabelText('Enrolled Lessons: 4')).toBeTruthy();
  await act(() => { emitEnrolled([]); emitCreated([]); });
  await act(() => { emitEnrolled([]); emitCreated([]); });
  expect(screen.getByLabelText('Created Lessons: 0')).toBeTruthy();
  expect(screen.getByLabelText('Enrolled Lessons: 0')).toBeTruthy();
  await screen.unmount();
  expect(stopCreated).toHaveBeenCalledTimes(1);
  expect(stopEnrolled).toHaveBeenCalledTimes(1);
});
it.each([-1, undefined, null, NaN, Infinity])('safely displays invalid count %s as zero', value => {
  expect(nonNegativeCount(value)).toBe(0);
});
