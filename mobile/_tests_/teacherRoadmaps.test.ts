import { learnerRoadmapHierarchy, roadmapProgress, skillKeyFor, validateRoadmap, isEligibleRoadmapLesson, moveRoadmapLesson } from '@/utils/teacherRoadmaps';
import type { Lesson, LessonEnrollment, TeacherRoadmap } from '@/types';

const lesson = (id: string, patch = {}) => ({ id, teacherId: 'teacher', careerGoalId: 'software-engineer', published: true, ...patch }) as Lesson;
const roadmap = (ids: string[]) => ({ lessonIds: ids, teacherId: 'teacher', careerGoalId: 'software-engineer' }) as TeacherRoadmap;
const enrolled = (id: string, progress: number, completed = progress === 100) => ({ lessonId: id, progress, completed }) as LessonEnrollment;
const lessons = new Map(['a', 'b', 'c', 'unrelated'].map(id => [id, lesson(id)]));
const input = { title: ' JavaScript Path ', careerGoalId: 'software-engineer' as const, skill: ' JavaScript ', description: ' Learn JS ', lessonIds: ['a'] };

it('normalizes skill case and spacing while preserving a clean display name', () => {
  expect(['JavaScript', 'javascript', ' JAVASCRIPT '].map(skillKeyFor)).toEqual(['javascript', 'javascript', 'javascript']);
  expect(skillKeyFor('  Cloud   Computing ')).toBe('cloud computing');
  expect(validateRoadmap(input)).toMatchObject({ title: 'JavaScript Path', skill: 'JavaScript', skillKey: 'javascript', description: 'Learn JS' });
});
it.each([
  [{ title: '' }, 'title'], [{ skill: ' ' }, 'skill'], [{ careerGoalId: null }, 'career goal'],
  [{ lessonIds: [] }, 'at least one'], [{ lessonIds: ['a', 'a'] }, 'only once'],
  [{ description: 'a'.repeat(1001) }, '1000'],
])('validates required roadmap fields %#', (patch, message) => {
  expect(() => validateRoadmap({ ...input, ...patch })).toThrow(message as string);
});
it('filters teacher ownership, matching career goal and lesson availability', () => {
  const all = [lesson('a'), lesson('b', { teacherId: 'other' }), lesson('c', { careerGoalId: 'cloud-engineer' }), lesson('d', { deleting: true }), lesson('e', { published: false })];
  expect(all.filter(row => isEligibleRoadmapLesson(row, 'teacher', 'software-engineer')).map(row => row.id)).toEqual(['a']);
});
it('reorders without mutating IDs or wrapping at boundaries', () => {
  const ids = ['a', 'b', 'c'];
  expect(moveRoadmapLesson(ids, 0, -1)).toEqual(ids);
  expect(moveRoadmapLesson(ids, 1, -1)).toEqual(['b', 'a', 'c']);
  expect(moveRoadmapLesson(ids, 1, 1)).toEqual(['a', 'c', 'b']);
  expect(ids).toEqual(['a', 'b', 'c']);
});
it.each([[0, 0], [1, 33], [2, 67], [3, 100]])('counts %i completed lessons as %i percent', (count, percentage) => {
  const enrollments = new Map(['a', 'b', 'c'].map((id, index) => [id, enrolled(id, index < count ? 100 : 0)]));
  const summary = roadmapProgress(roadmap(['a', 'b', 'c']), lessons, enrollments);
  expect(summary).toMatchObject({ completedCount: count, total: 3, progress: percentage, completed: count === 3 });
});
it('uses completed flags, not average percentages, enrollment counts or unrelated lessons', () => {
  const enrollments = new Map([['a', enrolled('a', 100)], ['b', enrolled('b', 60)], ['unrelated', enrolled('unrelated', 100)]]);
  const summary = roadmapProgress(roadmap(['a', 'b', 'c']), lessons, enrollments);
  expect(summary).toMatchObject({ progress: 33, completedCount: 1 });
  expect(summary.items.map(row => row.status)).toEqual(['Completed', '60% In Progress', 'Not Enrolled']);
  expect(summary.next?.id).toBe('b');
  expect(roadmapProgress(roadmap(['a', 'b']), lessons, enrollments).progress).toBe(50);
  enrollments.set('b', enrolled('b', 100, false));
  expect(roadmapProgress(roadmap(['a', 'b']), lessons, enrollments).completedCount).toBe(1);
});
it('reuses one learner+lesson state across multiple skills and current memberships', () => {
  const enrollments = new Map([['a', enrolled('a', 100)], ['b', enrolled('b', 100)]]);
  expect(roadmapProgress(roadmap(['a', 'b']), lessons, enrollments).progress).toBe(100);
  expect(roadmapProgress(roadmap(['a', 'b', 'c']), lessons, enrollments).progress).toBe(67);
  expect(roadmapProgress(roadmap(['a']), lessons, enrollments).progress).toBe(100);
  expect(enrollments.size).toBe(2);
});
it('ignores missing references safely and never completes an empty roadmap', () => {
  expect(roadmapProgress(roadmap(['deleted']), lessons, new Map())).toMatchObject({ total: 0, progress: 0, completed: false, unavailableCount: 1 });
  expect(roadmapProgress(roadmap(['a', 'a', 'deleted']), lessons, new Map())).toMatchObject({ total: 1, progress: 0 });
});

const path = (id: string, ids: string[], skill = 'JavaScript', goal = 'software-engineer') =>
  ({ ...roadmap(ids), id, skill, careerGoalId: goal }) as TeacherRoadmap;
it('deduplicates shared lessons within a skill and across skills instead of averaging roadmap percentages', () => {
  const rows = [path('one', ['a', 'b']), path('two', ['b', 'c'], ' javascript '), path('git', ['a', 'b'], 'Git')];
  const enrollments = new Map([['a', enrolled('a', 100)], ['b', enrolled('b', 100)], ['c', enrolled('c', 60)]]);
  const [goal] = learnerRoadmapHierarchy(rows, lessons, enrollments);
  expect(goal.progress).toMatchObject({ total: 3, completedCount: 2, progress: 67 });
  expect(goal.skills).toHaveLength(2);
  expect(goal.skills.find(s => s.key === 'javascript')?.progress).toMatchObject({ total: 3, completedCount: 2, progress: 67 });
  expect(goal.skills.find(s => s.key === 'javascript')?.journeys).toHaveLength(2);
});
it('aggregates three JavaScript and two Git lessons to 80% when four unique lessons are completed', () => {
  const all = new Map(['a', 'b', 'c', 'd', 'e'].map(id => [id, lesson(id)]));
  const enrollments = new Map(['a', 'b', 'd', 'e'].map(id => [id, enrolled(id, 100)]));
  const [goal] = learnerRoadmapHierarchy([path('js', ['a', 'b', 'c']), path('git', ['d', 'e'], 'Git')], all, enrollments);
  expect(goal.progress).toMatchObject({ total: 5, completedCount: 4, progress: 80 });
  expect(goal.skills.map(skill => [skill.key, skill.progress.progress])).toEqual([['git', 100], ['javascript', 67]]);
});
it('keeps all three levels at 0 then 33 percent after the first canonical lesson completes', () => {
  const rows = [path('one', ['a', 'b', 'c'])];
  const enrollments = new Map([['a', enrolled('a', 0)]]);
  const before = learnerRoadmapHierarchy(rows, lessons, enrollments)[0];
  expect(before.progress.progress).toBe(0);
  enrollments.set('a', enrolled('a', 100));
  const after = learnerRoadmapHierarchy(rows, lessons, enrollments)[0];
  expect([after.progress.progress, after.skills[0].progress.progress, after.skills[0].journeys[0].summary.progress]).toEqual([33, 33, 33]);
  expect(after.skills[0].journeys[0].summary.next?.id).toBe('b');
});
it('excludes irrelevant roadmaps, missing references and unrelated lessons from hierarchy totals', () => {
  const enrollments = new Map([['a', enrolled('a', 100)], ['unrelated', enrolled('unrelated', 100)]]);
  const [goal] = learnerRoadmapHierarchy([path('visible', ['a', 'deleted']), path('hidden', ['b', 'c'])], lessons, enrollments);
  expect(goal.progress).toMatchObject({ total: 1, completedCount: 1, completed: true });
  expect(goal.skills[0].journeys).toHaveLength(1);
  expect(learnerRoadmapHierarchy([path('empty', [])], lessons, enrollments)).toEqual([]);
});
it('separates the same skill across career goals and recalculates current membership without storing progress', () => {
  const all = new Map(lessons); all.set('cloud', lesson('cloud', { careerGoalId: 'cloud-engineer' }));
  const enrollments = new Map([['a', enrolled('a', 100)], ['cloud', enrolled('cloud', 0)]]);
  const rows = [path('js', ['a']), path('cloud', ['cloud'], 'JavaScript', 'cloud-engineer')];
  const goals = learnerRoadmapHierarchy(rows, all, enrollments);
  expect(goals.map(goal => goal.progress.progress)).toEqual([0, 100]);
  rows[0].lessonIds.push('b');
  expect(learnerRoadmapHierarchy(rows, all, enrollments).find(goal => goal.id === 'software-engineer')?.progress.progress).toBe(50);
  expect(enrollments.size).toBe(2);
});
