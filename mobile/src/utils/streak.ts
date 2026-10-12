/**
 * Learning streak (§5.2 of the plan): days in a row with lesson progress.
 * Dates are the device's local calendar day as 'YYYY-MM-DD', matching how
 * `users.lastActiveDate` is stored.
 */

/** Today's local calendar day, e.g. '2026-10-12'. */
export function localDay(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Whole days from `from` to `to` (both 'YYYY-MM-DD'), or null if either is not a valid day. */
function daysBetween(from: string, to: string): number | null {
  const parse = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
  };
  const a = parse(from);
  const b = parse(to);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : null;
}

const safeStreak = (streak: unknown) =>
  typeof streak === 'number' && Number.isFinite(streak) && streak > 0 ? Math.floor(streak) : 0;

/**
 * The streak after learning today: same day → unchanged (at least 1),
 * yesterday → +1, anything older (or never) → 1.
 */
export function nextStreak(streak: unknown, lastActiveDate: unknown, today: string): number {
  const gap = typeof lastActiveDate === 'string' ? daysBetween(lastActiveDate, today) : null;
  const current = safeStreak(streak);
  if (gap === 0) return Math.max(1, current);
  if (gap === 1) return current + 1;
  return 1;
}

/**
 * The streak to show today. A stored streak only stays alive while the last
 * active day is today or yesterday — after that it has been broken, even
 * though the document still holds the old number.
 */
export function currentStreak(streak: unknown, lastActiveDate: unknown, today: string): number {
  const gap = typeof lastActiveDate === 'string' ? daysBetween(lastActiveDate, today) : null;
  return gap === 0 || gap === 1 ? safeStreak(streak) : 0;
}
