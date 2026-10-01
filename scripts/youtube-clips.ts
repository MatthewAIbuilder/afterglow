/**
 * Nightly Discover clips from YouTube (run by .github/workflows/website.yml
 * after the EDMTrain and photo steps):
 *
 *   YOUTUBE_API_KEY=... npx --yes tsx@4 scripts/youtube-clips.ts [published.json]
 *
 * Keeps the clips found on earlier nights (from the last published file,
 * the optional argument), then searches YouTube for up to MAX_SEARCHES
 * artists on upcoming festivals who still have no clip, and adds the best
 * live set for each as a one-minute clip (src/data/import/youtube.ts).
 * Searches that found nothing are remembered ("clipMisses") and retried after
 * a month. Videos reported as wrong ("blockedVideos" in
 * catalogue/afterglow.json) are dropped and never picked again, and the list
 * is copied into the published file so phones with a saved copy drop them too.
 * Writes public/catalogue.json only if the app would read it with no
 * problems. The key is never printed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_IN, BUNDLED_FILE } from '../src/data/bundled';
import { parseCatalogFile, parseYouTubeLink } from '../src/data/file';
import type { Festival } from '../src/data/models';
import { clipPlan, detailsUrl, pickLiveSet, searchIds, searchUrl, setClip } from '../src/data/import/youtube';
import { buildCatalog } from '../src/data/merge';
import { MAX_FILE_CHARS } from '../src/data/remote';
import { bySoonest, isOver } from '../src/features/festivals/shelves';

const OUT = resolve(__dirname, '../public/catalogue.json');
type FileClip = ReturnType<typeof setClip>;
/** A published clip's YouTube video id ("" when it has none). */
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

  // Clips found on earlier nights, still pointing at an upcoming festival the artist plays.
  const lastPath = process.argv[2];
  let published: { clips?: FileClip[]; clipMisses?: Record<string, string> } = {};
  if (lastPath && existsSync(lastPath)) {
    try {
      published = JSON.parse(readFileSync(lastPath, 'utf8'));
    } catch {}
  }
  const clips: FileClip[] = (file.clips ?? []).filter((c) => !isBlocked(c));
  const has = new Set([...catalog.clips.map((c) => c.artistId), ...clips.map((c) => c.artist)]);
  for (const c of published.clips ?? []) {
    if (typeof c?.id !== 'string' || !c.id.startsWith('yt-') || isBlocked(c) || has.has(c.artist) || !catalog.artist(c.artist)) continue;
    // Its festival if still listed (even once it's over, so likes on the clip keep counting), else another the artist plays.
    const home = catalog.festival(c.festival)?.lineup.includes(c.artist)
      ? c.festival
      : (homeOf(c.artist) ?? catalog.festivalsOf(c.artist)[0])?.id;
    if (!home) continue;
    clips.push({ ...c, festival: home });
    has.add(c.artist);
  }
  const misses: Record<string, string> = { ...(published.clipMisses ?? {}) };

  // Tonight's searches: festivals you curated first, then the rest, soonest first, in billing order.
  const order = [...upcoming.filter((f) => !f.source), ...upcoming.filter((f) => f.source)];
  const wanted = order.flatMap((f) => f.lineup.map((id) => catalog.artist(id)).filter((a) => !!a).map((a) => ({ id: a!.id, name: a!.name })));
  const plan = clipPlan(wanted, (id) => has.has(id), misses, today);

  let found = 0;
  let searched = 0;
  let failures = 0;
  for (const a of plan) {
    const s = await getJson(searchUrl(a.name, key));
    if (!s.ok) {
      if (++failures >= 5) {
        console.warn('YouTube clips: YouTube stopped answering; the rest wait for the next night.');
        break;
      }
      if (s.status === 403) {
        console.warn('YouTube clips: the daily quota is used up (or the key was refused); the rest wait for the next night.');
        break;
      }
      continue;
    }
    searched++;
    const ids = searchIds(s.body);
    const d = ids.length ? await getJson(detailsUrl(ids, key)) : undefined;
    const set = d?.ok ? pickLiveSet(a.name, d.body, blocked) : undefined;
    const home = homeOf(a.id);
    if (set && home) {
      clips.push(setClip(set, a, home.id));
      has.add(a.id);
      delete misses[a.id];
      found++;
    } else misses[a.id] = today;
  }

  const next = blockedList.length ? { ...file, clips, clipMisses: misses, blockedVideos: blockedList } : { ...file, clips, clipMisses: misses };
  const out = JSON.stringify(next);
  const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(out));
  if (out.length > MAX_FILE_CHARS) stop('the file would be too large.');
  if (!built.usedFile || built.problems.length) stop(built.problems.slice(0, 3).join(' ') || 'the app would refuse the file.');
  writeFileSync(OUT, `${out}\n`);
  console.log(
    `YouTube clips: ${clips.length} clips in all, ${found} new from ${searched} searches tonight (${Object.keys(misses).length} artists with no set found yet).`,
  );
}

main().catch((e) => stop(e instanceof Error ? e.message : 'unexpected error.'));
