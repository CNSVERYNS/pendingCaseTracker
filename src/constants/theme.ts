/**
 * Design tokens — Pending build brief §9 (design system).
 * Dark theme only in v1. No other colors, no gradients, no shadows.
 */

export const Colors = {
  ink: '#100E0C', // background
  surface: '#1A1613', // raised surface
  hairline: '#2E2721', // 1px dividers
  paper: '#EFE7DC', // primary text
  muted: '#8A7F73', // secondary text
  // Spec value #564E46 measures ~2.36:1 against `ink` — well under the 4.5:1
  // floor for small text (§14 calls this out by name and says raise it if it
  // fails). Lightened to the same hue ratios at ~5.0:1; #564E46 kept as
  // ORIGINAL_DIM below in case a future non-text usage wants the exact spec
  // color.
  dim: '#8C8074', // tertiary, future steps
  amber: '#E3A04A', // the accent — current step, ruler marker, one CTA
} as const;

export const ORIGINAL_DIM = '#564E46';

export type ColorToken = keyof typeof Colors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 26,
  xxl: 44,
} as const;

/** Screen edge margin, per §9. */
export const ScreenMargin = Spacing.xl;

export const Radius = {
  pill: 17,
  card: 26,
} as const;

/**
 * Newsreader is specified at variable weights 250-380. The static per-weight
 * font package only ships multiples of 100, so Light (300) and Regular (400)
 * are the closest stand-ins for the big number / section titles until a
 * variable-font asset with a numeric "wght" axis is wired in.
 */
export const FontFamily = {
  serifLight: 'Newsreader_300Light',
  serifRegular: 'Newsreader_400Regular',
  serifMedium: 'Newsreader_500Medium',
  sans: 'InterTight_400Regular',
  sansMedium: 'InterTight_500Medium',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

/** Single 3s breathing loop on the current-step dot. Everything else is instant or 150ms. */
export const Motion = {
  breatheDurationMs: 3000,
  fadeDurationMs: 150,
} as const;

export const MinTouchTarget = 44;
