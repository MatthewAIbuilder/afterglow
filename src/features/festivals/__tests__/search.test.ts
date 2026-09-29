import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import { carriesSound, filterLineup, lineupSounds, matchesName, normalize, searchArtists, searchFestivals } from '../search';

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

describe('searching every artist', () => {
  const a = (name: string): Artist => ({ id: name.toLowerCase().replace(/\W+/g, '-'), name, sound: {} });
  const all = [a('SUBTRONICS'), a('ILLENIUM'), a('MARLON HOFFSTADT'), a('SUB FOCUS'), a('LEVITY'), a('TAPE B')];
  const names = (list: Artist[]) => list.map((x) => x.name);

  it('puts names that start with the search first, then word starts, then anywhere', () => {
    expect(names(searchArtists(all, 'sub'))).toEqual(['SUBTRONICS', 'SUB FOCUS']);
    // TAPE B has a word starting with B; the others only contain one.
    expect(names(searchArtists(all, 'b'))).toEqual(['TAPE B', 'SUBTRONICS', 'SUB FOCUS']);
    expect(names(searchArtists(all, 'hoff'))).toEqual(['MARLON HOFFSTADT']);
    expect(names(searchArtists(all, 'on'))).toEqual(['SUBTRONICS', 'MARLON HOFFSTADT']);
  });

  it('finds nothing for an empty search, and stops at the limit', () => {
    expect(searchArtists(all, '  ')).toEqual([]);
    expect(searchArtists(all, 'i', 2)).toHaveLength(2);
  });
});

describe('finding a festival', () => {
  const fest = (id: string, name: string, location: string): Festival => ({ id, name, location, dates: '', lineup: [], days: [], stages: [] });
  const festivals = [
    fest('acl', 'Austin City Limits 2026', 'Austin, Texas'),
    fest('edc', 'EDC Orlando 2026', 'Tinker Field, Orlando'),
    fest('eternal', 'Eternal NYE 2026', 'Orlando Amphitheater, Orlando'),
    fest('countdown', 'Countdown NYE 2026', 'NOS Events Center, San Bernardino'),
  ];
  const ids = (list: Festival[]) => list.map((f) => f.id);

  it('matches names first, then places', () => {
    expect(ids(searchFestivals(festivals, 'orlando'))).toEqual(['edc', 'eternal']);
    expect(ids(searchFestivals(festivals, 'nye'))).toEqual(['eternal', 'countdown']);
    expect(ids(searchFestivals(festivals, 'e'))).toEqual(['edc', 'eternal', 'countdown', 'acl']);
    expect(ids(searchFestivals(festivals, 'texas'))).toEqual(['acl']);
    expect(searchFestivals(festivals, '  ')).toEqual([]);
  });
});
