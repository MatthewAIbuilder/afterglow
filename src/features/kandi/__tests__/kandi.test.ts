import { describe, expect, it } from '@jest/globals';
import { cleanPublicKandi, cleanWord, kandiFrom, NOTE_MAX, WORD_MAX } from '../kandi';

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
    expect(kandiFrom('k2', { from: 'a', to: 'b', word: 'plur', beads: 'gold' })).toBeUndefined();
    expect(kandiFrom('k3', { from: 'a', to: 'b', word: '~~', beads: 'neon' })).toBeUndefined();
  });

  it('shows visitors only the word, the beads and who made it', () => {
    expect(cleanPublicKandi([{ word: 'plur', beads: 'uv', from: 'maya', note: 'secret' }, { word: 'x', beads: 'nope' }])).toEqual([{ word: 'PLUR', beads: 'uv', from: 'maya' }]);
  });
});
