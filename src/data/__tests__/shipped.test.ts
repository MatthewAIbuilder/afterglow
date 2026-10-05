import { describe, expect, it } from '@jest/globals';
import { DEMO_FESTIVALS, shippedDemo } from '../bundled';
import { MOCK_SNAPSHOT } from '../mock';

describe('what the app ships', () => {
  it('leaves out the invented demo festivals but keeps the demo artists', () => {
    const shipped = shippedDemo(false);
    expect(shipped.festivals.some((f) => DEMO_FESTIVALS.has(f.id))).toBe(false);
    expect(shipped.artists).toBe(MOCK_SNAPSHOT.artists);
  });

  it('moves each demo clip to the first real festival its artist plays, and drops the rest', () => {
    const artist = MOCK_SNAPSHOT.clips[0].artistId;
    const real = [
      { ...MOCK_SNAPSHOT.festivals[0], id: 'real-a', lineup: ['someone-else'] },
      { ...MOCK_SNAPSHOT.festivals[0], id: 'real-b', lineup: [artist] },
      { ...MOCK_SNAPSHOT.festivals[0], id: 'real-c', lineup: [artist] },
    ];
    const shipped = shippedDemo(false, real);
    const theirs = MOCK_SNAPSHOT.clips.filter((c) => c.artistId === artist);
    expect(shipped.clips.filter((c) => c.artistId === artist).map((c) => c.festivalId)).toEqual(theirs.map(() => 'real-b'));
    expect(shipped.clips.every((c) => c.artistId === artist)).toBe(true);
    expect(shippedDemo(false).clips).toEqual([]);
  });

  it('every demo festival is one the list names', () => {
    for (const f of MOCK_SNAPSHOT.festivals) expect(DEMO_FESTIVALS.has(f.id)).toBe(true);
    expect(shippedDemo(true)).toBe(MOCK_SNAPSHOT);
  });
});
