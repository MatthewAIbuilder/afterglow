/**
 * Nightly SoundCloud pages (run by .github/workflows/website.yml after the
 * artist photos step):
 *
 *   npx --yes tsx@4 scripts/soundcloud-artists.ts [published.json]
 *
 * For every artist on Afterglow (built-in plus public/catalogue.json) without
 * a SoundCloud link of their own, keeps the page found on an earlier night
 * (from this file or the last published one, the optional argument), or
 * tries a few likely page links built from their name on SoundCloud's public
 * oEmbed endpoint (no key), at most MAX_REQUESTS a night with a pause between
 * them (SOUNDCLOUD_REQUESTS sets fewer; 0 asks nothing). A page counts only
 * when SoundCloud's name for it is the artist's name exactly (src/data/import/soundcloud.ts). Writes "soundcloud" (artist id ->
 * { url, name, image }) and "soundcloudMisses" (artist id -> day, retried
 * after a month; the app ignores it) into public/catalogue.json, only if the
 * app would read the file with no problems.
 *
 * Never fails the night: if SoundCloud can't be reached or blocks the
 * requests, it says so (a GitHub warning) and keeps last night's pages.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_IN } from '../src/data/bundled';
import { parseCatalogFile } from '../src/data/file';
import { type Asked, lookUpProfiles, MAX_REQUESTS, oembedUrl, readAnswer, soundcloudPlan, soundcloudProfile } from '../src/data/import/soundcloud';
import { buildCatalog } from '../src/data/merge';
import type { SoundCloudProfile } from '../src/data/models';
import { MAX_FILE_CHARS } from '../src/data/remote';
import { bySoonest, isOver } from '../src/features/festivals/shelves';

const OUT = resolve(__dirname, '../public/catalogue.json');
/** A polite pause between requests. */
const PAUSE_MS = 250;
const TIMEOUT_MS = 10_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Saved = { soundcloud?: Record<string, unknown>; soundcloudMisses?: Record<string, unknown> };

function readJson(path: string | undefined): Saved | undefined {
  if (!path || !existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Saved;
  } catch {
    return undefined;
  }
}

async function ask(url: string, artistName: string): Promise<Asked> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(oembedUrl(url), { headers: { Accept: 'application/json' }, signal: controller.signal });
    let body: unknown;
    try {
      body = await res.json();
    } catch {}
    return readAnswer(artistName, url, res.status, body);
  } catch {
    return { status: 'failed' };
  } finally {
    clearTimeout(timer);
    await sleep(PAUSE_MS);
  }
}

async function main() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const text = readFileSync(OUT, 'utf8');
  const file = JSON.parse(text) as Record<string, unknown>;
  const catalog = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(text)).catalog;

  // Pages and misses from earlier nights: this file's own first, then the last published file's.
  const last = readJson(process.argv[2]);
  const published: Record<string, SoundCloudProfile> = {};
  for (const source of [last?.soundcloud, file.soundcloud as Saved['soundcloud']])
    for (const [id, p] of Object.entries(source ?? {})) {
      const page = soundcloudProfile(p);
      if (page) published[id] = page;
    }
  const misses: Record<string, string> = {};
  for (const source of [last?.soundcloudMisses, file.soundcloudMisses as Saved['soundcloudMisses']])
    for (const [id, d] of Object.entries(source ?? {})) if (typeof d === 'string') misses[id] = d;

  // The artists that matter most first: on upcoming festivals you curated, then the rest, soonest first, in billing order; then everyone else.
  const upcoming = bySoonest(catalog.festivals.filter((f) => !isOver(f, now)), now);
  const order = [...upcoming.filter((f) => !f.source), ...upcoming.filter((f) => f.source)];
  const ids = [...order.flatMap((f) => f.lineup), ...catalog.artists.map((a) => a.id)];
  const artists = ids.map((id) => catalog.artist(id)).filter((a) => !!a);
  const plan = soundcloudPlan(artists, published, misses, today);

  // SOUNDCLOUD_REQUESTS=0 asks nothing (pushes during the day keep what's found for the nightly run).
  const cap = process.env.SOUNDCLOUD_REQUESTS?.trim() ? Math.max(0, Math.min(MAX_REQUESTS, Number(process.env.SOUNDCLOUD_REQUESTS) || 0)) : MAX_REQUESTS;
  const result = await lookUpProfiles(plan.lookUp, ask, today, { maxRequests: cap });
  if (result.stopped) console.log('::warning::SoundCloud stopped answering (or blocked the requests); kept last night’s pages, the rest wait for the next night.');
  else if (result.failures) console.log(`::warning::${result.failures} SoundCloud requests failed tonight; those artists are tried again tomorrow.`);

  const soundcloud = { ...plan.keep, ...result.found };
  const soundcloudMisses = { ...plan.misses, ...result.missed };
  // Exactly what the app will do with it; if tonight's finds don't fit, at least last night's pages stay.
  const write = (pages: Record<string, SoundCloudProfile>, missed: Record<string, string>) => {
    const out = JSON.stringify({ ...file, soundcloud: pages, soundcloudMisses: missed });
    const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(out));
    if (out.length > MAX_FILE_CHARS || built.problems.length) {
      console.log(`::warning::SoundCloud pages: ${built.problems.slice(0, 3).join(' ') || 'the file would be too large.'}`);
      return false;
    }
    writeFileSync(OUT, `${out}\n`);
    return true;
  };
  if (write(soundcloud, soundcloudMisses)) {
    console.log(
      `SoundCloud: ${Object.keys(soundcloud).length} of ${catalog.artists.length} artists (${Object.keys(result.found).length} new, ${result.asked} asked tonight, ${Object.keys(result.missed).length} not found).`,
    );
  } else if (write(plan.keep, plan.misses)) console.log(`SoundCloud: kept last night's ${Object.keys(plan.keep).length} pages; tonight's finds were left out.`);
  else console.log('::warning::SoundCloud pages were skipped tonight.');
}

main().catch((e) => {
  // Never fails the night: the file is left as it was.
  console.log(`::warning::SoundCloud pages skipped tonight: ${e instanceof Error ? e.message : 'unexpected error'}.`);
});
