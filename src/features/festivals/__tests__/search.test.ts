import { describe, expect, it } from '@jest/globals';
import type { Artist } from '../../../data/models';
import { carriesSound, filterLineup, lineupSounds, matchesName, normalize } from '../search';

describe('finding an artist on a lineup', () => {
  it('ignores case, accents and punctuation', () => {
    expect(normalize('ADRIÁN MILLS')).toBe('adrian mills');
    expect(normalize('CØNTRA')).toBe('contra');
    expect(normalize('JKYL & HYDE')).toBe('jkyl and hyde');
    expect(normalize('  KI/KI ')).toBe('ki ki');
  });

  it('matches any part of the name', () => {
    expect(matchesName('ADRIÁN MILLS', 'adrian')).toBe(true);
    expect(matchesName('ACRAZE B2B CID', 'cid')).toBe(true);
    expect(matchesName('MARLON HOFFSTADT', 'hoff')).toBe(true);
    expect(matchesName('CØNTRA', 'Contra')).toBe(true);
    expect(matchesName('KI/KI', 'kiki')).toBe(true);
    expect(matchesName('MAU P', 'maup')).toBe(true);
    expect(matchesName('ROSSI.', 'rossi')).toBe(true);
    expect(matchesName('WOOLI', 'wolly')).toBe(false);
  });

  it('matches everyone when nothing is typed', () => {
    expect(matchesName('WOOLI', '')).toBe(true);
    expect(matchesName('WOOLI', '   ')).toBe(true);
  });
});

describe('filtering a lineup by sound', () => {
  const a = (id: string, sound: Artist['sound']): Artist => ({ id, name: id.toUpperCase(), sound });
  const lineup = [
    a('one', { dubstep: 0.9, riddim: 0.5 }),
    a('two', { dubstep: 0.6 }),
    a('three', { dubstep: 0.4, house: 0.8 }),
    a('four', {}),
    a('five', { house: 0.7 }),
  ];

  it('counts an artist as a sound from half of it up', () => {
    expect(carriesSound(lineup[0], 'riddim')).toBe(true);
    expect(carriesSound(lineup[2], 'dubstep')).toBe(false);
    expect(carriesSound(lineup[3], 'house')).toBe(false);
  });

  it('offers sounds enough artists carry, in the usual order', () => {
    expect(lineupSounds(lineup, 2)).toEqual([
      { tag: 'dubstep', count: 2 },
      { tag: 'house', count: 2 },
    ]);
    expect(lineupSounds(lineup, 1).map((s) => s.tag)).toEqual(['dubstep', 'riddim', 'house']);
    expect(lineupSounds([], 1)).toEqual([]);
  });

  it('combines the sound with the name search', () => {
    const ids = (list: Artist[]) => list.map((x) => x.id);
    expect(ids(filterLineup(lineup, '', 'dubstep'))).toEqual(['one', 'two']);
    expect(ids(filterLineup(lineup, 'tw', 'dubstep'))).toEqual(['two']);
    expect(ids(filterLineup(lineup, 'three', 'dubstep'))).toEqual([]);
    expect(ids(filterLineup(lineup, ''))).toEqual(['one', 'two', 'three', 'four', 'five']);
  });
});
