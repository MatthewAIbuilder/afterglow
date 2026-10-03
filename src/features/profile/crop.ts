/**
 * Framing a photo before it's uploaded: the picture fills the frame at its
 * smallest, can be zoomed up to `MAX_ZOOM` times and moved, but never so far
 * that the frame shows an empty edge. Pure, so it can be tested.
 */

export type Size = { width: number; height: number };
export type Offset = { x: number; y: number };
export type CropRect = { originX: number; originY: number; width: number; height: number };

export const MAX_ZOOM = 4;
/** What each kind of photo is cropped to, and how big it's saved. */
export const CROP_SHAPES = {
  avatar: { aspect: 1, round: true, outWidth: 640 },
  cover: { aspect: 16 / 9, round: false, outWidth: 1600 },
} as const;
export type CropShape = keyof typeof CROP_SHAPES;

/** The scale at which the picture just covers the frame (zoom 1). */
export function fillScale(image: Size, frame: Size): number {
  if (image.width <= 0 || image.height <= 0) return 1;
  return Math.max(frame.width / image.width, frame.height / image.height);
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(1, Number.isFinite(zoom) ? zoom : 1));
}

/** How far the picture may move from centre at this zoom, so the frame stays covered. */
export function maxOffset(image: Size, frame: Size, zoom: number): Offset {
  const s = fillScale(image, frame) * clampZoom(zoom);
  return { x: Math.max(0, (image.width * s - frame.width) / 2), y: Math.max(0, (image.height * s - frame.height) / 2) };
}

export function clampOffset(offset: Offset, image: Size, frame: Size, zoom: number): Offset {
  const m = maxOffset(image, frame, zoom);
  const c = (v: number, lim: number) => Math.min(lim, Math.max(-lim, Number.isFinite(v) ? v : 0));
  return { x: c(offset.x, m.x), y: c(offset.y, m.y) };
}

/** The part of the original picture inside the frame, in the picture's own pixels. */
export function cropRect(image: Size, frame: Size, zoom: number, offset: Offset): CropRect {
  const z = clampZoom(zoom);
  const s = fillScale(image, frame) * z;
  const o = clampOffset(offset, image, frame, z);
  const width = Math.min(image.width, Math.round(frame.width / s));
  const height = Math.min(image.height, Math.round(frame.height / s));
  const left = (image.width * s - frame.width) / 2 - o.x;
  const top = (image.height * s - frame.height) / 2 - o.y;
  const originX = Math.min(image.width - width, Math.max(0, Math.round(left / s)));
  const originY = Math.min(image.height - height, Math.max(0, Math.round(top / s)));
  return { originX, originY, width, height };
}

/** The frame that fits a space, keeping the shape's aspect and a margin. */
export function frameFor(shape: CropShape, space: Size, margin = 24): Size {
  const { aspect } = CROP_SHAPES[shape];
  const w = Math.max(0, space.width - margin * 2);
  const h = Math.max(0, space.height - margin * 2);
  return w / aspect <= h ? { width: w, height: w / aspect } : { width: h * aspect, height: h };
}
