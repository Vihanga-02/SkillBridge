import type { SkillTag } from '@/constants/skills';

import { ACADEMIC_QUIZ_CONCEPTS } from './academic';
import { BUSINESS_QUIZ_CONCEPTS } from './business';
import { DESIGN_QUIZ_CONCEPTS } from './design';
import { PROGRAMMING_QUIZ_CONCEPTS } from './programming';
import type { QuizConcept } from './types';

/**
 * Compile-time coverage check: adding a skill to the shared catalog requires
 * adding its 15 verification concepts here before TypeScript will pass.
 */
export const SKILL_QUIZ_CONCEPTS = {
  ...PROGRAMMING_QUIZ_CONCEPTS,
  ...DESIGN_QUIZ_CONCEPTS,
  ...BUSINESS_QUIZ_CONCEPTS,
  ...ACADEMIC_QUIZ_CONCEPTS,
} satisfies Record<SkillTag, readonly QuizConcept[]>;

