import { lessonShareText, profileShareText, sessionShareText } from '../src/utils/share';

const at = (date: Date) => ({ toDate: () => date, toMillis: () => date.getTime() }) as never;
const skill = (label: string) => ({ skill: label, label, level: 'beginner', verified: false, credentialCount: 0 }) as never;

describe('share text', () => {
  it('describes a profile with up to three skills and links to it', () => {
    const text = profileShareText({
      uid: 'u1',
      name: 'Kasun',
      skillsOffered: [skill('Python'), skill('React'), skill('SQL'), skill('Git')],
    });
    expect(text).toBe('Kasun on SkillBridge — teaches Python, React, SQL.\nskillbridge://user/u1');
  });

  it('omits the skills line for a member who teaches nothing yet', () => {
    expect(profileShareText({ uid: 'u2', name: 'Nimali', skillsOffered: [] })).toBe(
      'Nimali on SkillBridge.\nskillbridge://user/u2'
    );
  });

  it('links a lesson to its details screen', () => {
    expect(
      lessonShareText({ id: 'l1', lessonName: 'React Basics', teacherName: 'Kasun', careerGoalName: 'Software Engineer' })
    ).toBe('Learn “React Basics” (Software Engineer) by Kasun on SkillBridge.\nskillbridge://lesson/details/l1');
  });

  it('includes when and how a session runs, and links to it', () => {
    const text = sessionShareText({
      id: 's1',
      title: 'Intro to SQL',
      teacherName: 'Nimali',
      startAt: at(new Date(2026, 9, 14, 15, 0)),
      mode: 'online',
    });
    expect(text).toMatch(/^Join “Intro to SQL” with Nimali — .+ \(Online\)\. Book it on SkillBridge\.\n/);
    expect(text.endsWith('skillbridge://session/s1')).toBe(true);
  });
});
