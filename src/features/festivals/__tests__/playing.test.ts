import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { playingList } from '../playing';

const fest = (id: string, start?: string): Festival => ({ id, name: id, dates: '', location: '', lineup: [], days: [], stages: [], startDate: start, endDate: start });

describe("an artist's festivals", () => {
  const festivals = [fest('far', '2026-11-01'), fest('near', '2026-12-01'), fest('old', '2026-01-01'), fest('older', '2025-01-01'), fest('mine', '2027-03-01'), fest('undated')];
  const today = new Date(2026, 9, 1);
  const km: Record<string, number> = { far: 3000, near: 80, mine: 2000 };

  it('puts yours first, then near you, then the soonest, and what is over last', () => {
    const list = playingList(festivals, { going: ['mine'], today, distanceTo: (f) => km[f.id], nearKm: 500 });
    expect(list.map((p) => p.festival.id)).toEqual(['mine', 'near', 'far', 'undated', 'old', 'older']);
    expect(list[1]).toMatchObject({ km: 80, going: false, over: false });
    expect(list.at(-1)!.over).toBe(true);
  });

  it('is soonest first without Near you', () => {
    expect(playingList(festivals, { going: [], today }).map((p) => p.festival.id)).toEqual(['far', 'near', 'mine', 'undated', 'old', 'older']);
  });
});
