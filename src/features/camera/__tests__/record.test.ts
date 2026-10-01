import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import { elapsedLabel, filmingAt, HOLD_MS, IDLE, LOCK_DISTANCE, lockProgress, recordButton, recordProgress, RECORD_MAX_SEC, swipeOpens, type RecordState } from '../record';

const run = (events: [type: 'press-in' | 'press-out', at: number][]) => {
  let state: RecordState = IDLE;
  const actions: string[] = [];
  for (const [type, at] of events) {
    const r = recordButton(state, { type, at });
    state = r.state;
    if (r.action) actions.push(`${r.action}@${at}`);
  }
  return { state, actions };
};

describe('the record button', () => {
  it('hold: films while held, stops on release', () => {
    expect(run([['press-in', 0], ['press-out', HOLD_MS + 500]])).toEqual({ state: IDLE, actions: ['start@0', `stop@${HOLD_MS + 500}`] });
  });

  it('tap: starts, keeps going, and the next tap stops', () => {
    const tapped = run([['press-in', 0], ['press-out', 100]]);
    expect(tapped.actions).toEqual(['start@0']);
    expect(tapped.state).toMatchObject({ phase: 'recording', mode: 'tap' });
    expect(run([['press-in', 0], ['press-out', 100], ['press-in', 5000], ['press-out', 5100]]).actions).toEqual(['start@0', 'stop@5100']);
  });

  it('a stray release does nothing', () => {
    expect(run([['press-out', 0]])).toEqual({ state: IDLE, actions: [] });
  });

  it('fills the ring to the longest clip and reads the time', () => {
    expect(recordProgress(0)).toBe(0);
    expect(recordProgress(RECORD_MAX_SEC * 500)).toBe(0.5);
    expect(recordProgress(RECORD_MAX_SEC * 2000)).toBe(1);
    expect(elapsedLabel(7_400)).toBe('0:07');
    expect(elapsedLabel(135_000)).toBe('2:15');
  });
});

describe('sliding to lock', () => {
  it('locks a held recording, which then keeps going after you let go until a tap', () => {
    let s: RecordState = recordButton(IDLE, { type: 'press-in', at: 0 }).state;
    s = recordButton(s, { type: 'lock', at: 200 }).state;
    expect(s).toMatchObject({ mode: 'locked' });
    // Letting go, even long after, keeps filming.
    const out = recordButton(s, { type: 'press-out', at: 5000 });
    expect(out.action).toBeUndefined();
    s = recordButton(out.state, { type: 'press-in', at: 8000 }).state;
    expect(recordButton(s, { type: 'press-out', at: 8100 })).toEqual({ state: IDLE, action: 'stop' });
  });

  it('only locks while holding', () => {
    expect(recordButton(IDLE, { type: 'lock', at: 0 })).toEqual({ state: IDLE });
    const tapped = recordButton(recordButton(IDLE, { type: 'press-in', at: 0 }).state, { type: 'press-out', at: 100 }).state;
    expect(recordButton(tapped, { type: 'lock', at: 200 }).state).toBe(tapped);
  });

  it('counts a slide in any direction', () => {
    expect(lockProgress(0, 0)).toBe(0);
    expect(lockProgress(0, -LOCK_DISTANCE / 2)).toBeCloseTo(0.5);
    expect(lockProgress(-LOCK_DISTANCE, 0)).toBe(1);
    expect(lockProgress(LOCK_DISTANCE, LOCK_DISTANCE)).toBe(1);
  });
});

describe('swiping to the camera', () => {
  it('opens past a third of the screen, or with a quick flick', () => {
    expect(swipeOpens(150, 0, 390)).toBe(true);
    expect(swipeOpens(100, 0, 390)).toBe(false);
    expect(swipeOpens(60, 900, 390)).toBe(true);
    expect(swipeOpens(30, 900, 390)).toBe(false);
  });
});

describe('filming at', () => {
  const f = { id: 'cc', name: 'Cyclops Cove 4', dates: '', location: '', lineup: [], days: ['Friday', 'Saturday', 'Sunday'], stages: [], startDate: '2026-12-04', endDate: '2026-12-06' } as Festival;
  it('names a festival you’re going to that’s on now, with its night', () => {
    expect(filmingAt([f], ['cc'], new Date(2026, 11, 5, 22))).toBe('Cyclops Cove 4 · Saturday');
    expect(filmingAt([f], [], new Date(2026, 11, 5, 22))).toBeUndefined();
    expect(filmingAt([f], ['cc'], new Date(2026, 10, 5, 22))).toBeUndefined();
  });
});
