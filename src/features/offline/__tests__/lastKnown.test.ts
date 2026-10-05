import { describe, expect, it } from '@jest/globals';
import type { Crew, CrewMessage, Profile } from '../../social/models';
import { cleanLastKnown, forgetAccount, keep, keptAt, KEPT_ACCOUNTS_MAX, KEPT_MESSAGES_MAX, LAST_KNOWN_KEEP_MS, lastUpdatedLine, whenRead } from '../lastKnown';

const NOW = new Date(2026, 10, 7, 21, 15).getTime();
const at = (h: number, m = 0, day = 7) => new Date(2026, 10, day, h, m).getTime();
const profile = (uid: string, name: string): Profile => ({
  uid,
  handle: name.toLowerCase(),
  displayName: name,
  bio: '',
  festivals: [],
  sounds: [],
  showFestivals: false,
  showSound: false,
  artists: [],
  showArtists: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
});
const crew = (id: string): Crew => ({ id, festivalId: 'solstice-26', name: 'Bass crew', owner: 'maya', members: ['maya', 'sam'], createdAt: '2026-11-01T00:00:00.000Z' });
const message = (id: string): CrewMessage => ({ id, crewId: 'c1', uid: 'maya', text: 'Water break', at: '2026-11-07T16:10:00.000Z', sentAt: '2026-11-07T16:10:01.000Z' });

describe('what the phone last read', () => {
  it('keeps what was saved, and drops anything malformed or too old', () => {
    const saved = {
      sam: {
        profile: { value: profile('sam', 'Sam'), at: at(17, 30) },
        crews: { value: [crew('c1'), { id: 'broken' }], at: at(17, 30) },
        people: { maya: profile('maya', 'Maya'), bad: { uid: 3 } },
        meets: { c1: { text: 'The big tree', by: 'maya', at: '2026-11-07T16:06:00.000Z' }, c2: null, c3: 'nope' },
        chat: { c1: { value: [message('m1'), { id: 'm2' }], at: at(17, 30) }, old: { value: [message('m3')], at: NOW - LAST_KNOWN_KEEP_MS - 1 } },
        blocked: ['troll', 4],
      },
      ['']: { crews: { value: [], at: at(17) } },
      junk: 'nope',
    };
    const book = cleanLastKnown(JSON.parse(JSON.stringify(saved)), NOW);
    expect(Object.keys(book)).toEqual(['sam']);
    const sam = book.sam;
    expect(sam.profile?.value.displayName).toBe('Sam');
    expect(sam.crews?.value.map((c) => c.id)).toEqual(['c1']);
    expect(Object.keys(sam.people ?? {})).toEqual(['maya']);
    expect(sam.meets).toEqual({ c1: { text: 'The big tree', by: 'maya', at: '2026-11-07T16:06:00.000Z' }, c2: null });
    expect(Object.keys(sam.chat ?? {})).toEqual(['c1']);
    expect(sam.chat?.c1.value.map((m) => m.id)).toEqual(['m1']);
    expect(sam.blocked).toEqual(['troll']);
    expect(cleanLastKnown('not json', NOW)).toEqual({});
    expect(cleanLastKnown(null, NOW)).toEqual({});
  });

  it('caps what a chat keeps', () => {
    const many = Array.from({ length: KEPT_MESSAGES_MAX + 20 }, (_, i) => message(`m${i}`));
    const book = cleanLastKnown({ sam: { chat: { c1: { value: many, at: at(17) } } } }, NOW);
    expect(book.sam.chat?.c1.value).toHaveLength(KEPT_MESSAGES_MAX);
  });

  it('merges per crew, so reading one crew never forgets another', () => {
    let book = keep({}, 'sam', { meets: { c1: null }, chat: { c1: { value: [message('m1')], at: at(17) } } });
    book = keep(book, 'sam', { meets: { c2: { text: 'Gate B', by: 'sam', at: '2026-11-07T18:00:00.000Z' } }, chat: { c2: { value: [], at: at(18) } } });
    expect(Object.keys(book.sam.meets ?? {})).toEqual(['c1', 'c2']);
    expect(Object.keys(book.sam.chat ?? {})).toEqual(['c1', 'c2']);
    // Top-level parts replace what was there.
    book = keep(book, 'sam', { crews: { value: [crew('c1')], at: at(17) } });
    book = keep(book, 'sam', { crews: { value: [], at: at(19) } });
    expect(book.sam.crews?.value).toEqual([]);
    // Another account on the same phone is kept apart.
    book = keep(book, 'maya', { blocked: ['x'] });
    expect(book.sam.blocked).toBeUndefined();
    expect(book.maya.blocked).toEqual(['x']);
  });

  it('keeps a few accounts at most, letting the one read longest ago go', () => {
    let book = {};
    for (let i = 0; i < KEPT_ACCOUNTS_MAX; i++) book = keep(book, `u${i}`, { crews: { value: [], at: at(10 + i) } });
    book = keep(book, 'new', { crews: { value: [], at: at(20) } });
    expect(Object.keys(book)).toHaveLength(KEPT_ACCOUNTS_MAX);
    expect(book).not.toHaveProperty('u0');
    expect(book).toHaveProperty('new');
  });

  it('forgets an account', () => {
    const book = keep(keep({}, 'sam', { blocked: [] }), 'maya', { blocked: [] });
    expect(Object.keys(forgetAccount(book, 'sam'))).toEqual(['maya']);
    expect(forgetAccount(book, 'nobody')).toBe(book);
  });

  it('says when things were read: the oldest of them', () => {
    expect(keptAt([{ value: 1, at: at(17) }, undefined, { value: 2, at: at(16) }])).toBe(at(16));
    expect(keptAt([undefined])).toBeUndefined();
  });

  it('words the quiet line plainly', () => {
    expect(whenRead(at(21, 41), NOW)).toBe('9:41 PM');
    expect(whenRead(at(0, 5, 6), NOW)).toBe('Nov 6, 12:05 AM');
    expect(lastUpdatedLine({ at: at(21, 41), offline: true, live: false, now: NOW })).toBe('No signal, showing what you had · Last updated 9:41 PM');
    expect(lastUpdatedLine({ offline: true, live: false, now: NOW })).toBe('No signal. This fills in once you’re back online.');
    expect(lastUpdatedLine({ at: at(21, 41), offline: false, live: false, now: NOW })).toBe('Last updated 9:41 PM');
    expect(lastUpdatedLine({ at: at(21, 41), offline: false, live: true, now: NOW })).toBeUndefined();
    expect(lastUpdatedLine({ offline: false, live: false, now: NOW })).toBeUndefined();
  });
});
