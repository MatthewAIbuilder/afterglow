import { describe, expect, it } from '@jest/globals';
import { parseMarkerList } from '../markerList';
import { LABEL_MAX, PINS_MAX } from '../venueMap';

const id = (i: number) => `m${i}`;
const list = (pins: unknown[], width = 1000, height = 500) => JSON.stringify({ width, height, pins });

describe('parseMarkerList', () => {
  it('scales the spots to the picture that was uploaded', () => {
    const r = parseMarkerList(list([{ kind: 'water', label: ' Water ', x: 500, y: 250 }]), { width: 2000, height: 1000 }, 0, id);
    expect(r).toEqual({ pins: [{ id: 'm0', kind: 'water', label: 'Water', x: 1000, y: 500 }], skipped: 0 });
  });

  it('skips unknown kinds and spots off the picture', () => {
    const r = parseMarkerList(
      list([{ kind: 'ferris-wheel', x: 1, y: 1 }, { kind: 'food', x: 2000, y: 1 }, { kind: 'food', x: 'a', y: 1 }, { kind: 'food', x: 10, y: 10 }]),
      { width: 1000, height: 500 },
      0,
      id,
    );
    expect(r).toEqual({ pins: [{ id: 'm0', kind: 'food', label: '', x: 10, y: 10 }], skipped: 3 });
  });

  it('keeps labels short and stops at the most a map can hold', () => {
    const long = 'x'.repeat(LABEL_MAX + 20);
    const many = Array.from({ length: 5 }, () => ({ kind: 'info', label: long, x: 5, y: 5 }));
    const r = parseMarkerList(list(many), { width: 1000, height: 500 }, PINS_MAX - 2, id);
    if ('error' in r) throw new Error(r.error);
    expect(r.pins).toHaveLength(2);
    expect(r.skipped).toBe(3);
    expect(r.pins[0].label).toHaveLength(LABEL_MAX);
  });

  it('says what is wrong with a list that is not one', () => {
    expect('error' in parseMarkerList('hello', { width: 1, height: 1 }, 0, id)).toBe(true);
    expect('error' in parseMarkerList('{"pins":[]}', { width: 1, height: 1 }, 0, id)).toBe(true);
    expect('error' in parseMarkerList(list([]), { width: 1, height: 1 }, 0, id)).toBe(true);
  });
});
