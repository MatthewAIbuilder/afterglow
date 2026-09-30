/**
 * Nightly "who sounds alike" from lineups (run by .github/workflows/website.yml
 * after the EDMTrain step):
 *
 *   npx --yes tsx@4 scripts/lineup-similar.ts
 *
 * Works out pairs of artists who keep sharing bills and days
 * (src/data/import/lineupSimilar.ts), for artists without sound tags, and
 * writes them into public/catalogue.json as "similar", so what you like
 * spills over to them. Writes only if the app reads the file with no problems.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_IN } from '../src/data/bundled';
import { parseCatalogFile } from '../src/data/file';
import { lineupSimilarities } from '../src/data/import/lineupSimilar';
import { buildCatalog } from '../src/data/merge';
import { MAX_FILE_CHARS } from '../src/data/remote';

const OUT = resolve(__dirname, '../public/catalogue.json');

const text = readFileSync(OUT, 'utf8');
const file = JSON.parse(text) as Record<string, unknown>;
const { catalog } = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(text));
const tagged = new Set(catalog.artists.filter((a) => Object.keys(a.sound).length > 0).map((a) => a.id));
const pairs = lineupSimilarities(catalog.festivals, (id) => tagged.has(id));

const out = JSON.stringify({ ...file, similar: pairs });
const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(out));
if (out.length > MAX_FILE_CHARS || !built.usedFile || built.problems.length) {
  console.error(`Sounds alike skipped: ${built.problems.slice(0, 3).join(' ') || 'the file would be too large.'}`);
  process.exit(1);
}
writeFileSync(OUT, `${out}\n`);
const reached = new Set(pairs.flatMap((p) => [p.artist, p.other]).filter((id) => !tagged.has(id)));
console.log(`Sounds alike: ${pairs.length} pairs from ${catalog.festivals.length} lineups, reaching ${reached.size} artists without sound tags.`);
