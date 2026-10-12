import { withUserDefaults } from '../src/utils/userDefaults';

describe('withUserDefaults', () => {
  it('fills every missing list field on an account that predates them', () => {
    const user = withUserDefaults({ name: 'Old Account', skillTagsWanted: ['python'] }, 'old');
    expect(user.uid).toBe('old');
    expect(user.careerGoals).toEqual([]);
    expect(user.extraSkillsWanted).toEqual([]);
    expect(user.skillsOffered).toEqual([]);
    expect(user.skillTagsWanted).toEqual(['python']);
  });

  it('replaces a malformed list field instead of passing it through', () => {
    const user = withUserDefaults({ careerGoals: { 0: 'not-an-array' }, badges: null }, 'x');
    expect(user.careerGoals).toEqual([]);
    expect(user.badges).toEqual([]);
  });

  it('keeps existing values and the document id wins over a stored uid', () => {
    const goals = [{ goal: 'software-engineer', label: 'Software Engineer', skillTags: [] }];
    const user = withUserDefaults({ uid: 'stale', careerGoals: goals, credits: 10 }, 'real');
    expect(user.uid).toBe('real');
    expect(user.careerGoals).toBe(goals);
    expect(user.credits).toBe(10);
  });
});
