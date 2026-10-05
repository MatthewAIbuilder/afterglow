/** Mask stops for FadeMask: clear outside `top`..`bottom`, solid between. Pure. */
export function fadeStops(top: number, bottom: number): { colors: [string, string, ...string[]]; locations: [number, number, ...number[]] } {
  const t = Math.max(0, Math.min(1, top));
  const b = Math.max(t, Math.min(1, bottom));
  return {
    colors: [t > 0 ? 'transparent' : '#000', '#000', '#000', b < 1 ? 'transparent' : '#000'],
    locations: [0, t, b, 1],
  };
}

/** The same fade as a CSS mask-image. */
export function fadeCss(top: number, bottom: number): string {
  const { colors, locations } = fadeStops(top, bottom);
  return `linear-gradient(to bottom, ${colors.map((c, i) => `${c} ${Math.round(locations[i] * 1000) / 10}%`).join(', ')})`;
}
