import { describe, expect, it } from '@jest/globals';
import type { Crew, CrewUpdate } from '../../social/models';
import { crewWhere, STALE_AFTER_MS, whereLine } from '../where';

const festival = { id: 'f', stages: [{ id: 'main', name: 'Main Stage' }, { id: 'bass', name: 'Bass Tent' }] };
const crew: Crew = { id: 'c1', festivalId: 'f', name: 'Bass crew', owner: 'me', members: ['me', 'maya', 'sam', 'jo', 'troll'], createdAt: '' };
const other: Crew = { id: 'c2', festivalId: 'f', name: 'Work friends', owner: 'ana', members: ['me', 'ana', 'maya'], createdAt: '' };
const t = (h: number, m = 0) => new Date(2026, 10, 7, h, m).toISOString();
const now = Date.parse(t(17, 30));
const up = (id: string, uid: string, at: string, more: Partial<CrewUpdate> = {}): CrewUpdate => ({
  id, crewId: 'c1', uid, kind: 'checkin', at, sentAt: at, festivalId: 'f', ...more,
});

describe('where is the crew', () => {
  it('groups people by the stage of their newest update, in the festival’s stage order', () => {
    const where = crewWhere(
      festival,
      [crew, other],
      [
        up('a', 'maya', t(16), { stage: 'Main Stage' }),
        up('b', 'maya', t(17), { stage: 'bass tent' }),
        up('c', 'sam', t(17, 10), { stage: 'Main Stage' }),
        up('d', 'me', t(17, 20), { stage: 'Main Stage' }),
        up('e', 'ana', t(17, 25), { crewId: 'c2' }),
        up('f', 'jo', t(17, 26), { kind: 'reply', replyTo: 'a', note: 'On my way' }),
        up('g', 'troll', t(17), { stage: 'Main Stage' }),
      ],
      { blocked: ['troll'], now },
    );
    expect(where.stages.map((g) => [g.stage, g.people.map((p) => p.uid)])).toEqual([
      ['Main Stage', ['me', 'sam']],
      ['Bass Tent', ['maya']],
    ]);
    expect(where.elsewhere.map((p) => p.uid)).toEqual(['ana']);
    // A reply says nothing of where someone is.
    expect(where.quiet).toEqual(['jo']);
    const name = (u: string) => (u === 'me' ? 'You' : u[0].toUpperCase() + u.slice(1));
    expect(whereLine(where, name)).toBe('You and Sam at Main Stage, Maya at Bass Tent, Ana somewhere else');
  });

  it('old news is marked, very old news is left out', () => {
    const where = crewWhere(festival, [crew], [up('a', 'maya', new Date(now - STALE_AFTER_MS - 60_000).toISOString(), { stage: 'Lake Stage' }), up('b', 'sam', t(1, 0), { stage: 'Main Stage' })], { now: now + 36 * 3600_000 });
    expect(where.stages).toEqual([]);
    const fresh = crewWhere(festival, [crew], [up('a', 'maya', new Date(now - STALE_AFTER_MS - 60_000).toISOString(), { stage: 'Lake Stage' })], { now });
    expect(fresh.stages[0]).toMatchObject({ stage: 'Lake Stage', people: [{ uid: 'maya', stale: true }] });
    expect(whereLine(crewWhere(festival, [crew], [], { now }), String)).toBe('No one has said where they are yet');
  });
});
