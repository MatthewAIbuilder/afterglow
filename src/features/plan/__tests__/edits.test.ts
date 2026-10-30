import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival, SetTime } from '../../../data/types';
import { bringAllBack, bringBack, cleanEdits, editsAt, goWith, NO_EDITS, setOwn, takeOut } from '../edits';
import { buildSchedule, rankLineup } from '../plan';
import { dayRoute, type RouteStop } from '../route';

const artist = (id: string): Artist => ({ id, name: id.toUpperCase(), sound: {} });
const set = (artistId: string, start: string, end: string, stageId = 'main'): SetTime => ({ artistId, day: 'Friday', stageId, start, end });
const festival = (sets: SetTime[]): Festival => ({
  id: 'f',
  name: 'F',
  dates: '',
  location: '',
  lineup: [...new Set(sets.map((s) => s.artistId))],
  days: ['Friday'],
  stages: [
    { id: 'main', name: 'Main' },
    { id: 'tent', name: 'Tent' },
  ],
  sets,
});
const ids = (stops: ReturnType<typeof dayRoute>['stops']) => stops.flatMap((s) => (s.kind === 'set' ? [s.artist.id] : []));

describe('your own changes to a plan', () => {
  it('takes acts out, brings them back, and keeps each festival apart', () => {
    let all = takeOut({}, 'f', 'a');
    all = takeOut(all, 'f', 'b');
    all = takeOut(all, 'g', 'a');
    expect([...editsAt(all, 'f').out]).toEqual(['a', 'b']);
    all = bringBack(all, 'f', 'a');
    expect([...editsAt(all, 'f').out]).toEqual(['b']);
    all = bringAllBack(all, 'f');
    // Nothing left for f: no empty record kept.
    expect(all).toEqual({ g: { out: ['a'] } });
    expect(editsAt({}, 'f')).toBe(NO_EDITS);
  });

  it('goes with one set over what it clashes with, and back in if it was out', () => {
    let all = goWith({}, 'f', 'a', ['b']);
    all = goWith(all, 'f', 'b', ['a']);
    expect([...editsAt(all, 'f').first]).toEqual(['b']);
    all = takeOut(all, 'f', 'c');
    all = goWith(all, 'f', 'c');
    expect(editsAt(all, 'f').out.size).toBe(0);
    // Taking a first choice out drops it as a first choice too.
    all = takeOut(all, 'f', 'b');
    expect([...editsAt(all, 'f').first]).toEqual(['c']);
    expect(editsAt(setOwn(all, 'f', true), 'f').own).toBe(true);
    expect(editsAt(setOwn(setOwn(all, 'f', true), 'f', false), 'f').own).toBe(false);
  });

  it('reads back stored edits whatever their shape', () => {
    expect(cleanEdits(null)).toEqual({});
    expect(cleanEdits({ f: { out: ['a', 'a', 3], first: ['a', 'b'], own: true }, g: 'x', h: {} })).toEqual({ f: { out: ['a'], first: ['b'], own: true } });
  });
});

describe('the plan and the route follow your changes', () => {
  const f = festival([set('a', '20:00', '21:00'), set('b', '21:00', '22:00'), set('c', '21:00', '22:00', 'tent'), set('d', '22:00', '23:00')]);
  const taste = { a: 0.95, b: 0.9, c: 0.8, d: 0.85 };
  const informed = { a: true, b: true, c: true, d: true };
  const base = { festival: f, artists: f.lineup.map(artist), taste, informed };

  it('leaves out what you took out', () => {
    const edits = editsAt(takeOut({}, 'f', 'a'), 'f');
    expect(ids(dayRoute({ ...base, edits }, 'Friday').stops)).not.toContain('a');
    expect(rankLineup({ ...base, edits }).map((p) => p.artist.id)).not.toContain('a');
  });

  it('goes with your first choice even over another star', () => {
    const pinned = new Set(['b', 'c']);
    // Two stars at 21:00: the route keeps the better match…
    expect(ids(dayRoute({ ...base, pinned }, 'Friday').stops)).toContain('b');
    // …until you go with the other one.
    const edits = editsAt(goWith({}, 'f', 'c', ['b']), 'f');
    const route = dayRoute({ ...base, pinned, edits }, 'Friday');
    expect(ids(route.stops)).toContain('c');
    expect(ids(route.stops)).not.toContain('b');
    expect((route.stops.find((s) => s.kind === 'set' && s.artist.id === 'c') as RouteStop).first).toBe(true);
    // The clash on Your picks is called for it too.
    const clash = buildSchedule(f, rankLineup({ ...base, pinned, edits })).days[0].items.find((i) => i.kind === 'clash');
    expect(clash?.kind === 'clash' && clash.verdict.kind === 'pinned' && clash.verdict.pick.artist.id).toBe('c');
  });

  it('with only your picks, holds just your stars', () => {
    const edits = editsAt(setOwn({}, 'f', true), 'f');
    const pinned = new Set(['d']);
    expect(ids(dayRoute({ ...base, pinned, edits }, 'Friday').stops)).toEqual(['d']);
    expect(rankLineup({ ...base, pinned, edits }).map((p) => p.artist.id)).toEqual(['d']);
  });
});
