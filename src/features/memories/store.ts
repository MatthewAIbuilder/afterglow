import type { Memory, MemoryTagInput } from './models';

/**
 * The list of memories and how it changes. Pure, so the rules are tested
 * apart from storage: newest first, ids never repeat, a tag change only
 * touches tag fields, and anything unreadable in saved data is dropped.
 */
export function addMemory(list: Memory[], m: Memory): Memory[] {
  return [m, ...list.filter((x) => x.id !== m.id)];
}

export function tagMemory(list: Memory[], id: string, tag: MemoryTagInput): Memory[] {
  return list.map((m) => (m.id === id ? { ...m, festivalId: tag.festivalId, night: tag.festivalId ? tag.night : undefined, artistId: tag.artistId } : m));
}

export function markShared(list: Memory[], id: string, sharedId: string | undefined): Memory[] {
  return list.map((m) => (m.id === id ? { ...m, sharedId } : m));
}

export function removeMemory(list: Memory[], id: string): Memory[] {
  return list.filter((m) => m.id !== id);
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);
/** A safe file name: letters, digits, dot, dash and underscore only (never a path). */
export const safeFileName = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9._-]{1,120}$/.test(v) && !v.startsWith('.') ? v : undefined);

/** Saved memories read back: bad records dropped, unknown fields ignored, never a path outside the memories folder. */
export function cleanMemories(raw: unknown): Memory[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Memory[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = str(o.id);
    const file = safeFileName(o.file);
    const capturedAt = str(o.capturedAt);
    if (!id || !file || !capturedAt || seen.has(id) || !Number.isFinite(Date.parse(capturedAt))) continue;
    seen.add(id);
    const place = o.place && typeof o.place === 'object' ? (o.place as Record<string, unknown>) : undefined;
    out.push({
      id,
      file,
      thumb: safeFileName(o.thumb),
      capturedAt,
      addedAt: str(o.addedAt) ?? capturedAt,
      durationSec: num(o.durationSec),
      width: num(o.width),
      height: num(o.height),
      place: place && (str(place.city) || str(place.region)) ? { city: str(place.city), region: str(place.region) } : undefined,
      festivalId: str(o.festivalId),
      night: str(o.night),
      artistId: str(o.artistId),
      sharedId: str(o.sharedId),
    });
  }
  return out;
}

/** A new id: time plus randomness, safe as a file name. */
export function newMemoryId(now: number, random: () => number = Math.random): string {
  return `m${now.toString(36)}${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`;
}
