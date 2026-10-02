import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { cleanMode, festivalMode, leave, NO_MODE, PREVIEW_MS, testFestival, withChoice, withPreview } from '../mode';

const fest = (id: string, over: Partial<Festival> = {}): Festival =>
  ({ id, name: id.toUpperCase(), dates: '', location: '', lineup: ['a', 'b'], days: ['Friday', 'Saturday'], stages: [], ...over }) as Festival;

describe('festival mode', () => {
  const cc = fest('cc');
  const now = Date.parse('2026-12-05T22:00:00');

  it('asks on a festival night, then stays on for that festival', () => {
    const tonight = { festival: cc, night: 'Saturday' };
    expect(festivalMode(NO_MODE, tonight, [cc], now)).toEqual({ ask: cc });
    const on = withChoice(NO_MODE, 'cc', 'on');
    expect(festivalMode(on, tonight, [cc], now).active).toEqual({ festival: cc, night: 'Saturday', preview: false });
    // Not on any more once the festival is over (no tonight), and nothing asked.
    expect(festivalMode(on, undefined, [cc], now)).toEqual({});
    // Not now: neither on nor asked again.
    expect(festivalMode(withChoice(NO_MODE, 'cc', 'off'), tonight, [cc], now)).toEqual({});
  });

  it('leaving on the night says no to that festival', () => {
    const on = withChoice(NO_MODE, 'cc', 'on');
    const active = festivalMode(on, { festival: cc, night: 'Saturday' }, [cc], now).active;
    expect(leave(on, active).choices.cc).toBe('off');
  });

  it('a test works any day, shows the first night, and ends by itself', () => {
    const t = withPreview(NO_MODE, 'cc', now);
    expect(festivalMode(t, undefined, [cc], now).active).toEqual({ festival: cc, night: 'Friday', preview: true });
    expect(festivalMode(t, undefined, [cc], now + PREVIEW_MS + 1)).toEqual({});
    // Ending a test keeps your answers.
    const both = withPreview(withChoice(NO_MODE, 'x', 'off'), 'cc', now);
    expect(leave(both, festivalMode(both, undefined, [cc], now).active)).toEqual({ choices: { x: 'off' } });
    // A real festival night wins over a test.
    expect(festivalMode({ ...withChoice(NO_MODE, 'cc', 'on'), preview: { festivalId: 'other', until: now + 1000 } }, { festival: cc }, [cc], now).active?.preview).toBe(false);
  });

  it('reads saved answers back safely', () => {
    expect(cleanMode({ choices: { a: 'on', b: 'maybe' }, preview: { festivalId: 'cc', until: now + 5 } }, now)).toEqual({
      choices: { a: 'on' },
      preview: { festivalId: 'cc', until: now + 5 },
    });
    expect(cleanMode({ preview: { festivalId: 'cc', until: now - 5 } }, now)).toEqual({ choices: {} });
    expect(cleanMode('junk', now)).toEqual({ choices: {} });
  });

  it('tests with a festival you’re going to, else one with set times, else the soonest', () => {
    const today = new Date('2026-10-02T12:00:00');
    const past = fest('past', { startDate: '2026-01-01', endDate: '2026-01-02' });
    const soon = fest('soon', { startDate: '2026-11-01', endDate: '2026-11-02' });
    const withSets = fest('sets', { startDate: '2026-12-01', endDate: '2026-12-02', sets: [{ artistId: 'a', day: 'Friday', stageId: 'x', start: '22:00', end: '23:00' }] as unknown as Festival['sets'] });
    const mine = fest('mine', { startDate: '2027-03-01', endDate: '2027-03-02' });
    expect(testFestival([past, soon, withSets, mine], ['mine', 'past'], today)?.id).toBe('mine');
    expect(testFestival([past, soon, withSets, mine], [], today)?.id).toBe('sets');
    expect(testFestival([past, fest('plain', { startDate: '2026-11-05', days: ['Friday'] })], [], today)?.id).toBe('plain');
    expect(testFestival([], [], today)).toBeUndefined();
  });
});
