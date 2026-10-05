import { Platform } from 'react-native';
import { DEFAULT_THEME, isThemeId, PALETTES, rgbaOf, type ThemeId } from './palettes';
import { readStoredTheme } from './storedTheme';

/**
 * Design tokens. Every screen pulls from here so the look stays consistent
 * and can be retuned in one place. The night and glow colours come from the
 * app theme (`palettes.ts`), read once as the app starts.
 *
 * Direction: festival glow at night. A deep violet-ink sky, moonlight text,
 * one purple glow used sparingly for "this matters" moments.
 */
/** The theme the app wears this time it runs (chosen on Settings → App theme; a new one applies on restart). */
export const THEME_ID: ThemeId = startingTheme();
const palette = PALETTES[THEME_ID];

export const color = {
  night: palette.night, // app background
  nightRaised: palette.nightRaised, // sheets, raised surfaces (under blur)
  glass: 'rgba(255,255,255,0.06)',
  hairline: 'rgba(255,255,255,0.10)',

  moon: '#F3F0FF', // primary text
  moonDim: 'rgba(243,240,255,0.62)', // secondary text
  moonFaint: 'rgba(243,240,255,0.36)', // tertiary text, region labels

  glow: palette.glow, // the accent: matches, active states
  glowDeep: palette.glowDeep,
  haze: palette.haze, // large background light
  dusk: palette.dusk, // cool counter-light
  stage: palette.stage, // warm stage light, background only, very faint
};

/** The accent, the deeper accent, the night and raised surfaces at an opacity, in the theme's colours. */
export const glowA = (alpha: number) => rgbaOf(palette.glow, alpha);
export const glowDeepA = (alpha: number) => rgbaOf(palette.glowDeep, alpha);
export const nightA = (alpha: number) => rgbaOf(palette.night, alpha);
export const raisedA = (alpha: number) => rgbaOf(palette.nightRaised, alpha);

function startingTheme(): ThemeId {
  const id = readStoredTheme();
  return isThemeId(id) ? id : DEFAULT_THEME;
}

const system = Platform.select({ ios: 'System', default: undefined });

export const type = {
  largeTitle: { fontFamily: system, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8 },
  title: { fontFamily: system, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.5 },
  headline: { fontFamily: system, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontFamily: system, fontSize: 15, lineHeight: 21, fontWeight: '400', letterSpacing: -0.1 },
  label: { fontFamily: system, fontSize: 13, lineHeight: 16, fontWeight: '600', letterSpacing: -0.05 },
  caption: { fontFamily: system, fontSize: 12, lineHeight: 15, fontWeight: '500', letterSpacing: 0 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 10, md: 16, lg: 24, sheet: 32, pill: 999 } as const;

export const motion = {
  // Springs tuned to feel like iOS: quick, settled, no wobble.
  snappy: { damping: 22, stiffness: 260, mass: 0.9 },
  gentle: { damping: 20, stiffness: 140, mass: 1 },
  bloom: { damping: 14, stiffness: 120, mass: 0.8 },
} as const;
