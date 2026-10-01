import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { cleanPrep, prepChecklist, prepProgress, RATED_ENOUGH } from '../checklist';

const fest = (over: Partial<Festival> = {}): Festival => ({
  id: 'f',
  name: 'Fest',
  dates: 'Dec 4 to 6',
  location: 'Somewhere',
  lineup: Array.from({ length: 30 }, (_, i) => `a${i}`),
  days: ['Friday', 'Saturday', 'Sunday'],
  stages: [],
  startDate: '2026-12-04',
  endDate: '2026-12-06',
  ...over,
});
const base = { rated: 0, lineup: 30, stars: 0, remindersPossible: false, remindersOn: false, ticked: new Set<string>() };

describe('getting ready', () => {
  it('ticks what the app can see, and leaves the rest to you', () => {
    const s = prepChecklist({ ...base, festival: fest(), rated: RATED_ENOUGH, stars: 2, ticked: new Set(['ticket', 'earplugs']) });
    const plan = s[0].items;
    expect(plan.map((i) => [i.id, i.done, i.auto])).toEqual([
      ['rate', true, true],
      ['stars', true, true],
    ]);
    expect(plan[0].detail).toBe('10 of 30 rated');
    expect(s[1].items.find((i) => i.id === 'ticket')!.done).toBe(true);
    expect(s[1].items.find((i) => i.id === 'travel')!.label).toBe('Sort travel and a place to stay');
    expect(s[2].items.find((i) => i.id === 'earplugs')!.done).toBe(true);
    expect(prepProgress(s)).toEqual({ done: 4, total: 2 + 2 + 7 });
  });

  it('offers reminders only once set times make them possible, and the ticket link when there is one', () => {
    const s = prepChecklist({ ...base, festival: fest({ links: { tickets: 'https://example.com/t' }, startDate: '2026-12-04', endDate: '2026-12-04' }), remindersPossible: true, remindersOn: true });
    expect(s[0].items.map((i) => i.id)).toEqual(['rate', 'stars', 'reminders']);
    expect(s[0].items[2].done).toBe(true);
    expect(s[1].items[0].action).toBe('tickets');
    expect(s[1].items[1].label).toBe('Sort how you’re getting there and back');
  });

  it('a small lineup counts as rated once everyone is', () => {
    expect(prepChecklist({ ...base, festival: fest(), lineup: 4, rated: 4 })[0].items[0].done).toBe(true);
  });

  it('reads back only lists of names', () => {
    expect(cleanPrep({ f: ['ticket', 3, 'id'], g: 'x' })).toEqual({ f: ['ticket', 'id'] });
    expect(cleanPrep(null)).toEqual({});
  });
});
