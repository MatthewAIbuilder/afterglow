import { type Catalog, createCatalog } from './catalog';
import { withGuessedSounds } from './soundGuess';
import type { ParsedFile } from './file';
import { siteName } from './import/sitePicture';
import { withMembers } from './members';
import type { ArtistSimilarity, CatalogSnapshot, Festival } from './models';
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

/**
 * The pictures festivals' official sites share, as the poster of festivals
 * with a `website` and no poster of their own, credited to the site. The
 * same object when none applies.
 */
export function applySitePictures(snapshot: CatalogSnapshot, pictures: Record<string, string> | undefined): CatalogSnapshot {
  if (!pictures) return snapshot;
  let changed = false;
  const festivals = snapshot.festivals.map((f) => {
    const url = pictures[f.id];
    const site = f.links?.website && siteName(f.links.website);
    if (!url || f.posterImageUrl || !site) return f;
    changed = true;
    return { ...f, posterImageUrl: url, posterFrom: site };
  });
  return changed ? { ...snapshot, festivals } : snapshot;
}

/** The snapshot without clips of these YouTube videos (reported as wrong). The same object when none is in it. */
export function withoutVideos(snapshot: CatalogSnapshot, videoIds: readonly string[] | undefined): CatalogSnapshot {
  if (!videoIds?.length) return snapshot;
  const blocked = new Set(videoIds);
  const clips = snapshot.clips.filter((c) => !(c.source?.provider === 'youtube' && blocked.has(c.source.videoId)));
  return clips.length === snapshot.clips.length ? snapshot : { ...snapshot, clips };
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
  const combined = withoutVideos(
    applySitePictures(
      withMembers(
        applyPhotos(file.mode === 'replace' ? file.snapshot : mergeSnapshots(base, file.snapshot), file.photos, file.photoCredit, file.colors),
        file.memberPhotos,
        file.photoCredit,
      ),
      file.sitePictures,
    ),
    file.blockedVideos,
  );
  const checked = validateSnapshot(combined);
  // Sounds for artists who came without any, guessed from the company they keep.
  const snapshot = withGuessedSounds(checked.snapshot);
  const problems = checked.problems;
  const all = [...file.problems, ...problems];
  if (snapshot.festivals.length === 0 || snapshot.clips.length === 0) {
    all.push('After checking, the file leaves no festival with clips to show, so the app kept the data it had.');
    return { ...fallback(), problems: all, usedFile: false };
  }
  return { catalog: createCatalog(snapshot), snapshot, problems: all, usedFile: true };
}

/**
 * Catalogue updates published from HQ, applied one after another (oldest
 * first) on top of the catalogue. One that can't be used is skipped, never
 * breaking the rest. Pure.
 */
/** What a published update may change on a festival that's already in the catalogue: its lineup and set times, days and stages, and its links. */
const PATCHED_FESTIVAL_FIELDS = ['lineup', 'sets', 'days', 'stages', 'artistDays', 'links'] as const;

/**
 * A published update made safe to lay over the catalogue: it only ever adds
 * ("replace" would empty everyone's catalogue), artists already there keep
 * their own record (photo, colour, sounds; an update's new acts are bare),
 * and a festival already there takes only its lineup, set times, days,
 * stages and links from it, so later fixes to its dates or poster still
 * reach everyone. Pure.
 */
export function asPatch(parsed: ParsedFile, current: CatalogSnapshot): ParsedFile {
  if (!parsed.snapshot) return { ...parsed, mode: 'add' };
  const artistIds = new Set(current.artists.map((a) => a.id));
  const festivals = new Map(current.festivals.map((f) => [f.id, f]));
  const patched = parsed.snapshot.festivals.map((f) => {
    const was = festivals.get(f.id);
    if (!was) return f;
    const out: Festival = { ...was };
    for (const k of PATCHED_FESTIVAL_FIELDS) if (f[k] !== undefined) (out as Record<string, unknown>)[k] = f[k];
    return out;
  });
  return {
    ...parsed,
    mode: 'add',
    snapshot: { ...parsed.snapshot, artists: parsed.snapshot.artists.filter((a) => !artistIds.has(a.id)), festivals: patched },
  };
}

export function applyPatches(base: Built, patches: readonly { file: string }[], parse: (text: string) => ParsedFile): Built {
  let built = base;
  const problems: string[] = [];
  for (const p of patches) {
    const next = buildCatalog(built.snapshot, asPatch(parse(p.file), built.snapshot));
    problems.push(...next.problems);
    if (next.usedFile) built = next;
  }
  return built === base ? { ...base, problems } : { ...built, problems };
}
