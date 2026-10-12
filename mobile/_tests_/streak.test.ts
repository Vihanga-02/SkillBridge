import { currentStreak, localDay, nextStreak } from '../src/utils/streak';

describe('nextStreak', () => {
  it('starts at 1 for a first active day', () => {
    expect(nextStreak(0, '', '2026-10-12')).toBe(1);
    expect(nextStreak(undefined, undefined, '2026-10-12')).toBe(1);
  });

  it('does not change on a second activity the same day', () => {
    expect(nextStreak(4, '2026-10-12', '2026-10-12')).toBe(4);
    expect(nextStreak(0, '2026-10-12', '2026-10-12')).toBe(1);
  });

  it('adds one when the last active day was yesterday, across months and years', () => {
    expect(nextStreak(4, '2026-10-11', '2026-10-12')).toBe(5);
    expect(nextStreak(2, '2026-09-30', '2026-10-01')).toBe(3);
    expect(nextStreak(9, '2025-12-31', '2026-01-01')).toBe(10);
  });

  it('resets to 1 after a missed day or bad data', () => {
    expect(nextStreak(7, '2026-10-09', '2026-10-12')).toBe(1);
    expect(nextStreak(7, 'not-a-date', '2026-10-12')).toBe(1);
    expect(nextStreak('7', '2026-10-11', '2026-10-12')).toBe(1);
  });
});

describe('currentStreak', () => {
  it('shows the streak while it is still alive (active today or yesterday)', () => {
    expect(currentStreak(5, '2026-10-12', '2026-10-12')).toBe(5);
    expect(currentStreak(5, '2026-10-11', '2026-10-12')).toBe(5);
  });

  it('shows 0 once a day has been missed, or with no history', () => {
    expect(currentStreak(5, '2026-10-10', '2026-10-12')).toBe(0);
    expect(currentStreak(0, '', '2026-10-12')).toBe(0);
    expect(currentStreak(undefined, undefined, '2026-10-12')).toBe(0);
  });
});

describe('localDay', () => {
  it('formats the local calendar day with zero padding', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
