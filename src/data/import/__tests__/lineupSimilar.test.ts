import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../bundled';
import { parseCatalogFile } from '../../file';
import { buildCatalog } from '../../merge';
import { MOCK_TASTE } from '../../mock';
import { computeTaste } from '../../../features/taste/engine';
import { similarityWith } from '../../../features/taste/similarity';
import { lineupSimilarities, LINEUP_SIMILAR } from '../lineupSimilar';

const fest = (id: string, lineup: string[], artistDays?: Record<string, string[]>) => ({ id, lineup, ...(artistDays ? { artistDays } : {}) });
const filler = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i}`);

describe('who sounds alike, from lineups', () => {
  it('pairs artists who keep sharing small bills, more for a shared day', () => {
    const fests = [
      fest('a', ['new1', 'tagged', 'new2', ...filler(6, 'x')], { new1: ['Friday'], tagged: ['Friday'], new2: ['Saturday'] }),
      fest('b', ['new1', 'tagged', 'new2', ...filler(6, 'y')], { new1: ['Friday'], tagged: ['Friday'], new2: ['Saturday'] }),
      fest('c', ['new1', ...filler(6, 'z')]),
      fest('d', ['new1', ...filler(6, 'w')]),
    ];
    const pairs = lineupSimilarities(fests, (id) => id === 'tagged', { ...LINEUP_SIMILAR, maxScore: 1 });
    const score = (a: string, b: string) => pairs.find((p) => (p.artist === a && p.other === b) || (p.artist === b && p.other === a))?.score;
    expect(score('new1', 'tagged')).toBeGreaterThan(score('new1', 'new2')!);
    expect(Math.max(...lineupSimilarities(fests, (id) => id === 'tagged').map((p) => p.score))).toBeLessThanOrEqual(LINEUP_SIMILAR.maxScore);
    // Once together isn't enough.
    expect(score('new1', 'x0')).toBeUndefined();
  });

  it('never judges two tagged artists, and says little about huge lineups', () => {
    const big = [fest('a', ['new1', 'new2', ...filler(140, 'x')]), fest('b', ['new1', 'new2', ...filler(140, 'y')])];
    expect(lineupSimilarities(big, () => false).find((p) => p.artist === 'new1' && p.other === 'new2')).toBeUndefined();
    const small = [fest('a', ['t1', 't2', 'z']), fest('b', ['t1', 't2', 'z'])];
    expect(lineupSimilarities(small, (id) => id.startsWith('t')).some((p) => p.artist === 't1' && p.other === 't2')).toBe(false);
  });

  it('keeps each artist to their closest few', () => {
    const acts = filler(12, 'n');
    const pairs = lineupSimilarities([fest('a', acts), fest('b', acts), fest('c', acts)], () => false, { ...LINEUP_SIMILAR, perArtist: 2 });
    const count = (id: string) => pairs.filter((p) => p.artist === id || p.other === id).length;
    expect(Math.max(...acts.map(count))).toBeLessThanOrEqual(2);
  });

  it('lets a like reach an artist with no sound tags', () => {
    const raw = {
      version: 1,
      artists: [{ id: 'new-act', name: 'New Act' }],
      festivals: [
        { id: 'f1', name: 'F1', dates: 'x', lineup: ['new-act', 'subtronics', 'levity'] },
        { id: 'f2', name: 'F2', dates: 'x', lineup: ['new-act', 'subtronics', 'levity'] },
      ],
      clips: [],
    };
    const { catalog } = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(raw));
    const tagged = (id: string) => Object.keys(catalog.artist(id)?.sound ?? {}).length > 0;
    const pairs = lineupSimilarities(catalog.festivals, tagged);
    const withPairs = buildCatalog(BUILT_IN.snapshot, parseCatalogFile({ ...raw, similar: pairs }));
    expect(withPairs.problems).toEqual([]);
    const c = withPairs.catalog;
    const before = computeTaste(MOCK_TASTE, c.artists, c.clips, {}, undefined, { subtronics: 'love' });
    const after = computeTaste(MOCK_TASTE, c.artists, c.clips, {}, similarityWith(c.similarities), { subtronics: 'love' });
    expect(before.informed['new-act']).toBeFalsy();
    expect(after.informed['new-act']).toBe(true);
  });
});
