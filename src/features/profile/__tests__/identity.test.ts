import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import type { Memory } from '../../memories/models';
import { currentlyFeeling, favouriteArtists, feelingLine, filmedOrbit, orbitPlaces } from '../identity';
import { milestones, nextMilestone, progressLine } from '../milestones';
import { citiesOf, passport, stampLine } from '../passport';

const artist = (id: string, sound: Artist['sound'] = {}): Artist => ({ id, name: id.toUpperCase(), sound }) as Artist;
const fest = (id: string, start: string, end: string, location = 'Somewhere, Orlando'): Festival =>
  ({ id, name: id, dates: '', location, lineup: ['a', 'b', 'c'], days: [], stages: [], startDate: start, endDate: end }) as unknown as Festival;
const memory = (id: string, festivalId: string, artistId: string, capturedAt: string): Memory => ({ id, file: `${id}.mov`, capturedAt, addedAt: capturedAt, festivalId, artistId });

describe('your artists', () => {
  const artists = [artist('a'), artist('b'), artist('c'), artist('d'), artist('e')];
  it('puts loved first, then liked, followed and strong matches, never anyone you turned down', () => {
    const favs = favouriteArtists({
      artists,
      taste: { a: 0.5, b: 0.9, c: 0.95, d: 0.8, e: 0.99 },
      informed: { a: true, b: true, c: true, d: true, e: true },
      ratings: { a: 'love', b: 'like', e: 'pass' },
      followed: ['d'],
    });
    expect(favs.map((f) => [f.artist.id, f.why])).toEqual([
      ['a', 'love'],
      ['b', 'like'],
      ['d', 'follow'],
      ['c', 'match'],
    ]);
  });

  it('places the orbit round the photo, biggest first', () => {
    const places = orbitPlaces(4, 100, 50);
    expect(places).toHaveLength(4);
    expect(places[0].size).toBeGreaterThan(places[3].size);
    for (const p of places) expect(Math.abs(p.x)).toBeLessThanOrEqual(100);
  });
});

describe('currently feeling', () => {
  const now = Date.UTC(2026, 9, 10);
  const day = 86_400_000;
  const byClip: Record<string, Artist> = { c1: artist('x', { dubstep: 1 }), c2: artist('y', { dubstep: 0.6, riddim: 0.4 }), c3: artist('z', { house: 1 }) };
  it('reads the last week of clips you enjoyed', () => {
    const feel = currentlyFeeling({
      seen: { c1: now - day, c2: now - 2 * day, c3: now - 10 * day },
      reactions: { c1: { liked: true }, c2: { watched: 'through' }, c3: { saved: true } },
      artistOfClip: (id) => byClip[id],
      now,
    });
    expect(feel?.tag).toBe('dubstep');
    expect(feelingLine('melodic-bass')).toBe('Currently feeling melodic bass');
  });
  it('says nothing with fewer than two, or when you skipped them', () => {
    expect(currentlyFeeling({ seen: { c1: now }, reactions: { c1: { liked: true } }, artistOfClip: (id) => byClip[id], now })).toBeUndefined();
    expect(
      currentlyFeeling({ seen: { c1: now, c3: now }, reactions: { c1: { liked: true }, c3: { liked: true, skipped: true } }, artistOfClip: (id) => byClip[id], now }),
    ).toBeUndefined();
  });
});

describe('festival passport', () => {
  const today = new Date(2026, 9, 10);
  const past = fest('past', '2026-03-01', '2026-03-02', 'Arena, Miami');
  const filmed = fest('filmed', '2026-05-01', '2026-05-02', 'Park, Austin');
  const soon = fest('soon', '2026-12-04', '2026-12-06', 'Cove, Boca Raton');
  const later = fest('later', '2027-02-01', '2027-02-02');
  const all = [past, filmed, soon, later];

  it('splits been there (over and going, or filmed there on the dates) from planning', () => {
    const p = passport({
      festivals: all,
      going: ['past', 'soon', 'later'],
      memories: [memory('m1', 'filmed', 'a', '2026-05-01T22:00:00'), memory('m2', 'filmed', 'a', '2026-05-02T23:00:00'), memory('m3', 'filmed', 'b', '2026-04-01T22:00:00')],
      badges: [],
      loves: (id) => id === 'a' || id === 'b',
      today,
    });
    expect(p.planning.map((s) => s.festival.id)).toEqual(['soon', 'later']);
    expect(p.been.map((s) => s.festival.id)).toEqual(['filmed', 'past']);
    const f = p.been[0];
    expect(f).toMatchObject({ moments: 3, filmed: ['a', 'b'], badge: true });
    expect(stampLine(f)).toBe('3 moments · 2 artists filmed');
    expect(stampLine(p.planning[0], 'In 2 months')).toBe('In 2 months · 2 you’d love');
    expect(citiesOf([...p.been, ...p.planning])).toBe(4);
  });
});

describe('milestones', () => {
  it('earns what you have done, shows progress on the rest, and picks the next one', () => {
    const list = milestones({ been: 1, cities: 2, moments: 0, kept: 20, rated: 5, bass: 0 });
    expect(list[0]).toMatchObject({ id: 'first-festival', earned: true });
    expect(list.some((m) => m.id === 'og')).toBe(false);
    const next = nextMilestone(list)!;
    expect(next.id).toBe('collector');
    expect(progressLine(next)).toBe('20 of 25');
    expect(milestones({ been: 0, cities: 0, moments: 0, kept: 0, rated: 0, bass: 0, founder: 23 })[0]).toMatchObject({ id: 'og', earned: true, how: 'One of the first 100 · #23' });
  });

  it('sprouts earn their own: one in bloom, 10 given, all 7 kinds', () => {
    const list = milestones({ been: 0, cities: 0, moments: 0, kept: 0, rated: 0, bass: 0, bloomed: 1, given: 4, kinds: 8 });
    const by = (id: string) => list.find((m) => m.id === id)!;
    expect(by('green').earned).toBe(true);
    expect(by('gardener').earned).toBe(true);
    expect(progressLine(by('giver'))).toBe('4 of 10');
  });
});

describe('someone else’s orbit', () => {
  it('is the artists in the videos they shared, most filmed first, each once, known artists only', () => {
    const known = new Map<string, Artist>(['a', 'b', 'c'].map((id) => [id, { id, name: id.toUpperCase(), sound: {} } as Artist]));
    const of = (id: string) => known.get(id);
    const orbit = filmedOrbit(['a', 'b', 'b', undefined, 'zz', 'c', 'b', 'c'], of);
    expect(orbit.map((o) => o.artist.name)).toEqual(['B', 'C', 'A']);
    expect(filmedOrbit(['a', 'b', 'c'], of, 2)).toHaveLength(2);
    expect(filmedOrbit([], of)).toEqual([]);
  });
});
