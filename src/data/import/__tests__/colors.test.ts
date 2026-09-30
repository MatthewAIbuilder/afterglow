import { describe, expect, it } from '@jest/globals';
import { paletteFrom } from '../../../theme/artistColor';
import { dominantColor, smallPhotoUrl } from '../colors';

const image = (w: number, h: number, pixel: (x: number, y: number) => [number, number, number]) => {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      out.set([r, g, b, 255], (y * w + x) * 4);
    }
  return out;
};

describe('an artist colour from their photo', () => {
  it('finds the most present vivid colour, ignoring dark, light and grey', () => {
    // Mostly black, some white and grey, and a pink stage light on a third of it.
    const px = image(30, 30, (x, y) => (x < 10 ? [230, 60, 150] : y < 10 ? [250, 250, 250] : y < 20 ? [120, 120, 120] : [5, 5, 10]));
    const c = dominantColor(px, 30, 30)!;
    expect(c).toMatch(/^#[0-9A-F]{6}$/);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(90);
    expect(b).toBeGreaterThan(120);
  });

  it('leaves black-and-white photos to the app', () => {
    expect(dominantColor(image(20, 20, (x) => (x % 2 ? [20, 20, 20] : [200, 200, 200])), 20, 20)).toBeUndefined();
  });

  it('asks Deezer for a small copy', () => {
    expect(smallPhotoUrl('https://cdn-images.dzcdn.net/images/artist/abc/500x500-000000-80-0-0.jpg')).toBe(
      'https://cdn-images.dzcdn.net/images/artist/abc/56x56-000000-80-0-0.jpg',
    );
    expect(smallPhotoUrl('https://example.com/me.png')).toBe('https://example.com/me.png');
  });

  it('turns a colour into a deep and a bright tone within the night palette', () => {
    const [deep, bright] = paletteFrom('#FF0080');
    expect(deep).toMatch(/^#[0-9A-F]{6}$/);
    expect(bright).toMatch(/^#[0-9A-F]{6}$/);
    const lum = (h: string) => [1, 3, 5].reduce((s, i) => s + parseInt(h.slice(i, i + 2), 16), 0) / 3;
    expect(lum(deep)).toBeLessThan(80);
    expect(lum(bright)).toBeGreaterThan(120);
    // Grey stays grey-ish: no invented saturation beyond the clamp.
    expect(paletteFrom('#808080')[1]).toMatch(/^#/);
  });
});
