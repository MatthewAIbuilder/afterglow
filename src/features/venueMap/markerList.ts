import { LABEL_MAX, PIN_KINDS, PINS_MAX, type Pin, type PinKind } from './venueMap';

/**
 * A pasted list of markers for a venue map (HQ → Festival maps). The list says
 * how big the picture it was measured on is, so it still lands in the right
 * places if the picture uploaded is a different size. Pure.
 *
 * { "width": 1206, "height": 1520, "pins": [{ "kind": "medical", "label": "First aid", "x": 541, "y": 737 }] }
 */
export type MarkerListResult = { pins: Pin[]; skipped: number } | { error: string };

export function parseMarkerList(text: string, picture: { width: number; height: number }, existing: number, newId: (i: number) => string): MarkerListResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'That isn’t a marker list. Paste the whole list, starting with { and ending with }.' };
  }
  const o = raw as { width?: unknown; height?: unknown; pins?: unknown } | null;
  const w = o?.width;
  const h = o?.height;
  if (!o || typeof w !== 'number' || typeof h !== 'number' || !(w > 0) || !(h > 0) || !Array.isArray(o.pins)) {
    return { error: 'The list needs a width, a height and a list of pins.' };
  }
  const sx = picture.width / w;
  const sy = picture.height / h;
  const room = Math.max(0, PINS_MAX - existing);
  const pins: Pin[] = [];
  let skipped = 0;
  for (const p of o.pins) {
    const x = (p as { x?: unknown })?.x;
    const y = (p as { y?: unknown })?.y;
    const kind = (p as { kind?: unknown })?.kind;
    const label = (p as { label?: unknown })?.label;
    if (!(PIN_KINDS as readonly string[]).includes(kind as string) || typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > w || y > h) {
      skipped++;
      continue;
    }
    if (pins.length >= room) {
      skipped++;
      continue;
    }
    pins.push({
      id: newId(pins.length),
      kind: kind as PinKind,
      label: typeof label === 'string' ? label.trim().slice(0, LABEL_MAX) : '',
      x: Math.round(x * sx),
      y: Math.round(y * sy),
    });
  }
  return pins.length ? { pins, skipped } : { error: 'No usable markers in that list.' };
}
