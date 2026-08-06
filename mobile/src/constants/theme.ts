/**
 * SkillBridge design system — §13 of the implementation plan.
 *
 * 60:30:10 colour ratio. No screen file may contain a raw hex code, pixel value
 * or font size. If a value is missing here, add it here first (via PR) — that is
 * what keeps four independently built components looking like one app.
 */

export const colors = {
  // 60% — dominant (neutral canvas)
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F5',
  border: '#E2E6EC',

  // 30% — secondary (structure & text)
  ink: '#16233A',
  inkMuted: '#5A6B85',
  inkFaint: '#7A8AA3', // icons / 18pt+ only — 3.3:1
  inkInverse: '#FFFFFF',
  inkInverseMuted: '#A8B4C8', // secondary text/icons on an `ink` surface — 6.4:1

  // 10% — accent (the one brand colour)
  accent: '#0B7A6D',
  accentPressed: '#095F55',
  accentSurface: '#E6F4F1',

  // semantic — state only, not brand
  success: '#15734A',
  warning: '#9A5A0B',
  danger: '#B3261E',
  info: '#1D4ED8',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 20, full: 999 } as const;

export const type = {
  display: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  h1: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  h2: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#16233A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;

/** Minimum touch target is 44 — pad the pressable, never grow the icon. */
export const sizes = {
  touchMin: 44,
  control: 50,
  avatarSm: 32,
  avatarMd: 44,
  avatarLg: 88,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  /** Height of an inline document / media preview pane. */
  preview: 320,
} as const;

/**
 * Booking / session status -> semantic colour. Both M3 and M4 import this,
 * so a "confirmed" badge is the same green everywhere in the app.
 */
export const statusColor = {
  pending: colors.warning,
  confirmed: colors.success,
  completed: colors.success,
  declined: colors.danger,
  cancelled: colors.danger,
} as const;

export const theme = { colors, spacing, radius, type, shadow, sizes, statusColor };
export default theme;
