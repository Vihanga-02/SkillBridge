import { LEVELS, SKILLS } from '@/constants/skills';
import {
  QUESTION_COUNT_BY_LEVEL,
  SKILL_TEST_BANK,
  SKILL_TEST_BANK_SIZE,
  getTestQuestions,
  hasCompleteSkillTestBank,
  hasTestFor,
} from '@/constants/skillTestBank';

describe('offline skill verification question bank', () => {
  it('covers every catalog skill with exactly 15 valid MCQs', () => {
    expect(Object.keys(SKILL_TEST_BANK)).toHaveLength(SKILLS.length);
    expect(hasCompleteSkillTestBank()).toBe(true);

    for (const { tag } of SKILLS) {
      expect(hasTestFor(tag)).toBe(true);
      expect(SKILL_TEST_BANK[tag]).toHaveLength(SKILL_TEST_BANK_SIZE);

      for (const question of SKILL_TEST_BANK[tag]) {
        expect(question.type).toBe('mcq');
        expect(question.q.trim()).not.toBe('');
        expect(question.options).toHaveLength(4);
        expect(new Set(question.options).size).toBe(4);
        expect(question.options).toContain(question.answer);
      }
    }
  });

  it.each(LEVELS)('selects the configured number of questions for %s', (level) => {
    for (const { tag } of SKILLS) {
      expect(getTestQuestions(tag, level)).toHaveLength(QUESTION_COUNT_BY_LEVEL[level]);
    }
  });

  it('uses 5 beginner, 10 intermediate, and 15 advanced questions', () => {
    expect(QUESTION_COUNT_BY_LEVEL).toEqual({
      beginner: 5,
      intermediate: 10,
      advanced: 15,
    });
  });

  it('rejects a skill that is not in the shared catalog', () => {
    expect(hasTestFor('not-a-real-skill')).toBe(false);
  });
});
