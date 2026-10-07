import { describe, expect, it } from '@jest/globals';
import { cleanPublicKandi, cleanWord, kandiCardFrom, kandiFrom, kandiLink, NOTE_MAX, readKandiLink, WORD_MAX } from '../kandi';

describe('kandi', () => {
  it('spells only what letter beads carry, in capitals', () => {
    expect(cleanWord('plur')).toBe('PLUR');
    expect(cleanWord('  good   vibes ')).toBe('GOOD VIBES');
    expect(cleanWord('i <3 u')).toBe('I ♥ U');
    expect(cleanWord('héllo~#')).toBe('HLLO');
    expect(cleanWord('x'.repeat(30))).toHaveLength(WORD_MAX);
    expect(cleanWord(3)).toBe('');
  });

  it('reads kandi back, the note kept to its length, anything odd left out', () => {
    const k = kandiFrom('k1', { from: 'a', to: 'b', word: 'plur', beads: 'neon', note: 'x'.repeat(200), createdAt: '2026-10-06T10:00:00.000Z' });
    expect(k).toMatchObject({ id: 'k1', word: 'PLUR', beads: 'neon' });
    expect(k?.note).toHaveLength(NOTE_MAX);
    expect(kandiFrom('k2', { from: 'a', to: 'b', word: 'plur', beads: 'chrome' })).toBeUndefined();
    expect(kandiFrom('k3', { from: 'a', to: 'b', word: '~~', beads: 'neon' })).toBeUndefined();
  });

  it('shows visitors only the word, the beads and who made it', () => {
    expect(cleanPublicKandi([{ word: 'plur', beads: 'uv', from: 'maya', note: 'secret' }, { word: 'x', beads: 'nope' }])).toEqual([{ word: 'PLUR', beads: 'uv', from: 'maya' }]);
  });
});

describe('kandi given by code', () => {
  const card = { id: 'abcdefghij2345678mnp', from: 'uid-1', handle: 'matt.raves', word: 'I ♥ U', beads: 'neon' as const };
  it('a link carries who made it and how it looks, and reads back', () => {
    const link = kandiLink(card);
    expect(link.startsWith('https://afterglowmusic.app/kandi/abcdefghij2345678mnp?')).toBe(true);
    expect(readKandiLink(link)).toEqual(card);
    expect(readKandiLink(link.replace('afterglowmusic.app', 'afterglowmusic.web.app'))).toEqual(card);
  });
  it('turns away anything that isn’t one', () => {
    expect(readKandiLink('https://afterglowmusic.app/sprout/abcdefghij2345678mnp?u=x&h=y&k=plur')).toBeUndefined();
    expect(readKandiLink('https://evil.example/kandi/abcdefghij2345678mnp?u=x&w=HI&b=neon')).toBeUndefined();
    expect(readKandiLink('https://afterglowmusic.app/kandi/short?u=x&w=HI&b=neon')).toBeUndefined();
    expect(readKandiLink('https://afterglowmusic.app/kandi/abcdefghij2345678mnp?u=x&w=HI&b=gold')).toBeUndefined();
    expect(kandiCardFrom({ id: 'abcdefghij2345678mnp', u: 'x', h: 'Not A Handle!', w: 'hi', b: 'uv' })).toEqual({ id: 'abcdefghij2345678mnp', from: 'x', handle: '', word: 'HI', beads: 'uv' });
  });
  it('reads kandi nobody has picked up yet', () => {
    expect(kandiFrom('k', { from: 'a', word: 'PLUR', beads: 'uv', createdAt: '2026-10-07T00:00:00Z' })?.to).toBe('');
  });
});
