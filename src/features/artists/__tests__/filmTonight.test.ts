import { describe, expect, it } from '@jest/globals';
import type { Show } from '../../../data/models';
import { filmParams, filmTonight } from '../filmTonight';

const show = (id: string, date: string): Show => ({ id, date, venue: 'The Criterion', location: 'Oklahoma City, OK', link: 'https://example.com/show', artistIds: ['levity'] });

describe('film the set', () => {
  it('shows on the night of one of their shows, with that show', () => {
    const tonight = show('edm-1', '2026-10-09');
    expect(filmTonight([tonight, show('edm-2', '2026-10-20')], '2026-10-09', false)).toEqual({ show: tonight });
  });

  it('shows without a show when opened from a printed code', () => {
    expect(filmTonight([show('edm-2', '2026-10-20')], '2026-10-09', true)).toEqual({});
  });

  it('stays away otherwise', () => {
    expect(filmTonight([show('edm-2', '2026-10-20')], '2026-10-09', false)).toBeUndefined();
    expect(filmTonight([], '2026-10-09', false)).toBeUndefined();
  });

  it('opens the camera on them, with the show when there is one', () => {
    expect(filmParams('levity', { show: show('edm-1', '2026-10-09') })).toEqual({ artist: 'levity', show: 'edm-1' });
    expect(filmParams('levity', {})).toEqual({ artist: 'levity' });
  });
});
