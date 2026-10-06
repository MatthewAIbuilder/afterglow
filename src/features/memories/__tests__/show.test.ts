import { describe, expect, it } from '@jest/globals';
import type { Show } from '../../../data/models';
import { cleanShow, localDay, showKey, showLabel, showsAround, showsOf, showTagOf } from '../show';

const show = (over: Partial<Show>): Show => ({ id: 'edm-1', date: '2026-01-18', venue: 'Echostage', location: 'Washington, DC', link: 'https://edmtrain.com/x', artistIds: ['slander'], ...over });
const names: Record<string, string> = { slander: 'SLANDER', subtronics: 'SUBTRONICS' };
const artistName = (id: string) => names[id];

describe('one-night shows on a video', () => {
  it('a show from Afterglow becomes a tag: its name or venue, day, town and id', () => {
    expect(showTagOf(show({}))).toEqual({ name: 'Echostage', date: '2026-01-18', city: 'Washington', showId: 'edm-1' });
    expect(showTagOf(show({ name: 'Gud Vibrations' }))).toMatchObject({ name: 'Gud Vibrations' });
  });

  it('labels and keys: the town only when the name doesn’t say it, the same night is the same key', () => {
    expect(showLabel({ name: 'Echostage', city: 'Washington' })).toBe('Echostage, Washington');
    expect(showLabel({ name: 'Brooklyn Mirage', city: 'Brooklyn' })).toBe('Brooklyn Mirage');
    expect(showKey({ name: 'Echo Stage', date: '2026-01-18' })).toBe(showKey({ name: 'echo  stage', date: '2026-01-18' }));
    expect(showKey({ name: 'Echostage', date: '2026-01-18', showId: 'edm-1' })).toBe('edm-1');
  });

  it('shows within a day of the video, the picked artist’s first, and a search over name, venue, town and bill', () => {
    const list = [
      show({ id: 'a', date: '2026-01-17', venue: 'Avant Gardner', location: 'Brooklyn, NY', artistIds: ['subtronics'] }),
      show({ id: 'b', date: '2026-01-18' }),
      show({ id: 'c', date: '2026-01-25' }),
    ];
    const at = new Date(2026, 0, 18, 23, 30).toISOString();
    expect(showsAround(list, { capturedAt: at, artistName }).map((s) => s.id)).toEqual(['b', 'a']);
    expect(showsAround(list, { capturedAt: at, artistId: 'subtronics', artistName }).map((s) => s.id)).toEqual(['a', 'b']);
    expect(showsAround(list, { capturedAt: at, query: 'slander', artistName }).map((s) => s.id)).toEqual(['b']);
    expect(showsAround(list, { capturedAt: at, query: 'brooklyn', artistName }).map((s) => s.id)).toEqual(['a']);
  });

  it('read back safely: a name and a day, or nothing', () => {
    expect(cleanShow({ name: '  Echostage ', date: '2026-01-18', city: 'Washington', showId: 'edm-1' })).toEqual({ name: 'Echostage', date: '2026-01-18', city: 'Washington', showId: 'edm-1' });
    expect(cleanShow({ name: 'Echostage', date: 'Jan 18' })).toBeUndefined();
    expect(cleanShow({ date: '2026-01-18' })).toBeUndefined();
    expect(cleanShow({ name: 'x', date: '2026-01-18', showId: '../evil' })).toEqual({ name: 'x', date: '2026-01-18' });
  });

  it('your shows, each once, newest first; the local day of a time', () => {
    const a = { name: 'Echostage', date: '2026-01-18' };
    expect(showsOf([{ show: a }, { show: { ...a } }, { show: { name: 'Brooklyn Mirage', date: '2026-06-01' } }, {}]).map((s) => s.name)).toEqual(['Brooklyn Mirage', 'Echostage']);
    expect(localDay(new Date(2026, 0, 18, 23, 59).toISOString())).toBe('2026-01-18');
  });
});
