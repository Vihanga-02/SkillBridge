/**
 * Shared form rules, so all four members validate identically.
 * Each rule returns an error message, or `null` when the value is acceptable.
 */

import { TEXT_LIMITS } from '@/constants/config';

export type FieldError = string | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value: string): FieldError {
  const email = value.trim();
  if (!email) return 'Email is required.';
  if (!EMAIL_RE.test(email)) return 'Please enter a valid email address.';
  return null;
}

export function validateName(value: string): FieldError {
  const name = value.trim();
  const { min, max } = TEXT_LIMITS.name;
  if (!name) return 'Name is required.';
  if (name.length < min) return `Name must be at least ${min} characters.`;
  if (name.length > max) return `Name must be under ${max} characters.`;
  return null;
}

export function validatePassword(value: string): FieldError {
  const { min, max } = TEXT_LIMITS.password;
  if (!value) return 'Password is required.';
  if (value.length < min) return `Password must be at least ${min} characters.`;
  if (value.length > max) return `Password must be under ${max} characters.`;
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): FieldError {
  if (!confirm) return 'Please re-enter your password.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

export function validateBio(value: string): FieldError {
  if (value.length > TEXT_LIMITS.bio) return `Bio must be under ${TEXT_LIMITS.bio} characters.`;
  return null;
}

export function validateHttpsUrl(value: string, required = false): FieldError {
  const url = value.trim();
  if (!url) return required ? 'A link is required.' : null;
  if (!url.startsWith('https://')) return 'Link must start with https://';
  return null;
}

/** True when every field in the map passed. */
export const isClean = (errors: Record<string, FieldError>): boolean =>
  Object.values(errors).every((e) => e === null);
