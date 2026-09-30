import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../../data/bundled';
import type { Memory } from '../models';
import { clipCount, memoryLine, organizeMemories, UNTAGGED } from '../organize';
import { addMemory, cleanMemories, markShared, newMemoryId, removeMemory, safeFileName, tagMemory } from '../store';

/** Memories arranged festival → night → artist, and the list's rules. */
const catalog = BUILT_IN.catalog;
const lookup = { festival: catalog.festival, artist: catalog.artist };
const mem = (id: string, over: Partial<Memory> = {}): Memory => ({ id, file: `${id}.mp4`, capturedAt: '2026-06-19T23:00:00.000Z', addedAt: '2026-06-20T10:00:00.000Z', ...over });

describe('organizing memories', () => {
  const list = [
    mem('a', { festivalId: 'solstice-26', night: 'Saturday', artistId: 'levity', capturedAt: '2026-06-20T22:40:00.000Z' }),
    mem('b', { festivalId: 'solstice-26', night: 'Friday', artistId: 'illenium', capturedAt: '2026-06-19T23:50:00.000Z' }),
    mem('c', { festivalId: 'solstice-26', night: 'Friday', artistId: 'tape-b', capturedAt: '2026-06-19T22:10:00.000Z' }),
    mem('d', { festivalId: 'solstice-26', night: 'Friday', artistId: 'illenium', capturedAt: '2026-06-19T23:55:00.000Z' }),
    mem('e', { festivalId: 'cyclops-cove-4', capturedAt: '2026-12-05T03:00:00.000Z' }),
    mem('f'),
  ];
  const sections = organizeMemories(list, lookup);

  it('untagged first, then festivals most recent first', () => {
    expect(sections.map((s) => s.key)).toEqual([UNTAGGED, 'cyclops-cove-4', 'solstice-26']);
    expect(sections[0]).toMatchObject({ title: 'Not tagged yet', count: 1 });
  });

  it('nights in festival order, artists in the order you filmed them, clips in order', () => {
    const sol = sections.find((s) => s.key === 'solstice-26')!;
    expect(sol.count).toBe(4);
    expect(sol.nights.map((n) => n.night)).toEqual(['Friday', 'Saturday']);
    const friday = sol.nights[0].groups;
    expect(friday.map((g) => g.title)).toEqual(['TAPE B', 'ILLENIUM']);
    expect(friday[1].memories.map((m) => m.id)).toEqual(['b', 'd']);
  });

  it('a festival without a night or artist still groups under it', () => {
    const cc = sections.find((s) => s.key === 'cyclops-cove-4')!;
    expect(cc.nights).toHaveLength(1);
    expect(cc.nights[0].night).toBeUndefined();
    expect(cc.nights[0].groups[0].title).toBe('Artist not tagged');
  });

  it('memories of a festival that left the catalogue count as untagged, never lost', () => {
    const gone = organizeMemories([mem('x', { festivalId: 'no-such-festival' })], lookup);
    expect(gone.map((s) => s.key)).toEqual([UNTAGGED]);
  });

  it('reads plainly', () => {
    expect(clipCount(1)).toBe('1 clip');
    expect(clipCount(3)).toBe('3 clips');
    expect(memoryLine(list[0], lookup)).toBe('LEVITY · Saturday · Solstice 2026');
    expect(memoryLine(list[5], lookup)).toBe('Not tagged yet');
  });
});

describe('the memories list', () => {
  it('adds newest first, tags, marks shared and removes', () => {
    let l = addMemory([], mem('a'));
    l = addMemory(l, mem('b'));
    expect(l.map((m) => m.id)).toEqual(['b', 'a']);
    l = tagMemory(l, 'a', { festivalId: 'solstice-26', night: 'Friday', artistId: 'illenium' });
    expect(l[1]).toMatchObject({ festivalId: 'solstice-26', night: 'Friday', artistId: 'illenium', file: 'a.mp4' });
    // Clearing the festival clears the night with it.
    expect(tagMemory(l, 'a', { festivalId: undefined, night: 'Friday', artistId: undefined })[1].night).toBeUndefined();
    l = markShared(l, 'a', 'shared-1');
    expect(l[1].sharedId).toBe('shared-1');
    expect(removeMemory(l, 'a').map((m) => m.id)).toEqual(['b']);
  });

  it('reads saved data defensively: no paths, no duplicates, no broken records', () => {
    const cleaned = cleanMemories([
      mem('ok', { place: { city: 'Orlando' } }),
      mem('ok'),
      { ...mem('path'), file: '../../secrets.db' },
      { ...mem('abs'), file: '/var/mobile/x.mp4' },
      { id: 'nodate', file: 'x.mp4' },
      { ...mem('baddate'), capturedAt: 'yesterday' },
      null,
      'junk',
    ]);
    expect(cleaned.map((m) => m.id)).toEqual(['ok']);
    expect(cleaned[0].place).toEqual({ city: 'Orlando', region: undefined });
    expect(cleanMemories('nope')).toEqual([]);
  });

  it('never keeps coordinates, only place names', () => {
    const [m] = cleanMemories([{ ...mem('g'), place: { city: 'Austin', lat: 30.26, lng: -97.74 } }]);
    expect(m.place).toEqual({ city: 'Austin', region: undefined });
  });

  it('makes safe, unique ids and file names', () => {
    const a = newMemoryId(1_800_000_000_000, () => 0.1);
    const b = newMemoryId(1_800_000_000_000, () => 0.2);
    expect(a).not.toBe(b);
    expect(safeFileName(`${a}.mp4`)).toBe(`${a}.mp4`);
    expect(safeFileName('.hidden')).toBeUndefined();
    expect(safeFileName('a/b.mp4')).toBeUndefined();
  });
});
