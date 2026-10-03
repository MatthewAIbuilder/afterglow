import { describe, expect, it } from '@jest/globals';
import { clampOffset, cropRect, fillScale, frameFor, MAX_ZOOM, maxOffset } from '../crop';

const tall = { width: 3000, height: 4000 };
const square = { width: 300, height: 300 };

describe('photo framing', () => {
  it('fills the frame at zoom 1', () => {
    expect(fillScale(tall, square)).toBeCloseTo(0.1);
    expect(cropRect(tall, square, 1, { x: 0, y: 0 })).toEqual({ originX: 0, originY: 500, width: 3000, height: 3000 });
  });

  it('never leaves an empty edge, however far you drag', () => {
    expect(maxOffset(tall, square, 1)).toEqual({ x: 0, y: 50 });
    expect(clampOffset({ x: 999, y: -999 }, tall, square, 1)).toEqual({ x: 0, y: -50 });
    // Dragged down as far as it goes: the top of the photo.
    expect(cropRect(tall, square, 1, { x: 0, y: 999 }).originY).toBe(0);
    expect(cropRect(tall, square, 1, { x: 0, y: -999 }).originY).toBe(1000);
  });

  it('zooms into the middle, and moves with the photo', () => {
    expect(cropRect(tall, square, 2, { x: 0, y: 0 })).toEqual({ originX: 750, originY: 1250, width: 1500, height: 1500 });
    // Dragging the photo right shows more of its left side.
    expect(cropRect(tall, square, 2, { x: 100, y: 0 }).originX).toBe(250);
  });

  it('keeps zoom between 1 and the most', () => {
    expect(cropRect(tall, square, 0.2, { x: 0, y: 0 }).width).toBe(3000);
    expect(cropRect(tall, square, 99, { x: 0, y: 0 }).width).toBe(Math.round(3000 / MAX_ZOOM));
  });

  it('crops a wide cover from a tall photo inside its bounds', () => {
    const frame = frameFor('cover', { width: 390, height: 700 });
    expect(frame.width / frame.height).toBeCloseTo(16 / 9);
    const r = cropRect(tall, frame, 1, { x: 0, y: -10_000 });
    expect(r.width).toBe(3000);
    expect(r.height).toBe(Math.round(3000 * 9 / 16));
    expect(r.originY + r.height).toBeLessThanOrEqual(4000);
  });

  it('fits the round frame to the narrower side', () => {
    expect(frameFor('avatar', { width: 390, height: 300 })).toEqual({ width: 252, height: 252 });
  });
});
