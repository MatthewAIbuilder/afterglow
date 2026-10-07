import { describe, expect, it } from '@jest/globals';
import { cardFrom, cardLink } from '../cards';
import { growthOf } from '../sprouts';
import { artistLook, shinyFor, shinyLook } from '../artistLook';
import { cleanPublicGarden, gardenKey, publicGarden } from '../publicGarden';

describe('shared collectible cards', () => {
  it('a link carries the card as its owner has it, and reads back', () => {
    const c = { artistId: 'subtronics', handle: 'matt.raves', tier: 3 as const, videos: 12, shiny: true };
    const link = cardLink(c);
    expect(link).toBe('https://afterglowmusic.app/card/subtronics?h=matt.raves&t=3&v=12&s=1');
    const q = Object.fromEntries(new URL(link).searchParams.entries());
    expect(cardFrom({ id: 'subtronics', ...q })).toEqual(c);
  });
  it('tidies up anything odd', () => {
    expect(cardFrom({ id: '../x' })).toBeUndefined();
    expect(cardFrom({ id: 'rezz', h: 'Not OK!', t: '9', v: '-3' })).toEqual({ artistId: 'rezz', handle: '', tier: 0, videos: 0, shiny: false });
  });
});

describe('shiny collectibles', () => {
  it('about one in twelve, decided by account and artist, the same every time', () => {
    const ids = Array.from({ length: 1200 }, (_, i) => `artist-${i}`);
    const shiny = ids.filter((id) => shinyFor('uid-abc', id)).length;
    expect(shiny).toBeGreaterThan(60);
    expect(shiny).toBeLessThan(150);
    expect(ids.map((id) => shinyFor('uid-abc', id))).toEqual(ids.map((id) => shinyFor('uid-abc', id)));
    // Someone else's luck is their own.
    expect(ids.filter((id) => shinyFor('uid-xyz', id))).not.toEqual(ids.filter((id) => shinyFor('uid-abc', id)));
  });
  it('a shiny one is the same creature in other colours', () => {
    const look = artistLook({ id: 'rezz', name: 'REZZ', sound: {} } as never);
    const shiny = shinyLook(look);
    expect(shiny.creature).toBe(look.creature);
    expect(shiny.palette.mid).not.toBe(look.palette.mid);
    expect(shiny.palette.mid).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('shows on a garden visitors see', () => {
    const list = publicGarden([], [{ artistId: 'rezz', videos: 2, tier: 0, firstAt: 0, lastAt: 0, shiny: true }], () => 'REZZ');
    expect(list).toEqual([{ k: 'a', artistId: 'rezz', name: 'REZZ', tier: 0, shiny: true }]);
    expect(cleanPublicGarden(list)).toEqual(list);
    expect(gardenKey(list)).not.toBe(gardenKey([{ k: 'a', artistId: 'rezz', name: 'REZZ', tier: 0 }]));
  });
});

describe('the Moonlight sprout', () => {
  it('grows from watching sets after midnight', () => {
    const night = (h: number, i: number) => new Date(2026, 9, 10 + i, h, 30).getTime();
    const watched = Array.from({ length: 40 }, (_, i) => ({ at: night(i % 4 === 0 ? 23 : 2, i % 20), sound: 'dubstep' }));
    const g = growthOf({ watched, filmed: [], gave: [], festivalDays: [] }, new Date(2026, 9, 1).getTime(), new Date(2026, 10, 1).getTime());
    expect(g.leaning).toBe('moonlight');
    const day = watched.map((w) => ({ ...w, at: w.at + 12 * 3600_000 }));
    expect(growthOf({ watched: day, filmed: [], gave: [], festivalDays: [] }, new Date(2026, 9, 1).getTime(), new Date(2026, 10, 2).getTime()).leaning).toBe('bass');
  });
});
