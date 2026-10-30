import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import { hasYear, yearCard, yearStats, yearText, type YearInput } from '../year';

const artist = (id: string): Artist => ({ id, name: id.toUpperCase(), sound: {} });
const fest = (id: string, start: string, end = start): Festival => ({ id, name: `Fest ${id}`, dates: `${start}`, location: '', lineup: [], days: [], stages: [], startDate: start, endDate: end });
const artists: Record<string, Artist> = { a: artist('a'), b: artist('b'), c: artist('c'), d: artist('d') };

const base: YearInput = {
  year: 2026,
  festivals: [fest('spring', '2026-03-10'), fest('winter', '2026-12-04', '2026-12-06'), fest('old', '2025-06-01'), fest('next', '2027-02-01')],
  going: ['spring', 'winter', 'old', 'next'],
  memories: [
    { capturedAt: '2026-03-10T23:00:00Z', festivalId: 'spring', artistId: 'b' },
    { capturedAt: '2026-03-11T00:30:00Z', festivalId: 'spring', artistId: 'b' },
    { capturedAt: '2025-06-01T22:00:00Z', artistId: 'c' },
  ],
  seen: { x: new Date(2026, 4, 1).getTime(), y: new Date(2026, 7, 1).getTime(), z: new Date(2025, 11, 31).getTime() },
  ratings: { a: 'love', d: 'pass', c: 'like' },
  taste: { a: 0.9, b: 0.6, c: 0.72, d: 0.1 },
  informed: { a: true, b: true, c: true, d: true },
  sounds: [
    { tag: 'dubstep', share: 0.6, percent: 60 },
    { tag: 'house', share: 0.4, percent: 40 },
  ],
  artist: (id) => artists[id],
  today: new Date(2026, 9, 1),
};

describe('your year', () => {
  it('counts only this year: festivals been and to come, videos, clips watched', () => {
    const s = yearStats(base);
    expect(s.been.map((f) => f.id)).toEqual(['spring']);
    expect(s.coming.map((f) => f.id)).toEqual(['winter']);
    expect(s.videos).toBe(2);
    expect(s.clips).toBe(2);
    expect(s.loved).toBe(2);
    expect(s.rated).toBe(3);
    // Filmed most first, then loved; a pass never makes it.
    expect(s.top.map((t) => t.artist.id)).toEqual(['b', 'a', 'c']);
    expect(s.top[0].videos).toBe(2);
  });

  it('makes a card to share, "so far" until December', () => {
    const card = yearCard(base)!;
    expect(card.title).toBe('Your 2026');
    expect(card.subtitle).toBe('Your festival year so far');
    expect(card.sections.map((s) => s.heading)).toEqual(['Festivals', 'Still to come', 'Your top artists', 'Your sound', 'By the numbers']);
    expect(card.sections[2].lines[0]).toMatchObject({ name: 'B', where: '2 videos' });
    expect(yearCard({ ...base, today: new Date(2026, 11, 20) })!.subtitle).toBe('Your festival year');
    const text = yearText(card);
    expect(text.split('\n')[0]).toBe('My 2026 on Afterglow');
    expect(text).toContain('Live clips watched, 2');
  });

  it('has nothing for an empty year', () => {
    const empty = { ...base, going: [], memories: [], seen: {}, ratings: {} };
    expect(hasYear(yearStats(empty))).toBe(false);
    expect(yearCard(empty)).toBeUndefined();
  });

  it('Wrapped: the sets you saw, who you saw most, your set of the year, how far you walked', () => {
    const at = (m: number, d: number) => new Date(2026, m, d, 23).getTime();
    const s = yearStats({
      ...base,
      setsSeen: [
        { festivalId: 'spring', artistId: 'a', at: at(2, 10), verdict: 'great' },
        { festivalId: 'winter', artistId: 'a', at: at(11, 4), verdict: 'unreal' },
        { festivalId: 'winter', artistId: 'b', at: at(11, 5) },
        { festivalId: 'old', artistId: 'c', at: new Date(2025, 5, 1).getTime(), verdict: 'unreal' },
      ],
      walked: { spring: 6200, winter: 9100, old: 50000 },
      miles: false,
      fits: [at(2, 10), at(11, 4), new Date(2025, 5, 1).getTime()],
    });
    expect(s.sets).toBe(3);
    expect(s.seenMost.map((x) => [x.artist.id, x.times])).toEqual([['a', 2]]);
    expect(s.setOfYear).toEqual(expect.objectContaining({ verdict: 'unreal', festival: expect.objectContaining({ id: 'winter' }) }));
    expect(s.setOfYear?.artist.id).toBe('a');
    expect(s.walkedMeters).toBe(15300);
    expect(s.fits).toBe(2);
    const card = yearCard({ ...base, setsSeen: [{ festivalId: 'winter', artistId: 'a', at: at(11, 4), verdict: 'unreal' }], walked: { winter: 9100 }, miles: false })!;
    expect(card.sections.map((x) => x.heading)).toContain('Your set of the year');
    expect(card.sections.find((x) => x.heading === 'By the numbers')!.lines.map((l) => l.name)).toEqual(expect.arrayContaining(['Sets you saw', 'Walked']));
  });
});
