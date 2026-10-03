import { describe, expect, it } from '@jest/globals';
import { cleanCare, EMPTY_CARE, type Care } from '../../care/care';
import { careReminders, FEEL_MAX, FEEL_UNGUIDED_MIN, feelReminders } from '../careReminders';

const at = (h: number, m = 0, day = 5) => new Date(2026, 11, day, h, m);

describe('water reminders', () => {
  it('come every so often from your last water, until 6 AM, only when on and a festival is on', () => {
    const care: Care = { ...EMPTY_CARE, waterEvery: 60, log: [{ kind: 'water', at: at(21, 30).getTime() }] };
    const list = careReminders(care, 'cc4', at(22));
    expect(list[0].at).toEqual(at(22, 30));
    expect(list[list.length - 1].at.getTime()).toBeLessThanOrEqual(at(6, 0, 6).getTime());
    expect(list.map((r) => r.at.getHours())).toEqual([22, 23, 0, 1, 2, 3, 4, 5]);
    expect(list[0]).toMatchObject({ title: 'Time for some water?', href: '/care', festivalId: 'cc4' });
    expect(list[0].id.startsWith('afterglow-remind:care:water:cc4:')).toBe(true);
    // Off, or no festival on: none.
    expect(careReminders({ ...care, waterEvery: undefined }, 'cc4', at(22))).toEqual([]);
    expect(careReminders(care, undefined, at(22))).toEqual([]);
  });

  it('keeps a steady beat when there is no water tonight, never sooner than a few minutes away', () => {
    const list = careReminders({ ...EMPTY_CARE, waterEvery: 45 }, 'cc4', at(23));
    // Every 45 min from noon: 11:15 PM is the next.
    expect(list[0].at).toEqual(at(23, 15));
    // Working it out again a little later (after logging food, say) moves nothing.
    expect(careReminders({ ...EMPTY_CARE, waterEvery: 45, log: [{ kind: 'food', at: at(23, 2).getTime() }] }, 'cc4', at(23, 3)).map((r) => r.id)).toEqual(list.map((r) => r.id));
    expect(careReminders({ ...EMPTY_CARE, waterEvery: 45 }, 'cc4', at(23, 12))[0].at).toEqual(at(0, 0, 6));
    const late = careReminders({ ...EMPTY_CARE, waterEvery: 45, log: [{ kind: 'water', at: at(21).getTime() }] }, 'cc4', at(23));
    expect(late[0].at.getTime()).toBeGreaterThan(at(23).getTime());
  });

  it('keeps only a valid choice when read back', () => {
    expect(cleanCare({ timers: [], log: [], waterEvery: 60 }, Date.now()).waterEvery).toBe(60);
    expect(cleanCare({ timers: [], log: [], waterEvery: 7 }, Date.now()).waterEvery).toBeUndefined();
  });
});

describe('“How are you feeling?” reminders', () => {
  const started = at(22).getTime();
  const mdma: Care = { ...EMPTY_CARE, feelEvery: 45, timers: [{ id: 't', label: 'MDMA / molly', startedAt: started, guide: 'mdma' }] };

  it('come while a stopwatch runs, until it should have worn off, and say nothing private', () => {
    const list = feelReminders(mdma, at(22, 10));
    expect(list[0].at).toEqual(at(22, 45));
    // MDMA usually wears off by 6 h: none after 4 AM.
    expect(list[list.length - 1].at.getTime()).toBeLessThanOrEqual(at(4, 0, 6).getTime());
    expect(list.length).toBeLessThanOrEqual(FEEL_MAX);
    expect(list[0]).toMatchObject({ title: 'How are you feeling?', href: '/care?part=feelings' });
    expect(JSON.stringify(list)).not.toMatch(/MDMA|molly/i);
    expect(list[0].id.startsWith('afterglow-remind:care:feel:')).toBe(true);
  });

  it('start again from each check-in, and stop with the stopwatches', () => {
    const checked: Care = { ...mdma, log: [{ kind: 'checkin', mood: 'good', at: at(22, 40).getTime() }] };
    expect(feelReminders(checked, at(22, 41))[0].at).toEqual(at(23, 25));
    expect(feelReminders({ ...mdma, timers: [] }, at(22, 10))).toEqual([]);
    expect(feelReminders({ ...mdma, feelEvery: undefined }, at(22, 10))).toEqual([]);
    // Something not in the guide: for 6 hours.
    const own = feelReminders({ ...EMPTY_CARE, feelEvery: 60, timers: [{ id: 'o', label: 'Something', startedAt: started }] }, at(22, 10));
    expect(own[own.length - 1].at.getTime()).toBeLessThanOrEqual(started + FEEL_UNGUIDED_MIN * 60_000);
  });

  it('is kept when read back, and only as one of the choices', () => {
    expect(cleanCare({ feelEvery: 30 }, at(22).getTime()).feelEvery).toBe(30);
    expect(cleanCare({ feelEvery: 7 }, at(22).getTime()).feelEvery).toBeUndefined();
  });
});
