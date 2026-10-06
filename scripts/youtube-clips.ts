/**
 * Nightly Discover clips from YouTube (run by .github/workflows/website.yml
 * after the EDMTrain and photo steps):
 *
 *   YOUTUBE_API_KEY=... npx --yes tsx@4 scripts/youtube-clips.ts [published.json ...]
 *
 * Keeps the clips found on earlier nights (from the last published file,
 * the optional arguments; a missing file is skipped, and a later file, such
 * as an earlier release, only tops artists up to MAX_CLIPS_PER_ARTIST), then
 * searches YouTube for up to MAX_SEARCHES artists (CLIP_SEARCHES=0 searches
 * none: pushes keep the day's quota for the nightly run): first artists on
 * upcoming festivals with no clip yet, then artists with fewer than
 * MAX_CLIPS_PER_ARTIST clips, fewest first (src/data/import/youtube.ts,
 * `clipPlan`). Each search can bring in up to NEW_PER_SEARCH different live
 * sets as one-minute clips. A video is used once only (a b2b set can be the
 * best find for both artists): two clips with one video would make the app
 * refuse the whole file.
 * A share of the searches (SHORT_SEARCHES of MAX_SEARCHES, more when the
 * sets need fewer) looks for Shorts instead: short upright crowd clips of
 * the artist live, up to MAX_SHORTS_PER_ARTIST each on top of their sets,
 * played whole from the start in the tall player (`pickShorts`, `shortClip`).
 * Searches that found nothing are remembered ("clipMisses", retried after a
 * month; "clipMoreAsked" for artists who already have a clip and
 * "clipShortsAsked" for Shorts, asked again after three weeks). New extra clips stop at CLIP_BUDGET_SHARE of the app's
 * file size limit (first clips, and clips kept from earlier nights, at
 * FIRST_CLIP_SHARE), so the file never grows too large for the app.
 * Videos reported as wrong ("blockedVideos" in catalogue/afterglow.json) are
 * dropped and never picked again, and the list is copied into the published
 * file so phones with a saved copy drop them too.
 * Writes public/catalogue.json only if the app would read it with no
 * problems. The key is never printed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_IN, BUNDLED_FILE } from '../src/data/bundled';
import { parseCatalogFile, parseYouTubeLink } from '../src/data/file';
import type { Festival } from '../src/data/models';
import {
  CLIP_BUDGET_SHARE,
  FIRST_CLIP_SHARE,
  MAX_CLIPS_PER_ARTIST,
  MAX_SEARCHES,
  MAX_SHORTS_PER_ARTIST,
  NEW_PER_SEARCH,
  NEW_SHORTS_PER_SEARCH,
  RETRY_MISSES_DAYS,
  RETRY_MORE_DAYS,
  RETRY_SHORTS_DAYS,
  SHORT_SEARCHES,
  cleanAsked,
  clipBudget,
  clipPlan,
  detailsUrl,
  pickLiveSets,
  pickShorts,
  searchIds,
  searchUrl,
  setClip,
  shapesUrl,
  shortClip,
  shortsPlan,
  shortsUrl,
  videoShapes,
} from '../src/data/import/youtube';
import { buildCatalog } from '../src/data/merge';
import { MAX_FILE_CHARS } from '../src/data/remote';
import { bySoonest, isOver } from '../src/features/festivals/shelves';
import { isShort } from '../src/features/recommend/feed';

const OUT = resolve(__dirname, '../public/catalogue.json');
type FileClip = ReturnType<typeof setClip>;
/** A published clip's YouTube video id ("" when it has none). */
const isShortFile = (c: FileClip) => (c?.video as { short?: unknown } | undefined)?.short === true;
const videoIdOf = (c: FileClip) => (c?.id?.startsWith('yt-') ? c.id.slice(3) : (parseYouTubeLink(c?.video?.link)?.videoId ?? ''));

function stop(message: string): never {
  console.error(`YouTube clips skipped: ${message}`);
  process.exit(1);
}

async function getJson(url: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    return { ok: false, status: 0, body: undefined }; // unreachable: the found clips are still written
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {}
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) {
    console.log('YouTube clips: no YOUTUBE_API_KEY, nothing to do.');
    return;
  }
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const file = JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, unknown> & { clips?: FileClip[] };
  // Videos reported as wrong, from the bundled catalogue (and any already in the file).
  const blockedList = [...new Set([...(BUNDLED_FILE.blockedVideos ?? []), ...(parseCatalogFile(readFileSync(OUT, 'utf8')).blockedVideos ?? [])])];
  const blocked = new Set(blockedList);
  const isBlocked = (c: FileClip) => blocked.has(videoIdOf(c));
  const catalog = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(readFileSync(OUT, 'utf8'))).catalog;

  // The artist's soonest festival that isn't over: where a clip belongs.
  const upcoming = bySoonest(catalog.festivals.filter((f) => !isOver(f, now)), now);
  const homeOf = (artistId: string): Festival | undefined => upcoming.find((f) => f.lineup.includes(artistId));

  const published: { clips?: FileClip[]; clipMisses?: unknown; clipMoreAsked?: unknown; clipShortsAsked?: unknown }[] = [];
  for (const path of process.argv.slice(2)) {
    if (!existsSync(path)) continue;
    try {
      published.push(JSON.parse(readFileSync(path, 'utf8')));
    } catch {}
  }
  const misses = cleanAsked(published[0]?.clipMisses, today, RETRY_MISSES_DAYS);
  const moreAsked = cleanAsked(published[0]?.clipMoreAsked, today, RETRY_MORE_DAYS);
  const shortsAsked = cleanAsked(published[0]?.clipShortsAsked, today, RETRY_SHORTS_DAYS);
  const searches = process.env.CLIP_SEARCHES?.trim() ? Math.max(0, Number(process.env.CLIP_SEARCHES) || 0) : MAX_SEARCHES;

  // How many sets and Shorts each artist has, and their titles (so a new find is a different one).
  const count: Record<string, number> = {};
  const shortCount: Record<string, number> = {};
  const titles: Record<string, string[]> = {};
  const shortTitles: Record<string, string[]> = {};
  const note = (artist: string, title: unknown, short: boolean) => {
    const n = short ? shortCount : count;
    n[artist] = (n[artist] ?? 0) + 1;
    if (typeof title === 'string') ((short ? shortTitles : titles)[artist] ??= []).push(title);
  };
  for (const c of catalog.clips) note(c.artistId, c.title, isShort(c));

  // The file's size without clips: every clip kept or added has to fit (clipBudget).
  const shell = (clips: FileClip[]) => ({
    ...file,
    clips,
    clipMisses: misses,
    clipMoreAsked: moreAsked,
    clipShortsAsked: shortsAsked,
    ...(blockedList.length ? { blockedVideos: blockedList } : {}),
  });
  // Room for the misses lists to grow tonight.
  const budget = clipBudget(JSON.stringify(shell([])).length + 20_000, MAX_FILE_CHARS);

  const clips: FileClip[] = [];
  // Every video already used, so none is used twice.
  const used = new Set<string>();
  const keep = (c: FileClip) => {
    const v = videoIdOf(c);
    if (used.has(c.id) || (v && used.has(v))) return false;
    clips.push(c);
    budget.add(c);
    used.add(c.id);
    if (v) used.add(v);
    return true;
  };
  for (const c of file.clips ?? []) if (!isBlocked(c)) keep(c);
  for (const c of catalog.clips) {
    used.add(c.id);
    const v = c.source?.provider === 'youtube' ? c.source.videoId : undefined;
    if (v) used.add(v);
  }

  // Clips found on earlier nights: each artist's first set before anyone's extras and Shorts, so if
  // the file is ever short of room, those are what's left out.
  const carried = published
    .flatMap((p) => (Array.isArray(p.clips) ? p.clips : []))
    .filter((c) => typeof c?.id === 'string' && c.id.startsWith('yt-') && typeof c.artist === 'string' && !isBlocked(c) && !!catalog.artist(c.artist));
  let leftOut = 0;
  for (const firsts of [true, false]) {
    for (const c of carried) {
      const short = isShortFile(c);
      const n = (short ? shortCount : count)[c.artist] ?? 0;
      if (firsts ? short || n > 0 : n >= (short ? MAX_SHORTS_PER_ARTIST : MAX_CLIPS_PER_ARTIST)) continue;
      if (used.has(c.id) || used.has(videoIdOf(c))) continue;
      // Its festival if still listed (even once it's over, so likes on the clip keep counting), else another the artist plays.
      const home = catalog.festival(c.festival)?.lineup.includes(c.artist)
        ? c.festival
        : (homeOf(c.artist) ?? catalog.festivalsOf(c.artist)[0])?.id;
      if (!home) continue;
      const clip = { ...c, festival: home };
      if (!budget.fits(clip, FIRST_CLIP_SHARE)) {
        leftOut++;
        continue;
      }
      if (keep(clip)) note(c.artist, c.title, short);
    }
  }

  // Tonight's searches: festivals you curated first, then the rest, soonest first, in billing order;
  // then artists with fewer clips than the cap (upcoming festivals first), fewest first. A share of
  // the searches (more when the sets need fewer) looks for Shorts.
  const order = [...upcoming.filter((f) => !f.source), ...upcoming.filter((f) => f.source)];
  const named = (id: string) => {
    const a = catalog.artist(id);
    return a ? [{ id: a.id, name: a.name }] : [];
  };
  const wanted = order.flatMap((f) => f.lineup.flatMap(named));
  const later = [...new Set([...Object.keys(count), ...Object.keys(shortCount)])].flatMap(named);
  const forShorts = Math.round((searches * SHORT_SEARCHES) / MAX_SEARCHES);
  const plan = clipPlan(wanted, (id) => count[id] ?? 0, misses, today, searches - forShorts, { moreAsked, later });
  const planShorts = shortsPlan(wanted, (id) => shortCount[id] ?? 0, shortsAsked, today, searches - plan.length, { later });

  let failures = 0;
  let stopped = false;
  /** One YouTube search: its answer's details (asked with the players' sizes), or undefined. */
  const search = async (url: string) => {
    const s = await getJson(url);
    if (!s.ok) {
      if (++failures >= 5) {
        console.warn('YouTube clips: YouTube stopped answering; the rest wait for the next night.');
        stopped = true;
      } else if (s.status === 403) {
        console.warn('YouTube clips: the daily quota is used up (or the key was refused); the rest wait for the next night.');
        stopped = true;
      }
      return { ok: false as const };
    }
    const ids = searchIds(s.body);
    const d = ids.length ? await getJson(detailsUrl(ids, key)) : undefined;
    return { ok: true as const, details: d?.ok ? d.body : undefined };
  };

  let firstFound = 0;
  let moreFound = 0;
  let shortsFound = 0;
  let searched = 0;
  let shortSearched = 0;
  let full = false;
  // A clip of a typical size, to know before searching whether another one would still fit.
  const probe = setClip({ videoId: 'x'.repeat(11), title: 'x'.repeat(40), channel: 'x'.repeat(20), seconds: 3600, score: 0 }, { id: 'x'.repeat(24), name: 'x' }, 'x'.repeat(24));
  for (const a of plan) {
    if (stopped) break;
    // Out of room for extra clips: keep the day's allowance (first clips may still fit).
    if (a.have > 0 && !budget.fits(probe, CLIP_BUDGET_SHARE)) full = true;
    if (full && a.have > 0) continue;
    const have = count[a.id] ?? 0;
    const s = await search(searchUrl(a.name, key, have));
    if (!s.ok) continue;
    searched++;
    const max = Math.min(NEW_PER_SEARCH, MAX_CLIPS_PER_ARTIST - have);
    const sets = s.details ? pickLiveSets(a.name, s.details, { blocked: new Set([...blocked, ...used]), taken: titles[a.id] ?? [], max }) : [];
    const home = homeOf(a.id) ?? catalog.festivalsOf(a.id)[0];
    let added = 0;
    for (const set of home ? sets : []) {
      const clip = setClip(set, a, home!.id);
      const first = (count[a.id] ?? 0) === 0;
      if (!budget.fits(clip, first ? FIRST_CLIP_SHARE : CLIP_BUDGET_SHARE)) {
        full = true;
        break;
      }
      if (!keep(clip)) continue;
      note(a.id, clip.title, false);
      added++;
      if (first) firstFound++;
      else moreFound++;
    }
    if (added) {
      delete misses[a.id];
      delete moreAsked[a.id];
    } else if (full && sets.length) {
      // Found, but no room: not a miss, ask again another night.
    } else if (have === 0) misses[a.id] = today;
    else moreAsked[a.id] = today;
  }

  // Shorts: upright crowd clips, played whole in the tall player.
  for (const a of planShorts) {
    if (stopped) break;
    if (full || !budget.fits(probe, CLIP_BUDGET_SHARE)) {
      full = true;
      break;
    }
    const have = shortCount[a.id] ?? 0;
    const s = await search(shortsUrl(a.name, key));
    if (!s.ok) continue;
    shortSearched++;
    const max = Math.min(NEW_SHORTS_PER_SEARCH, MAX_SHORTS_PER_ARTIST - have);
    const found = s.details ? pickShorts(a.name, s.details, { blocked: new Set([...blocked, ...used]), taken: shortTitles[a.id] ?? [], max }) : [];
    const home = homeOf(a.id) ?? catalog.festivalsOf(a.id)[0];
    let added = 0;
    for (const short of home ? found : []) {
      const clip = shortClip(short, a, home!.id);
      if (!budget.fits(clip, CLIP_BUDGET_SHARE)) {
        full = true;
        break;
      }
      if (!keep(clip)) continue;
      note(a.id, clip.title, true);
      added++;
      shortsFound++;
    }
    if (added) delete shortsAsked[a.id];
    else if (!(full && found.length)) shortsAsked[a.id] = today;
  }

  // Each clip's shape, asked again every night (50 videos per unit of quota): upright uploads get the tall player.
  const ytIds = [...new Set(clips.filter((c) => c.id.startsWith('yt-')).map(videoIdOf).filter(Boolean))];
  const shapes: Record<string, boolean> = {};
  for (let i = 0; i < ytIds.length; i += 50) {
    const r = await getJson(shapesUrl(ytIds.slice(i, i + 50), key));
    if (r.ok) Object.assign(shapes, videoShapes(r.body));
  }
  let upright = 0;
  for (const [i, c] of clips.entries()) {
    const shape = shapes[videoIdOf(c)];
    if (shape === undefined || !c.video) continue; // not asked, or YouTube didn't say: as it was
    const { vertical: _was, ...video } = c.video as FileClip['video'] & { vertical?: boolean };
    clips[i] = { ...c, video: shape ? { ...video, vertical: true } : video };
    if (shape) upright++;
  }

  const out = JSON.stringify(shell(clips));
  const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(out));
  if (out.length > MAX_FILE_CHARS) stop('the file would be too large.');
  if (!built.usedFile || built.problems.length) stop(built.problems.slice(0, 3).join(' ') || 'the app would refuse the file.');
  writeFileSync(OUT, `${out}\n`);

  const onLineups = [...new Set(wanted.map((a) => a.id))];
  const none = onLineups.filter((id) => !count[id]).length;
  const below = onLineups.filter((id) => count[id] > 0 && count[id] < MAX_CLIPS_PER_ARTIST).length;
  const share = Math.round((out.length / MAX_FILE_CHARS) * 100);
  const shortsInAll = clips.filter(isShortFile).length;
  console.log(
    `YouTube clips: ${clips.length} clips in all (${shortsInAll} Shorts, ${upright} filmed upright), ${firstFound + moreFound + shortsFound} new tonight ` +
      `(${firstFound} first clips, ${moreFound} more sets from ${searched} searches; ${shortsFound} Shorts from ${shortSearched} searches). ` +
      `On upcoming lineups: ${none} artists with no live set yet, ${below} with fewer than ${MAX_CLIPS_PER_ARTIST}. File at ${share}% of the size limit.`,
  );
  if (full) console.log(`YouTube clips: stopped adding more clips at ${Math.round(CLIP_BUDGET_SHARE * 100)}% of the file size limit; the rest wait until there's room.`);
  if (leftOut) console.log(`YouTube clips: ${leftOut} clips from earlier nights were left out to keep the file under the size limit.`);
}

main().catch((e) => stop(e instanceof Error ? e.message : 'unexpected error.'));
