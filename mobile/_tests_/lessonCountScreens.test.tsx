import { fireEvent, render, waitFor } from '@testing-library/react-native';
import FeedScreen from '../app/(tabs)/feed';
import DetailsScreen from '../app/lesson/details/[id]';
import LessonScreen from '../app/lesson/[id]';
import MyLessonsScreen from '../app/profile/lessons';
import ProfileScreen from '../app/user/[id]';
import { useAuth } from '@/hooks/useAuth';
import * as lessons from '@/services/lessonService';
import { subscribeToUser } from '@/services/userService';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'course' }),
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, [callback]);
  },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/services/lessonService', () => ({
  getLesson: jest.fn(), listLessons: jest.fn(), listLessonsByTeacher: jest.fn(), listLessonsByIds: jest.fn(),
  listEnrollmentsByUser: jest.fn(), listEnrollmentIds: jest.fn(), getEnrollment: jest.fn(),
  enrollInLesson: jest.fn(), deleteLesson: jest.fn(), subscribeToLessonsByTeacher: jest.fn(),
}));
jest.mock('@/services/userService', () => ({ subscribeToUser: jest.fn() }));
jest.mock('@/services/chatService', () => ({ ensureDirectChat: jest.fn() }));
jest.mock('@/services/credentialService', () => ({ listCredentials: async () => [], listPublicCredentials: async () => [] }));
jest.mock('@/services/reviewService', () => ({ listReviewsForUser: async () => [], subscribeToUserReviews: () => () => {} }));
jest.mock('@/components/community/UserReviews', () => ({ UserReviews: () => null }));
jest.mock('@/components/user/ProfileHeader', () => ({ ProfileHeader: () => null }));
jest.mock('@/components/user/SkillPortfolio', () => ({ SkillPortfolio: () => null }));
jest.mock('@/components/user/CredentialsBySkill', () => ({ CredentialsBySkill: () => null }));

const owner = { uid: 'owner', name: 'Owner', role: 'both', skillsOffered: [], skillsWanted: [], careerGoals: [], badges: [] };
let course: any;
const enrollment = { id: 'owner_course', userId: 'owner', lessonId: 'course', teacherId: 'owner',
  lessonName: 'Old cached title', contentCount: 1, progress: 40, completedContentIds: [], completed: false };
beforeEach(() => {
  jest.clearAllMocks();
  course = { id: 'course', teacherId: 'owner', lessonName: 'Both Test Course', teacherName: 'Owner',
    careerGoalName: 'Software Engineer', contents: [], level: 'beginner', published: true,
    enrollmentCount: 3, enrollmentCountVersion: 1 };
  (useAuth as jest.Mock).mockReturnValue({ profile: owner });
  (lessons.getLesson as jest.Mock).mockImplementation(async () => ({ ...course }));
  for (const fn of [lessons.listLessons, lessons.listLessonsByTeacher, lessons.listLessonsByIds]) {
    (fn as jest.Mock).mockImplementation(async () => [{ ...course }]);
  }
  (lessons.listEnrollmentIds as jest.Mock).mockResolvedValue(new Set(['course']));
  (lessons.listEnrollmentsByUser as jest.Mock).mockResolvedValue([enrollment]);
  (lessons.getEnrollment as jest.Mock).mockResolvedValue(enrollment);
  (lessons.subscribeToLessonsByTeacher as jest.Mock).mockImplementation((_id, next) => { next([{ ...course }]); return () => {}; });
  (subscribeToUser as jest.Mock).mockImplementation((_id, next) => { next(owner); return () => {}; });
});
it.each([
  ['Learn', FeedScreen], ['Course Details', DetailsScreen], ['Lesson materials', LessonScreen],
  ['Created by Me', MyLessonsScreen], ['Both profile', ProfileScreen],
] as const)('%s displays the same canonical total of three', async (_name, Screen) => {
  const screen = await render(<Screen />);
  expect(await screen.findByText('3 learners enrolled')).toBeTruthy();
  expect(screen.queryByText('0 enrolled')).toBeNull();
});
it('Enrolled Lessons includes the BOTH creator and separates total from personal progress', async () => {
  const screen = await render(<MyLessonsScreen />);
  await screen.findByText('3 learners enrolled');
  expect(screen.getByRole('button', { name: 'Delete' }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Edit' }).props.accessibilityState.disabled).toBe(false);
  await fireEvent.press(screen.getByRole('tab', { name: 'Enrolled Lessons' }));
  expect(await screen.findByText('3 learners enrolled')).toBeTruthy();
  expect(screen.getByText('40%')).toBeTruthy();
  expect(screen.getByText('Both Test Course')).toBeTruthy();
});
it('teacher public profile displays the same count', async () => {
  (subscribeToUser as jest.Mock).mockImplementation((_id, next) => { next({ ...owner, role: 'teacher' }); return () => {}; });
  const screen = await render(<ProfileScreen />);
  expect(await screen.findByText('3 learners enrolled')).toBeTruthy();
});
it.each([['Learn', FeedScreen], ['Course Details', DetailsScreen]] as const)(
  'BOTH creator can self-enroll from %s and sees the persisted response', async (name, Screen) => {
    course.enrollmentCount = 0;
    (lessons.getEnrollment as jest.Mock).mockResolvedValue(null);
    (lessons.listEnrollmentIds as jest.Mock).mockResolvedValue(new Set());
    (lessons.enrollInLesson as jest.Mock).mockImplementation(async () => {
      course.enrollmentCount = 1;
      (lessons.getEnrollment as jest.Mock).mockResolvedValue(enrollment);
    });
    const screen = await render(<Screen />);
    await screen.findByText('0 enrolled');
    await fireEvent.press(screen.getByRole('button', { name: name === 'Learn' ? 'Enroll' : 'Enroll as learner' }));
    expect(await screen.findByText('1 learner enrolled')).toBeTruthy();
    expect(lessons.enrollInLesson).toHaveBeenCalledWith(owner, expect.objectContaining({ id: 'course' }));
  }
);
it('a lesson missing enrollmentCount stays unavailable until migration', async () => {
  delete course.enrollmentCount; delete course.enrollmentCountVersion;
  const screen = await render(<MyLessonsScreen />);
  expect(await screen.findByText('Enrollment count unavailable')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Delete' }).props.accessibilityState.disabled).toBe(true);
});

it('does not trust a canonical count without the migration version marker', async () => {
  delete course.enrollmentCountVersion;
  // Screen tests mock the service layer, so mirror normalizeLesson dropping an
  // unversioned count. The service behavior itself is covered separately.
  delete course.enrollmentCount;
  const screen = await render(<MyLessonsScreen />);
  expect(await screen.findByText('Enrollment count unavailable')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Delete' }).props.accessibilityState.disabled).toBe(true);
});
