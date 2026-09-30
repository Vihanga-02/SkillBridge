import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Form from '../app/profile/roadmaps/form';
import List from '../app/profile/roadmaps/index';
import Detail from '../app/profile/roadmaps/[id]';
import MyLessons from '../app/profile/lessons/index';
import { useAuth } from '@/hooks/useAuth';
import { listLessonsByTeacher, listEnrollmentsByUser, listLessonsByIds } from '@/services/lessonService';
import { getTeacherRoadmap, loadRoadmaps, loadRoadmapDetail, saveTeacherRoadmap } from '@/services/teacherRoadmapService';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => { const React = jest.requireActual('react'); React.useEffect(callback, [callback]); },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/services/lessonService', () => ({ listLessonsByTeacher: jest.fn(), listEnrollmentsByUser: jest.fn(), listLessonsByIds: jest.fn() }));
jest.mock('@/services/teacherRoadmapService', () => ({ getTeacherRoadmap: jest.fn(), loadRoadmaps: jest.fn(), loadRoadmapDetail: jest.fn(), saveTeacherRoadmap: jest.fn() }));
const teacher = { uid: 'teacher', name: 'Teacher', role: 'teacher' };
const lessons = [
  { id: 'a', teacherId: 'teacher', careerGoalId: 'software-engineer', lessonName: 'JS Basics', published: true, contents: [] },
  { id: 'b', teacherId: 'teacher', careerGoalId: 'software-engineer', lessonName: 'Advanced JS', published: true, contents: [] },
  { id: 'cloud', teacherId: 'teacher', careerGoalId: 'cloud-engineer', lessonName: 'AWS Basics', published: true, contents: [] },
  { id: 'foreign', teacherId: 'other', careerGoalId: 'software-engineer', lessonName: 'Foreign JS', published: true, contents: [] },
];
const roadmap = { id: 'path', teacherId: 'teacher', teacherName: 'Teacher', title: 'JS Path', skill: 'JavaScript', skillKey: 'javascript', careerGoalId: 'software-engineer', description: '', lessonIds: ['a', 'b'], revision: 0 };
beforeEach(() => {
  jest.clearAllMocks(); mockParams = {};
  (useAuth as jest.Mock).mockReturnValue({ profile: teacher });
  (listLessonsByTeacher as jest.Mock).mockResolvedValue(lessons);
  (listEnrollmentsByUser as jest.Mock).mockResolvedValue([]);
  (listLessonsByIds as jest.Mock).mockResolvedValue([]);
  (getTeacherRoadmap as jest.Mock).mockResolvedValue(roadmap);
  (saveTeacherRoadmap as jest.Mock).mockResolvedValue('path');
  const data = { roadmaps: [roadmap], lessons, enrollments: [{ lessonId: 'a', completed: true, progress: 100 }, { lessonId: 'b', completed: false, progress: 60 }] };
  (loadRoadmaps as jest.Mock).mockResolvedValue(data);
  (loadRoadmapDetail as jest.Mock).mockResolvedValue(data);
});
it.each(['teacher', 'both'])('%s creates from matching owned lessons and persists the chosen order', async role => {
  (useAuth as jest.Mock).mockReturnValue({ profile: { ...teacher, role } });
  const screen = await render(<Form />);
  await screen.findByPlaceholderText('JavaScript Learning Roadmap');
  await fireEvent.changeText(screen.getByPlaceholderText('JavaScript Learning Roadmap'), 'JS Path');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Software Engineer' }));
  await fireEvent.changeText(screen.getByPlaceholderText('JavaScript'), 'JavaScript');
  expect(screen.queryByRole('button', { name: 'Add: AWS Basics' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Add: Foreign JS' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Add: JS Basics' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add: Advanced JS' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move Lesson 2 Up' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save Roadmap' }));
  await waitFor(() => expect(saveTeacherRoadmap).toHaveBeenCalledWith(expect.objectContaining({ role }), expect.objectContaining({ lessonIds: ['b', 'a'], careerGoalId: 'software-engineer' }), undefined, 0));
});
it('loads edit fields and removes invalid selected lessons when changing career goal', async () => {
  mockParams = { roadmapId: 'path' };
  const screen = await render(<Form />);
  expect((await screen.findByPlaceholderText('JavaScript Learning Roadmap')).props.value).toBe('JS Path');
  expect(screen.getByText('1. JS Basics')).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Cloud Engineer' }));
  expect(screen.getByText('Lessons that do not match the new career goal were removed.')).toBeTruthy();
  expect(screen.queryByText('1. JS Basics')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Add: AWS Basics' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save Roadmap' }));
  expect(saveTeacherRoadmap).toHaveBeenCalledWith(teacher, expect.objectContaining({ lessonIds: ['cloud'] }), 'path', 0);
});
it('hides creation from learner-only users and rejects non-owner editing', async () => {
  (useAuth as jest.Mock).mockReturnValue({ profile: { ...teacher, role: 'learner' } });
  const screen = await render(<Form />);
  expect(screen.queryByRole('button', { name: 'Save Roadmap' })).toBeNull();
  await screen.unmount();
  (useAuth as jest.Mock).mockReturnValue({ profile: teacher });
  mockParams = { roadmapId: 'path' };
  (getTeacherRoadmap as jest.Mock).mockResolvedValue({ ...roadmap, teacherId: 'other' });
  const other = await render(<Form />);
  expect(await other.findByText('Only the roadmap creator can edit it.')).toBeTruthy();
  expect(other.queryByRole('button', { name: 'Save Roadmap' })).toBeNull();
});
it.each(['learner', 'both'])('%s sees completion-based progress and no teaching controls in learner mode', async role => {
  (useAuth as jest.Mock).mockReturnValue({ profile: { ...teacher, role } });
  mockParams = { mode: 'learn' };
  const screen = await render(<List />);
  expect((await screen.findAllByText('50%')).length).toBe(3);
  expect(screen.getAllByText('1 of 2 lessons completed')).toHaveLength(3);
  expect(screen.getByText('Career Goal: Software Engineer')).toBeTruthy();
  expect(screen.getByText('Skill: JavaScript')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Edit Roadmap' })).toBeNull();
  expect(screen.queryByRole('button', { name: '+ Create Roadmap' })).toBeNull();
});
it('management mode has edit controls and no learner progress', async () => {
  mockParams = { mode: 'teach' };
  const screen = await render(<List />);
  expect(await screen.findByRole('button', { name: 'Edit Roadmap' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '+ Create Roadmap' })).toBeTruthy();
  expect(screen.queryByText('50%')).toBeNull();
});
it('shows next lesson and distinguishes partial and not-enrolled lessons without enrolling', async () => {
  mockParams = { id: 'path', mode: 'learn' };
  (useAuth as jest.Mock).mockReturnValue({ profile: { ...teacher, role: 'both' } });
  (loadRoadmapDetail as jest.Mock).mockResolvedValue({ roadmaps: [roadmap], lessons,
    enrollments: [{ lessonId: 'a', completed: false, progress: 60 }] });
  const screen = await render(<Detail />);
  expect(await screen.findByText('Next: JS Basics')).toBeTruthy();
  expect(screen.getByText('60% In Progress')).toBeTruthy();
  expect(screen.getByText('Not Enrolled')).toBeTruthy();
  expect(screen.getByText('0 of 2 lessons completed')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'View Lesson' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/lesson/details/[id]', params: { id: 'b' } });
});
it('shows a completed roadmap and gracefully renders missing references', async () => {
  mockParams = { id: 'path', mode: 'learn' };
  (loadRoadmapDetail as jest.Mock).mockResolvedValue({ roadmaps: [{ ...roadmap, lessonIds: ['a', 'missing'] }], lessons,
    enrollments: [{ lessonId: 'a', completed: true, progress: 100 }] });
  const screen = await render(<Detail />);
  expect(await screen.findByText('✓ Roadmap Completed')).toBeTruthy();
  expect(screen.getByText('100%')).toBeTruthy();
  expect(screen.getByText('2. Unavailable lesson')).toBeTruthy();
});
it('Both retains Created by Me and Enrolled Lessons alongside both roadmap entry points', async () => {
  (useAuth as jest.Mock).mockReturnValue({ profile: { ...teacher, role: 'both' } });
  const screen = await render(<MyLessons />);
  expect(await screen.findByRole('tab', { name: 'Created by Me' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Enrolled Lessons' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Manage Learning Roadmaps' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'My Learning Roadmaps' })).toBeTruthy();
});

it('renders completed, current and upcoming milestones in teacher order with the correct actions', async () => {
  mockParams = { id: 'path', mode: 'learn' };
  const third = { ...lessons[0], id: 'c', lessonName: 'JS Projects' };
  (loadRoadmapDetail as jest.Mock).mockResolvedValue({ roadmaps: [{ ...roadmap, lessonIds: ['a', 'b', 'c'] }], lessons: [...lessons, third],
    enrollments: [{ lessonId: 'a', completed: true, progress: 100 }, { lessonId: 'b', completed: false, progress: 60 }] });
  const screen = await render(<Detail />);
  expect(await screen.findByLabelText('Step 1: Completed')).toBeTruthy();
  expect(screen.getByLabelText('Step 2: Current / Next')).toBeTruthy();
  expect(screen.getByLabelText('Step 3: Upcoming')).toBeTruthy();
  expect(screen.getByRole('progressbar', { name: 'Roadmap Progress' }).props.accessibilityValue.now).toBe(33);
  await fireEvent.press(screen.getByRole('button', { name: 'Review Lesson' }));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/lesson/[id]', params: { id: 'a' } });
  await fireEvent.press(screen.getAllByRole('button', { name: 'Continue Learning' })[0]);
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/lesson/[id]', params: { id: 'b' } });
  await fireEvent.press(screen.getByRole('button', { name: 'View Lesson' }));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/lesson/details/[id]', params: { id: 'c' } });
});
it('shows the learner empty state without teacher creation controls', async () => {
  mockParams = { mode: 'learn' };
  (useAuth as jest.Mock).mockReturnValue({ profile: { ...teacher, role: 'learner' } });
  (loadRoadmaps as jest.Mock).mockResolvedValue({ roadmaps: [], lessons: [], enrollments: [] });
  const screen = await render(<List />);
  expect(await screen.findByText('No learning roadmaps yet')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '+ Create Roadmap' })).toBeNull();
});
it('groups two normalized JavaScript paths under one skill with deduplicated progress bars', async () => {
  mockParams = { mode: 'learn' };
  (useAuth as jest.Mock).mockReturnValue({ profile: { ...teacher, role: 'both' } });
  (loadRoadmaps as jest.Mock).mockResolvedValue({ roadmaps: [roadmap, { ...roadmap, id: 'second', title: 'JS Projects Path', skill: ' javascript ', lessonIds: ['b'] }], lessons,
    enrollments: [{ lessonId: 'a', completed: true, progress: 100 }, { lessonId: 'b', completed: false, progress: 60 }] });
  const screen = await render(<List />);
  expect(await screen.findByText('JS Projects Path')).toBeTruthy();
  expect(screen.getAllByRole('progressbar', { name: 'Skill Progress' })).toHaveLength(1);
  expect(screen.getByRole('progressbar', { name: 'Career Goal Progress' }).props.accessibilityValue.now).toBe(50);
  expect(screen.getByRole('progressbar', { name: 'Skill Progress' }).props.accessibilityValue.now).toBe(50);
  await fireEvent.press(screen.getByRole('button', { name: 'JavaScript roadmaps' }));
  expect(screen.queryByText('JS Projects Path')).toBeNull();
  expect(screen.getByRole('progressbar', { name: 'Skill Progress' }).props.accessibilityValue.now).toBe(50);
  await fireEvent.press(screen.getByRole('button', { name: 'JavaScript roadmaps' }));
  expect(screen.getByText('JS Projects Path')).toBeTruthy();
});
