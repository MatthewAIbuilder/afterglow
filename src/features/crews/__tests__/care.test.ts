import { describe, expect, it } from '@jest/globals';
import type { Crew, CrewUpdate } from '../../social/models';
import { CARE_NOTE, CARE_WINDOW_MS, careAlerts, careFestival, careFor, cleanNotified, helpTitle, myCare, NOTIFIED_MAX, toNotify, withNotified } from '../care';
import { updateLine } from '../updates';
import { crewWhere } from '../where';

const NOW = new Date(2026, 11, 5, 23, 0).getTime();
const MIN = 60_000;
const crew: Crew = { id: 'c1', festivalId: 'f', name: 'Crew', owner: 'me', members: ['me', 'maya', 'sam'], createdAt: new Date(NOW - 86400e3).toISOString() };
const up = (id: string, uid: string, minsAgo: number, extra: Partial<CrewUpdate> = {}): CrewUpdate => ({
  id,
  crewId: 'c1',
  uid,
  kind: 'checkin',
  at: new Date(NOW - minsAgo * MIN).toISOString(),
  sentAt: new Date(NOW - minsAgo * MIN).toISOString(),
  festivalId: 'f',
  ...extra,
});

describe('telling your crew how you are', () => {
  it('lists crewmates asking for help until they say they are OK', () => {
    const updates = [
      up('a1', 'maya', 30, { care: 'help', note: CARE_NOTE.help }),
      up('b1', 'sam', 50, { care: 'help' }),
      up('b2', 'sam', 10, { care: 'ok' }),
      up('m1', 'me', 5, { care: 'help' }),
    ];
    expect(careAlerts(updates, [crew], { me: 'me', now: NOW }).map((u) => u.id)).toEqual(['a1']);
    // Blocked people and old calls are left out.
    expect(careAlerts(updates, [crew], { me: 'me', blocked: ['maya'], now: NOW })).toEqual([]);
    expect(careAlerts(updates, [crew], { me: 'me', now: NOW + CARE_WINDOW_MS })).toEqual([]);
    // Someone who left the crew.
    expect(careAlerts(updates, [{ ...crew, members: ['me', 'sam'] }], { me: 'me', now: NOW })).toEqual([]);
  });

  it('knows your own latest, and which to offer', () => {
    const updates = [up('m1', 'me', 40, { care: 'help' }), up('m2', 'me', 20, { stage: 'Main' })];
    expect(myCare(updates, 'me', NOW)?.id).toBe('m1');
    expect(myCare([...updates, up('m3', 'me', 5, { care: 'ok' })], 'me', NOW)?.care).toBe('ok');
    expect(myCare(updates, undefined, NOW)).toBeUndefined();
    expect([careFor(5), careFor(3), careFor(2), careFor(1)]).toEqual(['ok', 'ok', 'help', 'help']);
  });

  it('reads plainly, and never moves someone on Where’s the crew', () => {
    expect(updateLine(up('a', 'maya', 0, { care: 'help' }))).toBe('Not feeling great · 11:00 PM');
    expect(updateLine(up('a', 'maya', 0, { care: 'ok' }))).toBe('I’m OK · 11:00 PM');
    expect(helpTitle('Maya')).toBe('Maya isn’t feeling great');
    const festival = { id: 'f', stages: [{ id: 'main', name: 'Main Stage' }] } as never;
    const where = crewWhere(festival, [crew], [up('s', 'maya', 20, { stage: 'Main Stage' }), up('h', 'maya', 5, { care: 'help' })], { now: NOW });
    expect(JSON.stringify(where)).toContain('Main Stage');
  });

  it('nudges once per call', () => {
    const alerts = [up('a1', 'maya', 5, { care: 'help' }), up('a2', 'sam', 2, { care: 'help' })];
    expect(toNotify(alerts, ['a1']).map((u) => u.id)).toEqual(['a2']);
    const many = withNotified(Array.from({ length: NOTIFIED_MAX }, (_, i) => `x${i}`), ['a2']);
    expect(many).toHaveLength(NOTIFIED_MAX);
    expect(many.at(-1)).toBe('a2');
    expect(cleanNotified(['a', 3, null])).toEqual(['a']);
    expect(cleanNotified('junk')).toEqual([]);
  });

  it('sends to tonight’s crew, or the only one', () => {
    expect(careFestival('f', ['g', 'f'])).toBe('f');
    expect(careFestival('x', ['g'])).toBe('g');
    expect(careFestival(undefined, ['g', 'h'])).toBeUndefined();
    expect(careFestival('f', [])).toBeUndefined();
  });
});
