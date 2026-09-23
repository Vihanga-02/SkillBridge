/**
 * [M1] Offline question bank for the Skill Verification Test.
 *
 * Every catalog skill owns 15 beginner-competency concepts. Questions and
 * options are built deterministically from that reviewed local data, so taking
 * a test never calls an AI service or depends on network availability.
 */

import { LEVELS, SKILLS, skillLabel, type Level, type SkillTag } from '@/constants/skills';
import { SKILL_QUIZ_CONCEPTS } from '@/constants/skillQuizData';
import type { TestQuestion } from '@/types';

export const SKILL_TEST_BANK_SIZE = 15;

export const QUESTION_COUNT_BY_LEVEL: Record<Level, number> = {
  beginner: 5,
  intermediate: 10,
  advanced: 15,
};

const buildQuestions = (skillTag: SkillTag): TestQuestion[] => {
  const concepts = SKILL_QUIZ_CONCEPTS[skillTag];

  return concepts.map(([term, answer], index) => {
    const distractors = [
      concepts[(index + 1) % concepts.length][1],
      concepts[(index + 5) % concepts.length][1],
      concepts[(index + 9) % concepts.length][1],
    ];
    const answerIndex = index % 4;
    const options = [...distractors];
    options.splice(answerIndex, 0, answer);

    return {
      q: `In ${skillLabel(skillTag)}, what best describes "${term}"?`,
      type: 'mcq',
      options,
      answer,
    };
  });
};

export const SKILL_TEST_BANK: Record<SkillTag, TestQuestion[]> = Object.fromEntries(
  SKILLS.map(({ tag }) => [tag, buildQuestions(tag)])
) as Record<SkillTag, TestQuestion[]>;

export const hasTestFor = (skillTag: string): skillTag is SkillTag =>
  Object.prototype.hasOwnProperty.call(SKILL_TEST_BANK, skillTag);

export const getTestQuestions = (skillTag: SkillTag, level: Level): TestQuestion[] =>
  SKILL_TEST_BANK[skillTag].slice(0, QUESTION_COUNT_BY_LEVEL[level]);

/** Runtime checks complement the compile-time catalog coverage check. */
export const hasCompleteSkillTestBank = (): boolean =>
  SKILLS.every(({ tag }) => SKILL_TEST_BANK[tag].length === SKILL_TEST_BANK_SIZE) &&
  LEVELS.every((level) => QUESTION_COUNT_BY_LEVEL[level] <= SKILL_TEST_BANK_SIZE);
