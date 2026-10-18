import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { cleanCustom, CUSTOM_MAX, CUSTOM_TEXT_MAX, cleanCustomText, cleanPrep, prepChecklist, prepProgress, prepProgressOf, RATED_ENOUGH, withCustomItem } from '../checklist';

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

describe('your own checklist items', () => {
  let n = 0;
  const id = () => `c${++n}x`;
  it('tidied, never empty, never twice, never more than the limit', () => {
    expect(cleanCustomText('  a   poncho \n ')).toBe('a poncho');
    expect(cleanCustomText('x'.repeat(200))).toHaveLength(CUSTOM_TEXT_MAX);
    const one = withCustomItem([], '  Poncho ', id);
    expect(one.map((x) => x.text)).toEqual(['Poncho']);
    expect(withCustomItem(one, 'poncho', id)).toEqual(one);
    expect(withCustomItem(one, '   ', id)).toEqual(one);
    const full = Array.from({ length: CUSTOM_MAX }, (_, i) => ({ id: `c${i}ab`, text: `item ${i}` }));
    expect(withCustomItem(full, 'one more', id)).toHaveLength(CUSTOM_MAX);
  });

  it('read back from the phone, bad ones dropped', () => {
    expect(cleanCustom({ f: [{ id: 'cabc', text: ' Snacks ' }, { id: 'nope', text: 'x' }, { id: 'cabc', text: 'dup' }, { id: 'cdef', text: '' }, 7], g: 'x' })).toEqual({ f: [{ id: 'cabc', text: 'Snacks' }] });
    expect(cleanCustom(null)).toEqual({});
  });

  it('count in how far along you are, and are always the last section', () => {
    const input = { ...base, festival: fest(), ticked: new Set(['cabc']), custom: [{ id: 'cabc', text: 'Snacks' }, { id: 'cdef', text: 'A flag' }] };
    const s = prepChecklist(input);
    expect(s.at(-1)!.items.map((i) => [i.label, i.done, i.custom])).toEqual([['Snacks', true, true], ['A flag', false, true]]);
    expect(prepProgressOf(input)).toEqual({ done: 1, total: 2 + 2 + 7 + 2 });
    expect(prepChecklist({ ...base, festival: fest() }).at(-1)!.items).toEqual([]);
  });
});
