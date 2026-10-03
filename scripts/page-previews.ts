/**
 * Link previews for the website (run after `npm run build:web`, by
 * .github/workflows/website.yml):
 *
 *   npx --yes tsx@4 scripts/page-previews.ts [dist]
 *
 * Writes dist/festival/<id>.html and dist/artist/<id>.html: copies of the
 * site's page with that festival's or artist's own title and description,
 * so shared links preview properly. Firebase Hosting serves them for
 * /festival/<id> and /artist/<id> (cleanUrls); the app inside is the same.
 * Also dist/sprout.html, the one page every sprout link gets.
 * Uses the catalogue the site is publishing (the built-in data plus
 * dist/catalogue.json).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WEB_URL } from '../src/config/app';
import { BUILT_IN } from '../src/data/bundled';
import { parseCatalogFile } from '../src/data/file';
import { buildCatalog } from '../src/data/merge';
import { artistPreview, festivalPreview, sproutPreview, withPreview } from '../src/features/share/previews';

const dist = resolve(process.argv[2] ?? 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const hosted = join(dist, 'catalogue.json');
const catalog = existsSync(hosted) ? buildCatalog(BUILT_IN.snapshot, parseCatalogFile(readFileSync(hosted, 'utf8'))).catalog : BUILT_IN.catalog;

const previews = [
  ...catalog.festivals.map((f) => festivalPreview(f, WEB_URL)),
  ...catalog.artists.map((a) => artistPreview(a, catalog.festivalsOf(a.id), WEB_URL)),
];
for (const dir of ['festival', 'artist']) mkdirSync(join(dist, dir), { recursive: true });
for (const p of previews) writeFileSync(join(dist, `${p.path}.html`), withPreview(html, p));
// Every sprout link shares one page (firebase.json sends /sprout/** to it).
writeFileSync(join(dist, 'sprout.html'), withPreview(html, sproutPreview(WEB_URL)));
console.log(`Link previews: ${catalog.festivals.length} festivals and ${catalog.artists.length} artists.`);
