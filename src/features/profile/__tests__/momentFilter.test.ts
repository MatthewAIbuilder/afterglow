import { describe, expect, it } from '@jest/globals';
import type { Memory } from '../../memories/models';
import { applyMomentFilter, artistChoices, placeChoices } from '../momentFilter';

const m = (id: string, over: Partial<Memory>): Memory => ({ id, file: `${id}.mov`, capturedAt: `2026-0${id.length}-01T00:00:00.000Z`, addedAt: '', ...over });
const names: Record<string, string> = { a: 'BOOGIE T', b: 'SUBTRONICS', edc: 'EDC Orlando' };
const lookup = { artist: (id: string) => (names[id] ? ({ id, name: names[id] } as never) : undefined), festival: (id: string) => (names[id] ? ({ id, name: names[id] } as never) : undefined) };

describe('quick filters for Moments', () => {
  const list = [
    m('1', { artistId: 'a', festivalId: 'edc' }),
    m('22', { artistId: 'a', withArtistIds: ['b'], show: { name: 'Echostage', date: '2026-01-18' } }),
    m('333', { artistId: 'b', past: { name: 'EDC Orlando', year: 2024 } }),
    m('4444', {}),
  ];

  it('lists the artists (b2b partners count) and places in your videos, most first', () => {
    expect(artistChoices(list, lookup)).toEqual([
      { key: 'b', label: 'SUBTRONICS', count: 2 },
      { key: 'a', label: 'BOOGIE T', count: 2 },
    ]);
    expect(placeChoices(list, lookup).map((c) => c.label).sort()).toEqual(['EDC Orlando', 'EDC Orlando 2024', 'Echostage']);
  });

  it('shows one artist, one place, everything, or the videos you’re tagged in', () => {
    expect(applyMomentFilter(list, [], { kind: 'artist', id: 'b' }).map((x) => x.id)).toEqual(['333', '22']);
    expect(applyMomentFilter(list, [], { kind: 'place', key: 'edc' }).map((x) => x.id)).toEqual(['1']);
    expect(applyMomentFilter(list, [], { kind: 'all' })).toHaveLength(4);
    expect(applyMomentFilter(list, [], { kind: 'artist' })).toHaveLength(4);
    expect(applyMomentFilter(list, [m('9', {})], { kind: 'tagged' }).map((x) => x.id)).toEqual(['9']);
  });
});
