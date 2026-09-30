import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import { artistShareText, festivalShareText } from '../pages';

const f = (id: string, name: string, lineup: string[] = ['a', 'b']) => ({ id, name, dates: 'Dec 4 to 6', location: 'Boca Raton', lineup, days: [], stages: [] }) as unknown as Festival;
const a = { id: 'subtronics', name: 'SUBTRONICS', sound: {} } as Artist;
const W = 'https://afterglowmusic.app';

describe('sharing pages', () => {
  it('a festival: name, when and where, the lineup, the link', () => {
    expect(festivalShareText(f('cyclops-cove-4', 'Cyclops Cove 4'), W)).toBe(
      'Cyclops Cove 4, Dec 4 to 6, Boca Raton\n2 acts on the lineup. Find your sets on Afterglow:\nhttps://afterglowmusic.app/festival/cyclops-cove-4',
    );
    expect(festivalShareText(f('x', 'X', []), W)).toContain('On Afterglow:');
  });

  it('an artist: where they play, the link', () => {
    expect(artistShareText(a, [f('c', 'Cyclops Cove 4'), f('n', 'Countdown NYE 2026')], W)).toBe(
      'SUBTRONICS on Afterglow\nPlaying Cyclops Cove 4 and Countdown NYE 2026\nhttps://afterglowmusic.app/artist/subtronics',
    );
    expect(artistShareText(a, [f('1', 'A'), f('2', 'B'), f('3', 'C')], W)).toContain('Playing A, B and 1 more');
    expect(artistShareText(a, [], W)).toBe('SUBTRONICS on Afterglow\nhttps://afterglowmusic.app/artist/subtronics');
  });
});
