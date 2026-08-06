/**
 * THE shared skill taxonomy — §6.1 of the implementation plan.
 *
 * Every picker, chip and filter in all four components reads from this file.
 * Free-typed tags are forbidden: one typo silently breaks discovery, the lesson
 * feed and session browse at once, with no compile-time warning.
 *
 * `tag` is always lowercase-kebab and is the value stored in Firestore.
 * `label` is the only thing a user ever sees.
 */

export const CATEGORIES = [
  'Programming',
  'Design',
  'Business',
  'Academic',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const SKILLS = [
  // Programming
  { tag: 'python', label: 'Python', category: 'Programming' },
  { tag: 'javascript', label: 'JavaScript', category: 'Programming' },
  { tag: 'react', label: 'React', category: 'Programming' },
  { tag: 'java', label: 'Java', category: 'Programming' },
  { tag: 'sql', label: 'SQL & Databases', category: 'Programming' },
  { tag: 'html-css', label: 'HTML & CSS', category: 'Programming' },
  { tag: 'git', label: 'Git & Version Control', category: 'Programming' },
  { tag: 'linux', label: 'Linux / Command Line', category: 'Programming' },
  { tag: 'data-structures-algorithms', label: 'Data Structures & Algorithms', category: 'Programming' },
  { tag: 'rest-apis', label: 'REST APIs', category: 'Programming' },
  { tag: 'system-design', label: 'System Design', category: 'Programming' },
  { tag: 'cloud-computing', label: 'Cloud Computing', category: 'Programming' },
  { tag: 'networking', label: 'Computer Networking', category: 'Programming' },
  { tag: 'cybersecurity', label: 'Cybersecurity Fundamentals', category: 'Programming' },
  { tag: 'docker-devops', label: 'Docker & DevOps', category: 'Programming' },
  { tag: 'machine-learning', label: 'Machine Learning', category: 'Programming' },

  // Design
  { tag: 'figma', label: 'Figma', category: 'Design' },
  { tag: 'photoshop', label: 'Photoshop', category: 'Design' },
  { tag: 'illustrator', label: 'Illustrator', category: 'Design' },
  { tag: 'ui-ux', label: 'UI/UX Design', category: 'Design' },
  { tag: 'video-editing', label: 'Video Editing', category: 'Design' },

  // Business
  { tag: 'public-speaking', label: 'Public Speaking', category: 'Business' },
  { tag: 'digital-marketing', label: 'Digital Marketing', category: 'Business' },
  { tag: 'entrepreneurship', label: 'Entrepreneurship', category: 'Business' },
  { tag: 'excel', label: 'Excel & Spreadsheets', category: 'Business' },
  { tag: 'business-analysis', label: 'Business Analysis', category: 'Business' },
  { tag: 'project-management', label: 'Project Management', category: 'Business' },

  // Academic
  { tag: 'mathematics', label: 'Mathematics', category: 'Academic' },
  { tag: 'physics', label: 'Physics', category: 'Academic' },
  { tag: 'accounting', label: 'Accounting', category: 'Academic' },
  { tag: 'research-writing', label: 'Research Writing', category: 'Academic' },
] as const satisfies readonly { tag: string; label: string; category: Category }[];

/** A mistyped tag becomes a compile error instead of a query that returns nothing. */
export type SkillTag = (typeof SKILLS)[number]['tag'];

export type Skill = {
  tag: SkillTag;
  label: string;
  category: Category;
};

const SKILL_BY_TAG = new Map<string, Skill>(SKILLS.map((s) => [s.tag, s as Skill]));

export const skillByTag = (tag: string): Skill | undefined => SKILL_BY_TAG.get(tag);

/** Falls back to the raw tag so a legacy/unknown value still renders something. */
export const skillLabel = (tag: string): string => SKILL_BY_TAG.get(tag)?.label ?? tag;

export const skillsInCategory = (category: Category): Skill[] =>
  SKILLS.filter((s) => s.category === category) as unknown as Skill[];
