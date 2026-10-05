import { describe, expect, it } from '@jest/globals';
import type { Memory } from '../models';
import { memoryIdTime, newMemoryId, ORPHAN_MIN_AGE_MS, orphanFiles } from '../store';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const mem = (id: string, file = `${id}.mov`, thumb?: string): Memory => ({ id, file, thumb, capturedAt: '2026-10-01T20:00:00Z', addedAt: '2026-10-01T20:00:00Z' });

describe('tidying the memories folder', () => {
  it('reads when an id was made, and nothing from other names', () => {
    expect(memoryIdTime(newMemoryId(NOW))).toBe(NOW);
    expect(memoryIdTime('orphan')).toBeUndefined();
    expect(memoryIdTime('a')).toBeUndefined();
  });

  it('only takes files nobody points to that are more than a day old', () => {
    const old = newMemoryId(NOW - ORPHAN_MIN_AGE_MS - 60_000);
    const young = newMemoryId(NOW - 60_000);
    const kept = newMemoryId(NOW - 5 * ORPHAN_MIN_AGE_MS);
    const names = [`${old}.mov`, `${old}.jpg`, `${young}.mov`, `${kept}.mov`, `${kept}.jpg`, 'holiday.mp4'];
    expect(orphanFiles(names, [mem(kept)], NOW)).toEqual([`${old}.mov`, `${old}.jpg`]);
  });

  it('never takes a file whose name is a memory’s id, even when the memory points elsewhere', () => {
    const id = newMemoryId(NOW - 5 * ORPHAN_MIN_AGE_MS);
    expect(orphanFiles([`${id}.mp4`, `${id}.jpg`], [mem(id, `${id}.mov`)], NOW)).toEqual([]);
  });
});
