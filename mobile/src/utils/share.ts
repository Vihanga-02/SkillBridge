import { Share } from 'react-native';

import type { Lesson, Session, User } from '@/types';
import { formatSessionDate, formatSessionTime, SESSION_MODE_LABEL } from '@/utils/sessionFormat';

/** `scheme` in app.json — opens the app on that screen when it is installed. */
const APP_LINK = 'skillbridge://';

/** The share text for each kind of item. Pure, so it can be tested. */
export function profileShareText(user: Pick<User, 'uid' | 'name' | 'skillsOffered'>): string {
  const skills = (user.skillsOffered ?? []).slice(0, 3).map((skill) => skill.label);
  const teaches = skills.length > 0 ? ` — teaches ${skills.join(', ')}` : '';
  return `${user.name} on SkillBridge${teaches}.\n${APP_LINK}user/${user.uid}`;
}

export function lessonShareText(lesson: Pick<Lesson, 'id' | 'lessonName' | 'teacherName' | 'careerGoalName'>): string {
  const goal = lesson.careerGoalName ? ` (${lesson.careerGoalName})` : '';
  const by = lesson.teacherName ? ` by ${lesson.teacherName}` : '';
  return `Learn “${lesson.lessonName}”${goal}${by} on SkillBridge.\n${APP_LINK}lesson/details/${lesson.id}`;
}

export function sessionShareText(
  session: Pick<Session, 'id' | 'title' | 'teacherName' | 'startAt' | 'mode'>
): string {
  const when = `${formatSessionDate(session.startAt)}, ${formatSessionTime(session.startAt)}`;
  return `Join “${session.title}” with ${session.teacherName} — ${when} (${SESSION_MODE_LABEL[session.mode]}). Book it on SkillBridge.\n${APP_LINK}session/${session.id}`;
}

/** Opens the phone's share sheet. Cancelling or a share failure is not an error worth showing. */
export async function shareText(message: string): Promise<void> {
  try {
    await Share.share({ message });
  } catch {
    // The share sheet was dismissed or is unavailable — nothing to do.
  }
}
