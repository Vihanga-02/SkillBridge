import { useCallback, useSyncExternalStore } from 'react';
import { subscribeToLesson } from '@/services/lessonService';

type State = { count: number | null; error: boolean };
const pending: State = { count: null, error: false };
type Entry = { state: State; listeners: Set<() => void>; stop?: () => void };
const entries = new Map<string, Entry>();

// All mounted views of the same lesson share a single Firestore listener.
export function useLessonEnrollmentCount(lessonId: string): State {
  const subscribe = useCallback((notify: () => void) => {
    let entry = entries.get(lessonId);
    if (!entry) {
      entry = { state: pending, listeners: new Set() };
      entries.set(lessonId, entry);
    }
    entry.listeners.add(notify);
    if (!entry.stop) {
      const current = entry;
      const publish = (state: State) => {
        current.state = state;
        current.listeners.forEach((listener) => listener());
      };
      entry.stop = subscribeToLesson(lessonId,
        (lesson) => publish({ count: lesson ? lesson.enrollmentCount ?? 0 : null, error: !lesson }),
        () => publish({ count: null, error: true }));
    }
    return () => {
      entry.listeners.delete(notify);
      if (entry.listeners.size === 0) {
        entry.stop?.();
        entries.delete(lessonId);
      }
    };
  }, [lessonId]);
  const snapshot = useCallback(() => entries.get(lessonId)?.state ?? pending, [lessonId]);
  return useSyncExternalStore(subscribe, snapshot, () => pending);
}
