/** Small display helpers, so the same number is never formatted two ways. */

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Avoid presenting a zero average as a real teacher rating. */
export function formatRating(average: number, count: number): string {
  if (!Number.isSafeInteger(count) || count <= 0) return 'No reviews yet';
  const safeAverage = Number.isFinite(average) && average >= 0 ? Math.min(average, 5) : 0;
  return safeAverage.toFixed(1);
}

export const plural = (count: number, singular: string, pluralForm?: string): string =>
  `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;

export function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}
