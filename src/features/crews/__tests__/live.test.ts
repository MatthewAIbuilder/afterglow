import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/types';
import { crewmatesNear, shareUntil, worthSending } from '../live';

const now = new Date(2026, 10, 7, 22, 0).getTime();

describe('crew on the map', () => {
  it('sends a new spot after moving or a while, never more than once a minute', () => {
    const last = { at: now, lat: 28.5, lon: -81.4 };
    expect(worthSending(undefined, last, now)).toBe(true);
    expect(worthSending(last, { lat: 28.5005, lon: -81.4 }, now + 30_000)).toBe(false);
    expect(worthSending(last, { lat: 28.5005, lon: -81.4 }, now + 61_000)).toBe(true);
    expect(worthSending(last, { lat: 28.50001, lon: -81.4 }, now + 61_000)).toBe(false);
    expect(worthSending(last, last, now + 5 * 60_000)).toBe(true);
  });

  it('lists crewmates nearest first, old spots last, never you or anyone past their end', () => {
    const at = (min: number) => new Date(now - min * 60_000).toISOString();
    const list = crewmatesNear(
      [
        { uid: 'far', lat: 28.51, lon: -81.4, at: at(2), until: now + 3600_000 },
        { uid: 'near', lat: 28.5009, lon: -81.4, at: at(1), until: now + 3600_000 },
        { uid: 'old', lat: 28.5001, lon: -81.4, at: at(40), until: now + 3600_000 },
        { uid: 'me', lat: 28.5, lon: -81.4, at: at(0), until: now + 3600_000 },
        { uid: 'done', lat: 28.5, lon: -81.4, at: at(0), until: now - 1 },
      ],
      'me',
      { lat: 28.5, lon: -81.4 },
      now,
    );
    expect(list.map((m) => m.uid)).toEqual(['near', 'far', 'old']);
    expect(Math.round(list[0].meters!)).toBe(100);
    expect(list[0].direction).toBe('north');
    expect(list[2].stale).toBe(true);
  });

  it('only while the festival is on, until the morning after', () => {
    const f = { id: 'f', name: 'F', dates: '', location: '', lineup: [], days: ['Friday', 'Saturday', 'Sunday'], stages: [], startDate: '2026-11-06', endDate: '2026-11-08' } as Festival;
    expect(new Date(shareUntil(f, new Date(now))!).toString()).toBe(new Date(2026, 10, 9, 7).toString());
    expect(shareUntil(f, new Date(2026, 10, 1, 12))).toBeUndefined();
  });
});
