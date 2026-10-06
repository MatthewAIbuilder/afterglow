import { describe, expect, it } from '@jest/globals';
import type { Show } from '../../../data/models';
import { publishedChanged } from '../../social/publish';
import { cleanGoingShows, publishedShows, splitShows, withGoingShow } from '../goingShows';

const show = (id: string, date: string): Show => ({ id, date, venue: `Club ${id}`, location: 'Denver, CO', link: 'https://edmtrain.com/x', artistIds: ['a'] });

describe('going to one-night shows', () => {
  it('keeps a copy of each show, once, and lets it go again', () => {
    let list = withGoingShow([], show('edm-1', '2026-11-01'), true);
    list = withGoingShow(list, show('edm-2', '2026-10-01'), true);
    list = withGoingShow(list, show('edm-1', '2026-11-01'), true);
    expect(list.map((s) => s.id)).toEqual(['edm-1', 'edm-2']);
    expect(list[0]).toEqual({ id: 'edm-1', date: '2026-11-01', title: 'Club edm-1', where: 'Denver, CO', artistIds: ['a'] });
    expect(withGoingShow(list, show('edm-1', '2026-11-01'), false).map((s) => s.id)).toEqual(['edm-2']);
  });

  it('splits coming up from passed, and publishes only what’s coming up', () => {
    const list = [show('a', '2026-10-01'), show('b', '2026-10-06'), show('c', '2026-12-01')].reduce((l, s) => withGoingShow(l, s, true), [] as ReturnType<typeof withGoingShow>);
    const { upcoming, past } = splitShows(list, '2026-10-06');
    expect(upcoming.map((s) => s.id)).toEqual(['b', 'c']);
    expect(past.map((s) => s.id)).toEqual(['a']);
    expect(publishedShows(list, '2026-10-06')).toEqual(['b', 'c']);
  });

  it('reads back safely, and a changed list updates a profile that shows its festivals', () => {
    expect(cleanGoingShows([{ id: 'edm-1', date: '2026-11-01', title: 'X', where: 'Y', artistIds: ['a', 3] }, { id: '../x', date: '2026-11-01' }, 'junk'])).toEqual([
      { id: 'edm-1', date: '2026-11-01', title: 'X', where: 'Y', artistIds: ['a'] },
    ]);
    const profile = { showFestivals: true, festivals: [], sounds: [], artists: [], shows: ['a'] } as never;
    expect(publishedChanged(profile, [], [], undefined, ['a'])).toBe(false);
    expect(publishedChanged(profile, [], [], undefined, ['a', 'b'])).toBe(true);
    expect(publishedChanged({ ...(profile as object), showFestivals: false } as never, [], [], undefined, ['a', 'b'])).toBe(false);
  });
});
