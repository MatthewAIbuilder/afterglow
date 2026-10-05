import { describe, expect, it } from '@jest/globals';
import type { Clip, Festival } from '../../../data/models';
import { isNewcomer, watchFestival, welcomeChoices, welcomeFestival } from '../firstRun';

const fest = (id: string, lineup: string[]): Festival => ({
  id,
  name: id,
  dates: '',
  location: '',
  lineup,
  days: [],
  stages: [],
});
const festivals = [fest('a', ['x']), fest('b', ['y']), fest('c', ['z'])];
const clips: Clip[] = [{ id: 'c1', artistId: 'y', festivalId: 'b', title: 't', durationSec: 30, bpm: 128 }];

describe('first run', () => {
  it('welcomes only someone with no history at all', () => {
    expect(isNewcomer({ reactions: 0, ratings: 0, going: 0, seen: 0 })).toBe(true);
    expect(isNewcomer({ reactions: 1, ratings: 0, going: 0, seen: 0 })).toBe(false);
    expect(isNewcomer({ reactions: 0, ratings: 2, going: 0, seen: 0 })).toBe(false);
    expect(isNewcomer({ reactions: 0, ratings: 0, going: 1, seen: 0 })).toBe(false);
    expect(isNewcomer({ reactions: 0, ratings: 0, going: 0, seen: 3 })).toBe(false);
  });

  it('carries on with the first festival you are going to, in catalogue order', () => {
    expect(welcomeFestival(festivals, ['c', 'b'])?.id).toBe('b');
    expect(welcomeFestival(festivals, [])).toBeUndefined();
    expect(welcomeFestival(festivals, ['gone'])).toBeUndefined();
  });

  it('opens Discover on that festival only when it has clips', () => {
    expect(watchFestival(festivals[1], clips)?.id).toBe('b');
    expect(watchFestival(festivals[0], clips)).toBeUndefined();
    expect(watchFestival(undefined, clips)).toBeUndefined();
  });

  it('asks about festivals still to come, soonest first, keeping any you picked', () => {
    const dated = (id: string, start: string, end: string): Festival => ({ ...fest(id, []), startDate: start, endDate: end });
    const list = [
      dated('later', '2026-12-04', '2026-12-06'),
      fest('undated', []),
      dated('over', '2026-06-19', '2026-06-21'),
      dated('soon', '2026-11-06', '2026-11-08'),
      dated('on-now', '2026-10-04', '2026-10-06'),
    ];
    const today = new Date(2026, 9, 5, 12);
    expect(welcomeChoices(list, [], today).map((f) => f.id)).toEqual(['on-now', 'soon', 'later', 'undated']);
    expect(welcomeChoices(list, ['over'], today).map((f) => f.id)).toEqual(['on-now', 'soon', 'later', 'undated', 'over']);
  });
});
