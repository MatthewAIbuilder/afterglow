import type { SoundTag } from '../../data/models';

/**
 * Each sound's own light on My Sound: the nebula behind its artists, its
 * name around the map, its slice of your spectrum. Night colours, never neon:
 * melodic bass keeps the app's purple, and its neighbours on the ring sit
 * next to it in colour too. Pure.
 */
export const SOUND_COLOR: Record<SoundTag, string> = {
  'melodic-bass': '#A97CFF',
  dubstep: '#5B8CFF',
  riddim: '#3FC8C0',
  trap: '#FF5F8F',
  'hip-hop': '#FFC861',
  techno: '#8FA6D6',
  indie: '#7FD8A4',
  house: '#FFA86B',
  pop: '#FF85C8',
  rock: '#FF7A5C',
};

/** No sound known: the app's own glow. */
export const NO_SOUND_COLOR = '#A97CFF';

const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** The light of a sound mix: the sounds' colours blended by weight ("#RRGGBB"). */
export function mixColor(sound: Partial<Record<SoundTag, number>>): string {
  let total = 0;
  const sum = [0, 0, 0];
  for (const [tag, w] of Object.entries(sound) as [SoundTag, number][]) {
    if (!(w > 0) || !SOUND_COLOR[tag]) continue;
    const rgb = toRgb(SOUND_COLOR[tag]);
    // Squared weights: the main sound leads, so a blend never turns muddy grey.
    const k = w * w;
    total += k;
    sum.forEach((_, i) => (sum[i] += rgb[i] * k));
  }
  return total ? toHex(sum.map((v) => v / total)) : NO_SOUND_COLOR;
}

/** "#RRGGBB" with an alpha, as rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
