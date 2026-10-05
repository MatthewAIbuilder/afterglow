/**
 * The nightly look at festivals' official pages (run by
 * .github/workflows/website.yml after the website is built):
 *
 *   npx --yes tsx@4 scripts/page-watch.ts <dist> [report.md]
 *
 * For every upcoming festival with an official `website` link (in the
 * catalogue, or set from HQ and published), reads the page and compares it
 * with last night's look (the live site's /page-watch.json): new artist
 * names on it, set times appearing, a new share picture. Writes tonight's
 * look to <dist>/page-watch.json, and when something's new, a heads-up to
 * the report file, which the workflow turns into a GitHub issue (an email to
 * the owner). Nothing is imported from the pages.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BUILT_IN } from '../src/data/bundled';
import { parseCatalogFile } from '../src/data/file';
import { pageFacts, type PageFacts, type WatchNews, watchNotes, watchReport, type WatchState } from '../src/data/import/pageWatch';
import { PAGE_MAX_CHARS } from '../src/data/import/sitePicture';
import { applyPatches, buildCatalog } from '../src/data/merge';

const CATALOGUE = resolve(__dirname, '../public/catalogue.json');
const LIVE = 'https://afterglowmusic.web.app';
const HQ = 'https://afterglowmusic.app/admin';
const TIMEOUT_MS = 15_000;
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; AfterglowBot/1.0; +https://afterglowmusic.app)', Accept: 'text/html' };

async function readPage(url: string): Promise<string | undefined> {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok || !/html/i.test(res.headers.get('content-type') ?? 'text/html')) return undefined;
  return (await res.text()).slice(0, PAGE_MAX_CHARS);
}

/** Updates published from HQ (anyone can read them), oldest first, so websites set there are watched too. */
async function livePatches(): Promise<{ file: string }[]> {
  const project = process.env.FIREBASE_PROJECT_ID;
  const key = process.env.FIREBASE_API_KEY;
  if (!project || !key) return [];
  type Page = { documents?: { fields?: { file?: { stringValue?: string }; publishedAt?: { timestampValue?: string } } }[]; nextPageToken?: string };
  const docs: NonNullable<Page['documents']> = [];
  // Every page of them (a page holds at most 300), up to a sensible limit.
  let token: string | undefined;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/published?pageSize=300&key=${key}${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) break;
    const json = (await res.json()) as Page;
    docs.push(...(json.documents ?? []));
    token = json.nextPageToken;
    if (!token) break;
  }
  return docs
    .map((d) => ({ file: d.fields?.file?.stringValue ?? '', at: d.fields?.publishedAt?.timestampValue ?? '' }))
    .filter((p) => p.file)
    .sort((a, b) => a.at.localeCompare(b.at));
}

async function lastLook(): Promise<WatchState | undefined> {
  try {
    const res = await fetch(`${LIVE}/page-watch.json`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? ((await res.json()) as WatchState) : undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  const dist = process.argv[2];
  const reportPath = process.argv[3] ?? '/tmp/page-watch.md';
  if (!dist || !existsSync(dist)) throw new Error('the built website folder is missing');
  const base = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(readFileSync(CATALOGUE, 'utf8')));
  const { catalog } = applyPatches(base, await livePatches().catch(() => []), parseCatalogFile);
  const today = new Date().toISOString().slice(0, 10);
  const watched = catalog.festivals.filter((f) => f.links?.website && (f.endDate ?? f.startDate ?? today) >= today);
  const before = await lastLook();
  const artists = catalog.artists.map((a) => ({ id: a.id, name: a.name }));

  const sites: Record<string, PageFacts> = {};
  const news: WatchNews[] = [];
  let read = 0;
  for (const f of watched) {
    const url = f.links!.website!;
    const last = before?.sites[f.id];
    try {
      const html = await readPage(url);
      if (!html) throw new Error('not a page');
      const now = pageFacts(html, url, artists, new Set(f.lineup));
      sites[f.id] = now;
      read++;
      const notes = watchNotes(last, now);
      if (notes.length) news.push({ id: f.id, name: f.name, url, notes });
    } catch {
      // Unreachable tonight: keep last night's look, so tomorrow compares with it.
      if (last) sites[f.id] = last;
    }
  }

  const state: WatchState = { checkedAt: new Date().toISOString(), sites };
  writeFileSync(join(dist, 'page-watch.json'), `${JSON.stringify(state)}\n`);
  if (news.length) writeFileSync(reportPath, `${watchReport(news, HQ)}\n`);
  console.log(`Page watch: ${read} of ${watched.length} official pages read, ${news.length} with news${before ? '' : ' (first look: nothing to compare with yet)'}.`);
}

main().catch((e) => {
  console.error(`Page watch skipped: ${e instanceof Error ? e.message : 'unexpected error'}.`);
  process.exit(1);
});
