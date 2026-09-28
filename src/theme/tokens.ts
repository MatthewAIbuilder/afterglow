import { Platform } from 'react-native';

/**
 * Design tokens. Every screen pulls from here so the look stays consistent
 * and can be retuned in one place.
 *
 * Direction: festival glow at night. A deep violet-ink sky, moonlight text,
 * one purple glow used sparingly for "this matters" moments.
 */
export const color = {
  night: '#0A0918', // app background
  nightRaised: '#121026', // sheets, raised surfaces (under blur)
  glass: 'rgba(255,255,255,0.06)',
  hairline: 'rgba(255,255,255,0.10)',

  moon: '#F3F0FF', // primary text
  moonDim: 'rgba(243,240,255,0.62)', // secondary text
  moonFaint: 'rgba(243,240,255,0.36)', // tertiary text, region labels

  glow: '#A97CFF', // the accent: matches, active states
  glowDeep: '#6B3FE0',
  haze: '#3A2380', // large background light
  dusk: '#1C2A6B', // cool counter-light
  stage: '#FF7AC6', // warm stage light, background only, very faint
} as const;

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
