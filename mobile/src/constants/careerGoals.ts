/**
 * Career goal taxonomy — the layer on top of "skills to learn".
 *
 * A learner picks a goal, then picks which of its skills to actually focus on
 * (a goal's `skillTags` is the *full* curriculum, not a forced set). The same
 * skill tag deliberately appears under multiple goals — e.g. `sql` backs
 * Software Engineer, Backend Developer, Business Analyst and Data Scientist —
 * so a teacher who offers one skill surfaces for every learner chasing any goal
 * that needs it.
 *
 * Flat list, no sub-grouping: ten goals fit in one chip row, and grouping by
 * `Category` would be misleading since most goals span several categories.
 * Adding an eleventh goal is a one-line entry below.
 */

import { skillByTag, type SkillTag } from '@/constants/skills';

export const CAREER_GOALS = [
  {
    tag: 'software-engineer',
    label: 'Software Engineer',
    skillTags: [
      'html-css',
      'javascript',
      'python',
      'java',
      'sql',
      'git',
      'data-structures-algorithms',
      'rest-apis',
      'system-design',
    ],
  },
  {
    tag: 'frontend-developer',
    label: 'Frontend Developer',
    skillTags: ['html-css', 'javascript', 'react', 'git', 'ui-ux', 'figma'],
  },
  {
    tag: 'backend-developer',
    label: 'Backend Developer',
    skillTags: ['python', 'java', 'sql', 'rest-apis', 'system-design', 'git', 'docker-devops'],
  },
  {
    tag: 'cloud-engineer',
    label: 'Cloud Engineer',
    skillTags: ['cloud-computing', 'linux', 'networking', 'docker-devops', 'python', 'system-design'],
  },
  {
    tag: 'ui-ux-designer',
    label: 'UI/UX Designer',
    skillTags: ['figma', 'ui-ux', 'photoshop', 'illustrator', 'video-editing'],
  },
  {
    tag: 'business-analyst',
    label: 'Business Analyst',
    skillTags: ['business-analysis', 'sql', 'excel', 'digital-marketing', 'public-speaking', 'research-writing'],
  },
  {
    tag: 'data-scientist',
    label: 'Data Scientist',
    skillTags: ['python', 'sql', 'mathematics', 'machine-learning', 'excel', 'research-writing'],
  },
  {
    tag: 'project-manager',
    label: 'Project Manager',
    skillTags: ['project-management', 'public-speaking', 'excel', 'entrepreneurship', 'digital-marketing'],
  },
  {
    tag: 'cybersecurity-engineer',
    label: 'Cybersecurity Engineer',
    skillTags: ['cybersecurity', 'networking', 'linux', 'python', 'cloud-computing'],
  },
  {
    tag: 'network-engineer',
    label: 'Network Engineer',
    skillTags: ['networking', 'linux', 'cloud-computing', 'cybersecurity', 'system-design'],
  },
] as const satisfies readonly { tag: string; label: string; skillTags: SkillTag[] }[];

/** A mistyped goal tag becomes a compile error, same guarantee as `SkillTag`. */
export type CareerGoalTag = (typeof CAREER_GOALS)[number]['tag'];

export type CareerGoalDef = {
  tag: CareerGoalTag;
  label: string;
  skillTags: SkillTag[];
};

const GOAL_BY_TAG = new Map<string, CareerGoalDef>(
  CAREER_GOALS.map((g) => [g.tag, g as CareerGoalDef])
);

export const careerGoalByTag = (tag: string): CareerGoalDef | undefined => GOAL_BY_TAG.get(tag);

/** Falls back to the raw tag so a legacy/unknown value still renders something. */
export const goalLabel = (tag: string): string => GOAL_BY_TAG.get(tag)?.label ?? tag;

/** The goal's full curriculum as `Skill` objects, for rendering labelled chips. */
export const skillsInGoal = (tag: CareerGoalTag) =>
  (careerGoalByTag(tag)?.skillTags ?? [])
    .map((skillTag) => skillByTag(skillTag))
    .filter((skill): skill is NonNullable<typeof skill> => !!skill);
