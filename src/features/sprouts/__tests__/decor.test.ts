import { describe, expect, it } from '@jest/globals';
import { cleanDecor, decorFor } from '../decor';

const none = { given: 0, kinds: new Set<never>(), artists: [], kandi: 0 };

describe('garden decorations', () => {
  it('starts with an empty sky', () => {
    expect(decorFor(none)).toEqual([]);
  });

  it('earns each one by what you do', () => {
    expect(decorFor({ ...none, given: 10 })).toEqual(['lights']);
    expect(decorFor({ ...none, given: 9 })).toEqual([]);
    expect(decorFor({ ...none, kinds: new Set(['wanderer', 'moonlight'] as const) })).toEqual(['bunting', 'moon']);
    expect(decorFor({ ...none, kandi: 5 })).toEqual(['lanterns']);
    expect(decorFor({ ...none, artists: [{ id: 'a', tier: 3, shiny: true } as never] })).toEqual(['rainbow', 'aurora']);
    expect(decorFor({ ...none, artists: [{ id: 'a', tier: 2 } as never] })).toEqual([]);
    expect(decorFor({ ...none, pinned: 3, completeSets: 1 })).toEqual(['stars', 'fireworks']);
    expect(decorFor({ ...none, pinned: 2 })).toEqual([]);
    expect(decorFor({ ...none, kinds: new Set(['seeker'] as const) })).toEqual(['constellation']);
    expect(decorFor({ ...none, portal: true })).toEqual(['portal']);
  });

  it('reads back only known decorations, once each', () => {
    expect(cleanDecor(['moon', 'moon', 'confetti', 3, 'aurora'])).toEqual(['moon', 'aurora']);
    expect(cleanDecor('moon')).toEqual([]);
    expect(cleanDecor(undefined)).toEqual([]);
  });
});
