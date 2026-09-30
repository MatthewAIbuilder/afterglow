import { describe, expect, it } from '@jest/globals';
import { inCommon } from '../common';

const names: Record<string, string> = { edc: 'EDC Orlando 2026', cc: 'Cyclops Cove 4', acl: 'ACL 2026', hedex: 'HEDEX', subtronics: 'SUBTRONICS', illenium: 'ILLENIUM' };
const base = {
  festivalName: (id: string) => (id === 'over' ? undefined : names[id]),
  artistName: (id: string) => names[id],
};

describe('what you have in common', () => {
  it('festivals you are both going to, sounds you both lean, artists they filmed that you love', () => {
    const lines = inCommon({
      ...base,
      theirs: { festivals: ['edc', 'cc', 'over', 'acl'], sounds: ['dubstep', 'riddim', 'house'], filmed: ['hedex', 'subtronics', 'hedex', 'illenium'] },
      mine: { going: ['cc', 'edc', 'acl', 'over'], sounds: ['riddim', 'dubstep'], loves: (a) => a !== 'illenium' },
    });
    expect(lines.map((l) => l.text)).toEqual([
      'You’re both going to EDC Orlando 2026, Cyclops Cove 4 and 1 more',
      'You both lean dubstep and riddim',
      'They filmed HEDEX and SUBTRONICS, artists you love',
    ]);
  });

  it('one of each reads naturally, and nothing in common says nothing', () => {
    const one = inCommon({
      ...base,
      theirs: { festivals: ['cc'], sounds: ['house'], filmed: ['hedex'] },
      mine: { going: ['cc'], sounds: ['house'], loves: () => true },
    });
    expect(one.map((l) => l.text)).toEqual(['You’re both going to Cyclops Cove 4', 'You both lean house', 'They filmed HEDEX, who you love']);
    expect(inCommon({ ...base, theirs: { festivals: ['over'], sounds: [], filmed: ['hedex'] }, mine: { going: ['over'], sounds: [], loves: () => false } })).toEqual([]);
  });
});
