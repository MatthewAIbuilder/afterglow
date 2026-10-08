import { Platform } from 'react-native';
import { DEFAULT_THEME, isThemeId, PALETTES, RAINBOW, rgbaOf, SPECTRUM, type ThemeId } from './palettes';
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
/** The Pride theme: the rainbow runs all through the app (the sky, the tab bar, celebrations), not just one glow. */
export const PRIDE = THEME_ID === 'pride';
/** The rainbow flag's six colours, red to violet. */
export const rainbow = RAINBOW;

export const color = {
  night: palette.night, // app background
  nightRaised: palette.nightRaised, // sheets, raised surfaces (under blur)
  glass: glassOf(0.06), // cards and rows: clear glass holding a breath of the theme's glow
  hairline: 'rgba(255,255,255,0.10)',
  rim: 'rgba(255,255,255,0.2)', // the lit top edge of glass, where the light lands

  moon: '#F3F0FF', // primary text
  moonDim: 'rgba(243,240,255,0.62)', // secondary text
  moonFaint: 'rgba(243,240,255,0.36)', // tertiary text, region labels

  glow: palette.glow, // the accent: matches, active states
  glowDeep: palette.glowDeep,
  haze: palette.haze, // large background light
  dusk: palette.dusk, // cool counter-light
  stage: palette.stage, // warm stage light, background only, very faint
  amber: '#FFB86B', // a quiet heads-up (something you'd miss), never an alarm
  coral: '#FF8A8A', // care that needs a hand: soft, never a siren
};

/** The six festival lights (rose, tangerine, gold, mint, sky, violet): each festival and show has one (`features/festivals/light.ts`). */
export const spectrum = SPECTRUM;

/** The accent, the deeper accent, the night and raised surfaces at an opacity, in the theme's colours. */
export const glowA = (alpha: number) => rgbaOf(palette.glow, alpha);
export const glowDeepA = (alpha: number) => rgbaOf(palette.glowDeep, alpha);
export const nightA = (alpha: number) => rgbaOf(palette.night, alpha);
export const raisedA = (alpha: number) => rgbaOf(palette.nightRaised, alpha);
/** A solid accent button as tinted glass: light caught along its top edge, a soft glow around the rest. */
export const accentEdge = { borderWidth: 1, borderColor: glowA(0.35), borderTopColor: 'rgba(255,255,255,0.3)' };
/** A page's content on a wide screen (the website): a centred column, like Settings. Phones are narrower, so it changes nothing there. */
export const pageColumn = { alignSelf: 'center', width: '100%', maxWidth: 640 } as const;
/** A fixed colour token (amber, coral) at an opacity. */
export const tintA = (hex: string, alpha: number) => rgbaOf(hex, alpha);

/** White glass leaning 15% toward the theme's glow, at an opacity: Aurora's cards hold a little green, Lava's a little warmth. */
function glassOf(alpha: number): string {
  const n = parseInt(palette.glow.slice(1, 7), 16);
  const lean = (c: number) => Math.round(255 + (c - 255) * 0.15);
  return `rgba(${lean((n >> 16) & 255)},${lean((n >> 8) & 255)},${lean(n & 255)},${alpha})`;
}

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
