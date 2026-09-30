import { careerGoalByTag, type CareerGoalTag } from '@/constants/careerGoals';
import type { Lesson, LessonEnrollment, TeacherRoadmap, User } from '@/types';

export const canManageRoadmaps = (role: User['role']) => role === 'teacher' || role === 'both';
export const canLearnRoadmaps = (role: User['role']) => role === 'learner' || role === 'both';
export const cleanSkill = (skill: string) => skill.normalize('NFKC').trim().replace(/\s+/g, ' ');
export const skillKeyFor = (skill: string) => cleanSkill(skill).toLowerCase();

export type RoadmapInput = {
  title: string;
  careerGoalId: CareerGoalTag | null;
  skill: string;
  description: string;
  lessonIds: string[];
};

export function validateRoadmap(input: RoadmapInput) {
  const title = input.title.trim();
  if (title.length < 3 || title.length > 120) throw new Error('Roadmap title must be between 3 and 120 characters.');
  if (!input.careerGoalId || !careerGoalByTag(input.careerGoalId)) throw new Error('Choose a career goal.');
  const skill = cleanSkill(input.skill);
  if (!skill || skill.length > 80) throw new Error('Enter a skill between 1 and 80 characters.');
  if (input.description.trim().length > 1000) throw new Error('Description must be 1000 characters or fewer.');
  if (!input.lessonIds.length) throw new Error('Add at least one lesson.');
  if (input.lessonIds.some(id => !id || id.includes('/')) || new Set(input.lessonIds).size !== input.lessonIds.length) {
    throw new Error('Select each valid lesson only once.');
  }
  return { title, careerGoalId: input.careerGoalId, skill, skillKey: skillKeyFor(skill),
    description: input.description.trim(), lessonIds: [...input.lessonIds] };
}

export function isEligibleRoadmapLesson(lesson: Lesson, teacherId: string, goal: string | null) {
  return lesson.teacherId === teacherId && lesson.careerGoalId === goal && lesson.published && !lesson.deleting;
}

export function moveRoadmapLesson(ids: string[], index: number, direction: -1 | 1) {
  const next = [...ids];
  const target = index + direction;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function completionSummary(items: { id: string; completed: boolean }[]) {
  const unique = new Map(items.map(item => [item.id, item.completed]));
  const total = unique.size;
  const completedCount = [...unique.values()].filter(Boolean).length;
  const completed = total > 0 && completedCount === total;
  return { total, completedCount, completed,
    progress: completed ? 100 : total ? Math.min(99, Math.round(completedCount / total * 100)) : 0 };
}

/** Read existing completion flags; never infer completion from enrollment or average percentages. */
export function roadmapProgress(roadmap: TeacherRoadmap, lessons: Map<string, Lesson>, enrollments: Map<string, LessonEnrollment>) {
  const items = [...new Set(roadmap.lessonIds)].map(id => {
    const lesson = lessons.get(id);
    const available = !!lesson && isEligibleRoadmapLesson(lesson, roadmap.teacherId, roadmap.careerGoalId);
    const enrollment = enrollments.get(id);
    const completed = available && enrollment?.completed === true;
    const progress = completed ? 100 : Math.max(0, Math.min(99, Number(enrollment?.progress) || 0));
    const status = !available ? 'Unavailable' : completed ? 'Completed' : !enrollment ? 'Not Enrolled'
      : progress > 0 ? `${progress}% In Progress` : 'Enrolled / Not Started';
    return { id, lesson, enrollment, available, completed, progress, status };
  });
  // Missing/unpublished/mismatched references cannot permanently block a path.
  const current = items.filter(item => item.available);
  return { items, ...completionSummary(current),
    next: current.find(item => !item.completed), unavailableCount: items.length - current.length };
}

export type RoadmapJourney = { roadmap: TeacherRoadmap; summary: ReturnType<typeof roadmapProgress> };
export function getSkillProgress(journeys: RoadmapJourney[]) {
  return completionSummary(journeys.flatMap(journey => journey.summary.items.filter(item => item.available)));
}
export const getCareerGoalProgress = getSkillProgress;

/** Visible paths only; aggregate unique lesson IDs, never averaged path percentages. */
export function learnerRoadmapHierarchy(roadmaps: TeacherRoadmap[], lessons: Map<string, Lesson>, enrollments: Map<string, LessonEnrollment>) {
  const goals = new Map<CareerGoalTag, Map<string, { name: string; journeys: RoadmapJourney[] }>>();
  for (const roadmap of new Map(roadmaps.map(row => [row.id, row])).values()) {
    const summary = roadmapProgress(roadmap, lessons, enrollments);
    if (!summary.items.some(item => item.available && item.enrollment)) continue;
    let skills = goals.get(roadmap.careerGoalId);
    if (!skills) { skills = new Map(); goals.set(roadmap.careerGoalId, skills); }
    const key = skillKeyFor(roadmap.skill);
    const skill = skills.get(key) ?? { name: cleanSkill(roadmap.skill), journeys: [] };
    skill.journeys.push({ roadmap, summary }); skills.set(key, skill);
  }
  return [...goals].map(([id, skills]) => ({
    id, name: careerGoalByTag(id)?.label ?? id,
    progress: getCareerGoalProgress([...skills.values()].flatMap(skill => skill.journeys)),
    skills: [...skills].map(([key, skill]) => ({ key, ...skill, progress: getSkillProgress(skill.journeys) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).sort((a, b) => a.name.localeCompare(b.name));
}
