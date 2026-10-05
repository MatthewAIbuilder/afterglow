import { describe, expect, it } from '@jest/globals';
import { DEMO_FESTIVALS, shippedDemo } from '../bundled';
import { MOCK_SNAPSHOT } from '../mock';

describe('what the app ships', () => {
  it('leaves out the invented demo festivals but keeps the demo artists and clips', () => {
    const shipped = shippedDemo(false);
    expect(shipped.festivals.some((f) => DEMO_FESTIVALS.has(f.id))).toBe(false);
    expect(shipped.artists).toBe(MOCK_SNAPSHOT.artists);
    expect(shipped.clips).toBe(MOCK_SNAPSHOT.clips);
  });

  it('every demo festival is one the list names', () => {
    for (const f of MOCK_SNAPSHOT.festivals) expect(DEMO_FESTIVALS.has(f.id)).toBe(true);
    expect(shippedDemo(true)).toBe(MOCK_SNAPSHOT);
  });
});
