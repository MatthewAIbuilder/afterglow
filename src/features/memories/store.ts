import type { Memory, MemoryTagInput } from './models';
import { cleanPast } from './past';
import { cleanShow } from './show';
import { cleanWith } from './b2b';
import { cleanClip } from './trim';

/**
 * The list of memories and how it changes. Pure, so the rules are tested
 * apart from storage: newest first, ids never repeat, a tag change only
 * touches tag fields, and anything unreadable in saved data is dropped.
 */
export function addMemory(list: Memory[], m: Memory): Memory[] {
  return [m, ...list.filter((x) => x.id !== m.id)];
}

export function tagMemory(list: Memory[], id: string, tag: MemoryTagInput): Memory[] {
  // A festival on Afterglow, a past one or a one-night show: only one. The trim stays unless the tag says otherwise.
  return list.map((m) =>
    m.id === id
      ? {
          ...m,
          festivalId: tag.festivalId,
          night: tag.festivalId ? tag.night : undefined,
          past: tag.festivalId ? undefined : tag.past,
          show: tag.festivalId || tag.past ? undefined : tag.show,
          artistId: tag.artistId,
          withArtistIds: tag.artistId ? cleanWith(tag.withArtistIds, tag.artistId) : undefined,
          clip: 'clip' in tag ? tag.clip : m.clip,
        }
      : m,
  );
}

export function markShared(list: Memory[], id: string, shared: { id: string; by: string } | undefined): Memory[] {
  return list.map((m) => (m.id === id ? { ...m, sharedId: shared?.id, sharedBy: shared?.by } : m));
}

/** Forget every share made from one account (it was deleted). */
export function forgetSharesBy(list: Memory[], uid: string): Memory[] {
  return list.map((m) => (m.sharedBy === uid ? { ...m, sharedId: undefined, sharedBy: undefined } : m));
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
      past: str(o.festivalId) ? undefined : cleanPast(o.past),
      show: str(o.festivalId) || cleanPast(o.past) ? undefined : cleanShow(o.show),
      clip: cleanClip(o.clip),
      night: str(o.night),
      artistId: str(o.artistId),
      withArtistIds: str(o.artistId) ? cleanWith(o.withArtistIds, str(o.artistId)) : undefined,
      sharedId: str(o.sharedId) && str(o.sharedBy) ? str(o.sharedId) : undefined,
      sharedBy: str(o.sharedId) && str(o.sharedBy) ? str(o.sharedBy) : undefined,
    });
  }
  return out;
}

/** A new id: time plus randomness, safe as a file name. */
export function newMemoryId(now: number, random: () => number = Math.random): string {
  return `m${now.toString(36)}${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`;
}

/** A file nobody points to is only tidied away once it's at least this old (it may be a video being kept right now). */
export const ORPHAN_MIN_AGE_MS = 24 * 3600_000;

/** When a memory id (`newMemoryId`) was made; undefined for any other name. */
export function memoryIdTime(id: string): number | undefined {
  const m = /^m([0-9a-z]+)[0-9a-z]{6}$/.exec(id);
  if (!m) return undefined;
  const t = parseInt(m[1], 36);
  return Number.isFinite(t) && t > 0 ? t : undefined;
}

/**
 * Files in the memories folder that can safely go: no memory points to them
 * (by name, or by sharing a memory's id), and their name says they were made
 * more than `ORPHAN_MIN_AGE_MS` ago. A name that doesn't say when is kept.
 * Called only with a list that read back whole.
 */
export function orphanFiles(names: string[], memories: Memory[], now: number): string[] {
  const used = new Set(memories.flatMap((m) => [m.file, m.thumb]));
  const ids = new Set(memories.map((m) => m.id));
  return names.filter((n) => {
    if (used.has(n)) return false;
    const stem = n.replace(/\..*$/, '');
    if (ids.has(stem)) return false;
    const t = memoryIdTime(stem);
    return t !== undefined && now - t > ORPHAN_MIN_AGE_MS;
  });
}
