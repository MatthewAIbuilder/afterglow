/**
 * Nightly pictures from festivals' official sites (run by
 * .github/workflows/website.yml after the artist colours):
 *
 *   npx --yes tsx@4 scripts/site-pictures.ts [published.json]
 *
 * For every festival with an official `website` link and no poster of its
 * own, reads the site's share picture (its og:image: often the lineup poster
 * or the festival's key art) and writes the list into public/catalogue.json
 * as "sitePictures". A site that can't be read tonight keeps the picture
 * published last time (the optional argument).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_IN } from '../src/data/bundled';
import { parseCatalogFile } from '../src/data/file';
import { PAGE_MAX_CHARS, sharePicture } from '../src/data/import/sitePicture';
import { buildCatalog } from '../src/data/merge';
import { MAX_FILE_CHARS } from '../src/data/remote';

const OUT = resolve(__dirname, '../public/catalogue.json');
const TIMEOUT_MS = 10_000;
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; AfterglowBot/1.0; +https://afterglowmusic.app)', Accept: 'text/html' };

async function readPage(url: string): Promise<string | undefined> {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok || !/html/i.test(res.headers.get('content-type') ?? 'text/html')) return undefined;
  return (await res.text()).slice(0, PAGE_MAX_CHARS);
}

/** Whether the picture is really there and is an image. */
async function isPicture(url: string): Promise<boolean> {
  const res = await fetch(url, { headers: { 'User-Agent': HEADERS['User-Agent'] }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  await res.body?.cancel();
  return res.ok && /^image\/(jpeg|png|webp|gif|avif)/i.test(res.headers.get('content-type') ?? '');
}

async function main() {
  const text = readFileSync(OUT, 'utf8');
  const file = JSON.parse(text) as Record<string, unknown>;
  // The festivals as the app will have them, before any site pictures.
  const festivals = buildCatalog(BUILT_IN.snapshot, { ...parseCatalogFile(text), sitePictures: undefined }).catalog.festivals;
  const lastPath = process.argv[2];
  const last = lastPath && existsSync(lastPath) ? (parseCatalogFile(readFileSync(lastPath, 'utf8')).sitePictures ?? {}) : {};

  const pictures: Record<string, string> = {};
  let found = 0;
  let kept = 0;
  for (const f of festivals) {
    const site = f.links?.website;
    if (!site || f.posterImageUrl) continue;
    try {
      const html = await readPage(site);
      const picture = html ? sharePicture(html, site) : undefined;
      if (picture && (await isPicture(picture))) {
        pictures[f.id] = picture;
        found++;
        continue;
      }
    } catch {
      // Unreachable tonight: last time's picture below.
    }
    if (last[f.id]) {
      pictures[f.id] = last[f.id];
      kept++;
    }
  }

  const out = JSON.stringify({ ...file, sitePictures: pictures });
  // Exactly what the app will do with it.
  const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(out));
  if (out.length > MAX_FILE_CHARS || built.problems.length) {
    console.error(`Site pictures skipped: ${built.problems.slice(0, 3).join(' ') || 'the file would be too large.'}`);
    process.exit(1);
  }
  writeFileSync(OUT, `${out}\n`);
  const withSite = festivals.filter((f) => f.links?.website && !f.posterImageUrl).length;
  console.log(`Site pictures: ${found} read tonight, ${kept} kept from last time, of ${withSite} festivals with an official site.`);
}

main().catch((e) => {
  console.error(`Site pictures skipped: ${e instanceof Error ? e.message : 'unexpected error'}.`);
  process.exit(1);
});
