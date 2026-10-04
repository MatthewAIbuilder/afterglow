import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import { mustSeeCard, mustSeeText } from '../mustSeeCard';
import type { Pick } from '../plan';

const a = (id: string) => ({ id, name: id.toUpperCase(), sound: {} }) as unknown as Artist;
const p = (id: string, tier: Pick['tier'], over: Partial<Pick> = {}): Pick => ({ artist: a(id), match: 0.8, tier, pinned: false, known: true, ...over });
const festival = { id: 'edc', name: 'EDC Orlando 2026', dates: 'Nov 6 to 8', location: 'Tinker Field, Orlando' } as Festival;

describe('your must-sees card', () => {
  it('stars first, then must-sees, then strong matches, five at most, each with why', () => {
    const picks = [p('a', 'must-see'), p('b', 'strong'), p('c', 'explore', { pinned: true, match: 0.3 }), p('d', 'must-see'), p('e', 'strong'), p('f', 'strong'), p('g', 'explore'), p('h', 'strong', { known: false })];
    const card = mustSeeCard(festival, picks, (x) => `Why ${x.artist.id}`)!;
    expect(card.lines.map((l) => l.artist.id)).toEqual(['c', 'a', 'd', 'b', 'e']);
    expect(card.lines[0]).toMatchObject({ star: true, why: 'Why c', match: 0.3 });
    expect(card.subtitle).toBe('Nov 6 to 8 · Tinker Field, Orlando');
    expect(mustSeeText(card, 'Afterglow', 'https://afterglowmusic.app').split('\n')).toEqual([
      'My must-sees at EDC Orlando 2026:',
      '1. ★ C · Why c',
      '2. A · Why a',
      '3. D · Why d',
      '4. B · Why b',
      '5. E · Why e',
      '',
      'Made with Afterglow · https://afterglowmusic.app',
    ]);
  });

  it('nothing to share when nothing is for you yet', () => {
    expect(mustSeeCard(festival, [p('g', 'explore')], () => '')).toBeUndefined();
  });
});
