/** Defensive boundary for legacy or missing numeric counters. */
export function nonNegativeCount(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0;
}
