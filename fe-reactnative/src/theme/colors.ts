/**
 * Telkom Red Enterprise Flow System — Design Tokens
 *
 * Brand Red scale   : #7A0019 → #FFF1F3
 * Neutral scale     : #0F1720 → #F8FAFC
 * Semantic colors follow WCAG 2.1 AA minimum contrast ratios.
 */

export const colors = {
  // ── Brand Red ────────────────────────────────────
  brand: {
    900: '#7A0019',
    800: '#9B0020',
    700: '#BE0726',
    600: '#ED1C24', // Primary action
    500: '#F04E55',
    400: '#F47B81',
    300: '#F8A9AD',
    200: '#FBD5D7',
    100: '#FDE8E9',
    50:  '#FFF1F3',
  },

  // ── Neutral ──────────────────────────────────────
  neutral: {
    950: '#0F1720',
    900: '#1A2332',
    800: '#2D3748',
    700: '#4A5568',
    600: '#64748B',
    500: '#94A3B8',
    400: '#CBD5E1',
    300: '#E2E8F0',
    200: '#EEF2F6',
    100: '#F1F5F9',
    50:  '#F8FAFC',
  },

  // ── Semantic ─────────────────────────────────────
  success:           '#059669',
  successLight:      '#ECFDF5',
  successBorder:     '#A7F3D0',

  warning:           '#D97706',
  warningLight:      '#FFFBEB',
  warningBorder:     '#FDE68A',

  error:             '#DC2626',
  errorLight:        '#FEF2F2',
  errorBorder:       '#FECACA',

  info:              '#2563EB',
  infoLight:         '#EFF6FF',
  infoBorder:        '#BFDBFE',

  // ── Surface ──────────────────────────────────────
  surface:           '#FFFFFF',
  background:        '#F8FAFC',
  backgroundMuted:   '#F1F5F9',

  // ── Convenience aliases (direct usage in RN style props) ─
  primary:           '#ED1C24',
  primaryDark:       '#9B0020',
  primaryLight:      '#FFF1F3',

  textPrimary:       '#0F1720',
  textSecondary:     '#4A5568',
  textMuted:         '#94A3B8',
  textOnPrimary:     '#FFFFFF',

  border:            '#E2E8F0',
  borderStrong:      '#CBD5E1',

  // ── AI accent (distinct from brand red) ──────────
  aiAccent:          '#9B0020',
  aiBackground:      '#FFF1F3',
} as const;

/** Type-safe palette key union */
export type ColorToken = keyof typeof colors;
