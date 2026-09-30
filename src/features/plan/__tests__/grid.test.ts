import { describe, expect, it } from '@jest/globals';
import { MOCK_CATALOG } from '../../../data/mock';
import { gridDay, hourLabel } from '../grid';
import { festivalRoute } from '../route';

const solstice = MOCK_CATALOG.festival('solstice-26')!;
const artist = MOCK_CATALOG.artist;

describe('the timetable grid', () => {
  it('lays out a day: stages in order, whole hours, every set in its column', () => {
    const taste = { illenium: 0.95, subtronics: 0.8, 'tape-b': 0.5 };
    const informed = { illenium: true, subtronics: true, 'tape-b': true };
    const pinned = new Set(['subtronics']);
    const route = festivalRoute({ festival: solstice, artists: MOCK_CATALOG.artists, taste, informed, pinned }).find((r) => r.day === 'Friday');
    const g = gridDay(solstice, 'Friday', { artist, taste, informed, pinned, route })!;
    expect(g.stages.map((s) => s.name)).toEqual(['Main Stage', 'Bass Tent', 'The Warehouse']);
    // 22:00 to 01:30 -> 10 PM to 2 AM on the festival clock.
    expect(g.from).toBe(22 * 60);
    expect(g.to).toBe(26 * 60);
    expect(g.hours.map(hourLabel)).toEqual(['10 PM', '11 PM', '12 AM', '1 AM', '2 AM']);
    const by = (id: string) => g.blocks.find((b) => b.artist.id === id)!;
    expect(by('illenium')).toMatchObject({ column: 0, start: 23 * 60 + 40, end: 25 * 60 + 10, tone: 'strong' });
    expect(by('subtronics')).toMatchObject({ column: 1, pinned: true, tone: 'must', onRoute: true });
    expect(by('tape-b').tone).toBe('some');
    expect(by('sara-landry').tone).toBe('new');
    // Earliest first.
    expect(g.blocks[0].artist.id).toBe('tape-b');
  });

  it('has nothing for a day without sets', () => {
    expect(gridDay(solstice, 'Monday', { artist, taste: {}, informed: {}, pinned: new Set() })).toBeUndefined();
  });
});
