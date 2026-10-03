import { describe, expect, it } from '@jest/globals';
import type { Artist, Festival } from '../../../data/models';
import type { Memory } from '../../memories/models';
import type { CrewUpdate } from '../../social/models';
import { cleanQuestLog, festivalAt, newlyDone, nightKey, openQuests, QUESTS, questBadges, questProgress, type QuestInput } from '../quests';

const fest: Festival = {
  id: 'cc',
  name: 'Cove',
  dates: 'Dec 4 to 5',
  location: 'Cove, Boca Raton',
  lineup: ['a', 'b'],
  days: ['Friday', 'Saturday'],
  stages: [{ id: 'main', name: 'Main' }],
  sets: [{ artistId: 'a', day: 'Friday', stageId: 'main', start: '22:00', end: '23:30' }],
  startDate: '2026-12-04',
  endDate: '2026-12-05',
} as Festival;
const artists = [{ id: 'a', name: 'A', sound: { dubstep: 1 } }, { id: 'b', name: 'B', sound: { house: 1 } }] as Artist[];
const at = (d: number, h: number, m = 0) => new Date(2026, 11, d, h, m).getTime();
const iso = (t: number) => new Date(t).toISOString();
const update = (u: Partial<CrewUpdate> & { id: string; uid: string; at: string }): CrewUpdate =>
  ({ crewId: 'k', kind: 'checkin', sentAt: u.at, festivalId: 'cc', ...u }) as CrewUpdate;

const base: QuestInput = {
  festivals: [fest],
  artists,
  friends: [],
  theirSounds: () => undefined,
  loves: (id) => id === 'a',
  me: 'me',
  memories: [],
  crews: [],
  updates: [],
  spotsSetByMe: 0,
  now: at(4, 23),
};

describe('side quests', () => {
  it('knows which festival night a moment falls on (noon to noon)', () => {
    expect(nightKey(at(5, 2))).toBe('2026-12-04');
    expect(festivalAt([fest], at(4, 23))?.id).toBe('cc');
    expect(festivalAt([fest], at(6, 11))?.id).toBe('cc');
    expect(festivalAt([fest], at(6, 13))).toBeUndefined();
  });

  it('PLUR trade and Same wavelength: a friend scanned at the festival, during a set by an artist you both love', () => {
    const p = questProgress({ ...base, friends: [{ uid: 'maya', at: at(4, 22, 30) }], theirSounds: (uid) => (uid === 'maya' ? ['dubstep'] : undefined) });
    expect(p.plur.done).toMatchObject({ festivalId: 'cc' });
    expect(p.wavelength.done).toMatchObject({ at: at(4, 22, 30), festivalId: 'cc' });
    // Their sound doesn't match, or no set on: not the same wavelength.
    expect(questProgress({ ...base, friends: [{ uid: 'maya', at: at(4, 22, 30) }], theirSounds: () => ['house'] }).wavelength.done).toBeUndefined();
    expect(questProgress({ ...base, friends: [{ uid: 'maya', at: at(4, 20) }], theirSounds: () => ['dubstep'] }).wavelength.done).toBeUndefined();
    // Met away from the festival: nothing.
    expect(questProgress({ ...base, friends: [{ uid: 'maya', at: at(1, 22) }] }).plur.done).toBeUndefined();
  });

  it('Festival fam counts friends at one festival', () => {
    const friends = [1, 2, 3, 4].map((i) => ({ uid: `u${i}`, at: at(4, 20, i) }));
    expect(questProgress({ ...base, friends }).fam).toEqual({ current: 4 });
    const five = questProgress({ ...base, friends: [...friends, { uid: 'u5', at: at(5, 1) }] }).fam;
    expect(five.done).toEqual({ at: at(5, 1), festivalId: 'cc' });
  });

  it('crew quests: squad of four on the night, in sync, looking out, beacon, stage hopper', () => {
    const crews = [{ id: 'k', festivalId: 'cc', members: ['me', 'b', 'c', 'd'] }];
    const updates = [
      update({ id: '1', uid: 'me', at: iso(at(4, 22)), stage: 'Main' }),
      update({ id: '2', uid: 'b', at: iso(at(4, 22, 20)), stage: 'main' }),
      update({ id: '3', uid: 'c', at: iso(at(4, 23)), care: 'help' }),
      update({ id: '4', uid: 'me', at: iso(at(4, 23, 5)), kind: 'reply', replyTo: '3', note: 'On my way' }),
      update({ id: '5', uid: 'me', at: iso(at(5, 0)), stage: 'Cove' }),
      update({ id: '6', uid: 'me', at: iso(at(5, 1)), stage: 'Tent' }),
    ];
    const p = questProgress({ ...base, crews, updates, spotsSetByMe: 1 });
    expect(p.crew4.done).toMatchObject({ festivalId: 'cc' });
    expect(p.sync.done).toEqual({ at: at(4, 22, 20), festivalId: 'cc' });
    expect(p.lookout.done).toMatchObject({ at: at(4, 23, 5) });
    expect(p.beacon.done).toBeTruthy();
    expect(p.stages.done).toEqual({ at: at(5, 1), festivalId: 'cc' });
    // Before the festival, a big crew is only progress.
    expect(questProgress({ ...base, crews, now: at(1, 12) }).crew4).toEqual({ current: 4 });
  });

  it('adventures: a sunrise moment, and a moment every night', () => {
    const m = (id: string, t: number): Memory => ({ id, file: `${id}.mov`, capturedAt: iso(t), addedAt: iso(t), festivalId: 'cc' });
    const p = questProgress({ ...base, memories: [m('1', at(4, 22)), m('2', at(6, 6, 10))] });
    expect(p.sunrise.done).toEqual({ at: at(6, 6, 10), festivalId: 'cc' });
    expect(p.everynight.done).toEqual({ at: at(6, 6, 10), festivalId: 'cc' });
    expect(questProgress({ ...base, memories: [m('1', at(4, 22))] }).everynight).toEqual({ current: 1 });
  });

  it('keeps done quests in the log, lists them as badges, and says what is still open', () => {
    const p = questProgress({ ...base, friends: [{ uid: 'maya', at: at(4, 22, 30) }] });
    const fresh = newlyDone(p, {});
    expect(fresh.map(([id]) => id)).toEqual(['plur']);
    const log = cleanQuestLog({ plur: fresh[0][1], nope: { at: 1 }, sync: { at: 'x' } });
    expect(Object.keys(log)).toEqual(['plur']);
    expect(newlyDone(p, log)).toEqual([]);
    const badges = questBadges(p, log);
    expect(badges[0]).toMatchObject({ id: 'plur', earned: true, quest: true });
    expect(badges).toHaveLength(QUESTS.length);
    expect(openQuests(log, 2).map((q) => q.id)).toEqual(['wavelength', 'fam']);
  });
});
