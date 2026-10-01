/**
 * Nightly artist photos (run by .github/workflows/website.yml after the
 * EDMTrain step):
 *
 *   npx --yes tsx@4 scripts/artist-photos.ts [published.json]
 *
 * For every artist in the published catalogue (built-in plus
 * public/catalogue.json) without a photo of their own, reuses the photo from
 * the last published file (the optional argument) or looks it up on
 * Deezer's public artist search, and writes the list into
 * public/catalogue.json as "photos" (credited to Deezer). Only exact name
 * matches are used. If Deezer can't be reached, the photos already found
 * are kept and the rest wait for the next night.
 *
 * Then the same for the artists playing in b2b acts ("SUBTRONICS B2B
 * CRANKDAT") who aren't on Afterglow themselves, written as "memberPhotos"
 * (name -> link), so a b2b's avatar can show both faces.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_IN } from '../src/data/bundled';
import { parseCatalogFile } from '../src/data/file';
import { deezerSearchUrl, MAX_LOOKUPS, memberPlan, PHOTO_CREDIT, photoPlan, pickDeezerPhoto } from '../src/data/import/photos';
import { buildCatalog } from '../src/data/merge';
import { MAX_FILE_CHARS } from '../src/data/remote';

const OUT = resolve(__dirname, '../public/catalogue.json');
const PAUSE_MS = 130; // Deezer allows about 50 requests every 5 seconds
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const text = readFileSync(OUT, 'utf8');
  const file = JSON.parse(text) as Record<string, unknown>;
  // The artists as the app will have them, before any photo list.
  const parsed = parseCatalogFile(text);
  const artists = buildCatalog(BUILT_IN.snapshot, { ...parsed, photos: undefined, memberPhotos: undefined }).catalog.artists;

  const lastPath = process.argv[2];
  const last = lastPath && existsSync(lastPath) ? parseCatalogFile(readFileSync(lastPath, 'utf8')) : undefined;
  const published = last?.photos ?? {};
  const { reuse, lookUp } = photoPlan(artists, published);

  // Deezer stops answering after too many failures; the rest waits for the next night.
  let failures = 0;
  const lookUpPhoto = async (name: string): Promise<string | undefined> => {
    if (failures >= 20) return undefined;
    try {
      const res = await fetch(deezerSearchUrl(name), { headers: { Accept: 'application/json' } });
      if (res.ok) return pickDeezerPhoto(name, await res.json());
      failures++;
    } catch {
      failures++;
    } finally {
      await sleep(PAUSE_MS);
    }
    if (failures >= 20) console.warn('Deezer stopped answering; the rest wait for the next night.');
    return undefined;
  };

  const found: Record<string, string> = {};
  for (const a of lookUp) {
    const url = await lookUpPhoto(a.name);
    if (url) found[a.id] = url;
  }
  const photos = { ...reuse, ...found };

  // The artists in b2b acts who aren't on Afterglow, with whatever lookups are left tonight.
  const withPhotos = artists.map((a) => (a.imageUrl || !photos[a.id] ? a : { ...a, imageUrl: photos[a.id] }));
  const members = memberPlan(withPhotos, last?.memberPhotos ?? {}, Math.max(0, MAX_LOOKUPS - lookUp.length));
  const memberPhotos: Record<string, string> = { ...members.reuse };
  for (const name of members.lookUp) {
    const url = await lookUpPhoto(name);
    if (url) memberPhotos[name] = url;
  }

  const next = { ...file, photos, memberPhotos, photoCredit: PHOTO_CREDIT };
  const out = JSON.stringify(next);
  // Exactly what the app will do with it.
  const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(out));
  if (out.length > MAX_FILE_CHARS || built.problems.length) {
    console.error(`Artist photos skipped: ${built.problems.slice(0, 3).join(' ') || 'the file would be too large.'}`);
    process.exit(1);
  }
  writeFileSync(OUT, `${out}\n`);
  console.log(
    `Artist photos: ${Object.keys(photos).length} of ${artists.length} artists (${Object.keys(reuse).length} kept, ${Object.keys(found).length} new, ${lookUp.length - Object.keys(found).length} not found or not tried); ${Object.keys(memberPhotos).length} artists in b2bs.`,
  );
}

main().catch((e) => {
  console.error(`Artist photos skipped: ${e instanceof Error ? e.message : 'unexpected error'}.`);
  process.exit(1);
});
