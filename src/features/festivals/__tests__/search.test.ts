import { describe, expect, it } from '@jest/globals';
import { matchesName, normalize } from '../search';

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
