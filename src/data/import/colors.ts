/**
 * An artist's colour from their photo, for the nightly colour job
 * (scripts/artist-colors.ts). Pure: it takes the photo's pixels (a small
 * copy, red-green-blue-alpha) and returns the most present vivid colour, as
 * "#RRGGBB"; undefined for a black-and-white or washed-out photo, which keeps
 * the app's own colours.
 */
const BINS = 24;

export function dominantColor(rgba: ArrayLike<number>, width: number, height: number): string | undefined {
  const weight = new Array<number>(BINS).fill(0);
  const sum = Array.from({ length: BINS }, () => [0, 0, 0]);
  const pixels = width * height;
  for (let p = 0; p < pixels; p++) {
    const r = rgba[p * 4] / 255;
    const g = rgba[p * 4 + 1] / 255;
    const b = rgba[p * 4 + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0 || l < 0.12 || l > 0.88) continue;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (s < 0.18) continue;
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    const bin = Math.min(BINS - 1, Math.floor((h / 6) * BINS));
    // Vivid, mid-light pixels say the most about a photo's colour.
    const w = s * (1 - Math.abs(l - 0.5) * 1.4);
    weight[bin] += w;
    sum[bin][0] += r * w;
    sum[bin][1] += g * w;
    sum[bin][2] += b * w;
  }
  let best = 0;
  for (let i = 1; i < BINS; i++) if (weight[i] > weight[best]) best = i;
  // Too little colour anywhere (under 4% of the photo's worth): leave it to the app.
  if (weight[best] < pixels * 0.04) return undefined;
  const hex = sum[best].map((c) => Math.round((c / weight[best]) * 255).toString(16).padStart(2, '0')).join('');
  return `#${hex}`.toUpperCase();
}

/** A small copy of a Deezer photo (their links carry the size), or the link as it is. */
export const smallPhotoUrl = (url: string) => url.replace(/\/\d+x\d+-(\d{6}-\d+-\d+-\d+\.jpg)$/, '/56x56-$1');
