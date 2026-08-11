import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

import { LEVEL_LABELS } from '@/constants/skills';
import type { BookingStatus, Level, SessionMode, SessionType } from '@/types';
import { toDate } from '@/utils/date';

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  one_to_one: 'One-to-one',
  group: 'Group',
};

export const SESSION_MODE_LABEL: Record<SessionMode, string> = {
  online: 'Online',
  in_person: 'In-person',
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export function formatSessionDate(value: Timestamp | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, 'd MMMM yyyy') : '—';
}

/** Matches the brief's "6.00 PM" style. */
export function formatSessionTime(value: Timestamp | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, 'h.mm a') : '—';
}

export function formatDurationMins(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours}h ${rem}m`;
}

export function formatLevel(level: Level): string {
  return LEVEL_LABELS[level] ?? level;
}
