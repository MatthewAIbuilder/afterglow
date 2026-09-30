import { type Catalog, createCatalog } from './catalog';
import type { ParsedFile } from './file';
import type { ArtistSimilarity, CatalogSnapshot } from './models';
import { validateSnapshot } from './validate';

/**
 * Put a second catalogue on top of a first. Records match by id and the
 * second one wins, so a file can correct a demo record as well as add new
 * ones. The second catalogue's records come first, so a festival you add is
 * the one Discover opens on. Pure.
 */
export function mergeSnapshots(base: CatalogSnapshot, top: CatalogSnapshot): CatalogSnapshot {
  const byId = <T extends { id: string }>(a: T[], b: T[]) => {
    const ids = new Set(b.map((x) => x.id));
    return [...b, ...a.filter((x) => !ids.has(x.id))];
  };
  const pair = (s: ArtistSimilarity) => [s.artistId, s.otherId].sort().join('|');
  const topPairs = new Set((top.similarities ?? []).map(pair));
  const similarities = [...(top.similarities ?? []), ...(base.similarities ?? []).filter((s) => !topPairs.has(pair(s)))];

  const merged: CatalogSnapshot = {
    artists: byId(base.artists, top.artists),
    festivals: byId(base.festivals, top.festivals),
    clips: byId(base.clips, top.clips),
  };
  const lineups = [...(top.lineups ?? []), ...(base.lineups ?? []).filter((l) => !top.lineups?.some((t) => t.festivalId === l.festivalId))];
  if (lineups.length) merged.lineups = lineups;
  if (similarities.length) merged.similarities = similarities;
  return merged;
}

/**
 * A file's photo list applied to the artists that have no photo of their
 * own (a photo set in the catalogue always wins). Pure.
 */
export function applyPhotos(
  snapshot: CatalogSnapshot,
  photos: Record<string, string> | undefined,
  credit?: string,
  colors?: Record<string, string>,
): CatalogSnapshot {
  if (!photos && !colors) return snapshot;
  let changed = false;
  const artists = snapshot.artists.map((a) => {
    let next = a;
    const url = photos?.[a.id];
    if (!a.imageUrl && url) next = credit ? { ...next, imageUrl: url, imageCredit: credit } : { ...next, imageUrl: url };
    // A colour belongs with the photo it came from: only for artists showing a photo, and never over one set in the catalogue.
    const c = colors?.[a.id];
    if (c && !a.color && next.imageUrl) next = { ...next, color: c };
    if (next !== a) changed = true;
    return next;
  });
  return changed ? { ...snapshot, artists } : snapshot;
}

/** snapshot: the checked data behind the catalogue, for building on further. */
export type Built = { catalog: Catalog; snapshot: CatalogSnapshot; problems: string[]; usedFile: boolean };

/**
 * The catalogue the app should show for a file: the file added to (or
 * replacing) the base, checked. A file that can't be used, or that would
 * leave the app with no festival to show, keeps the base as it is.
 */
export function buildCatalog(base: CatalogSnapshot, file: ParsedFile | undefined): Built {
  const fallback = () => {
    const snapshot = validateSnapshot(base).snapshot;
    return { catalog: createCatalog(snapshot), snapshot };
  };
  if (!file?.snapshot) return { ...fallback(), problems: file?.problems ?? [], usedFile: false };
  const combined = applyPhotos(file.mode === 'replace' ? file.snapshot : mergeSnapshots(base, file.snapshot), file.photos, file.photoCredit, file.colors);
  const { snapshot, problems } = validateSnapshot(combined);
  const all = [...file.problems, ...problems];
  if (snapshot.festivals.length === 0 || snapshot.clips.length === 0) {
    all.push('After checking, the file leaves no festival with clips to show, so the app kept the data it had.');
    return { ...fallback(), problems: all, usedFile: false };
  }
  return { catalog: createCatalog(snapshot), snapshot, problems: all, usedFile: true };
}
