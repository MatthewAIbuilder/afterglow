/**
 * Nightly artist colours (run by .github/workflows/website.yml after the
 * photo step; needs `jpeg-js`, which the workflow installs just for it):
 *
 *   npx --yes tsx@4 scripts/artist-colors.ts [published.json]
 *
 * For each artist showing a photo (the nightly photo list, or one set in the
 * catalogue), takes the most present vivid colour from a small copy of it
 * (src/data/import/colors.ts) and writes them into public/catalogue.json as
 * "colors". Colours from last night are kept while the photo is the same.
 * Writes only if the app reads the file with no problems.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_IN } from '../src/data/bundled';
import { parseCatalogFile } from '../src/data/file';
import { dominantColor, smallPhotoUrl } from '../src/data/import/colors';
import { buildCatalog } from '../src/data/merge';

const OUT = resolve(__dirname, '../public/catalogue.json');
const MAX_NEW = 600;

async function main() {
  let decode: (data: Uint8Array, opts: { useTArray: true }) => { width: number; height: number; data: Uint8Array };
  try {
    const name = 'jpeg-js'; // installed by the workflow step only, so not a dependency of the app
    decode = ((await import(name)) as { decode: typeof decode }).decode;
  } catch {
    console.warn('Artist colours skipped: jpeg-js is not installed.');
    return;
  }
  const text = readFileSync(OUT, 'utf8');
  const file = JSON.parse(text) as Record<string, unknown>;
  const { catalog } = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(text));
  const withPhoto = catalog.artists.filter((a) => a.imageUrl);

  // Last night's colours, kept for artists whose photo hasn't changed.
  const lastPath = process.argv[2];
  const last = lastPath && existsSync(lastPath) ? parseCatalogFile(readFileSync(lastPath, 'utf8')) : undefined;
  const lastPhotos = last?.photos ?? {};
  const lastColors = last?.colors ?? {};

  const colors: Record<string, string> = {};
  let fresh = 0;
  let tried = 0;
  for (const a of withPhoto) {
    if (lastColors[a.id] && lastPhotos[a.id] === a.imageUrl) {
      colors[a.id] = lastColors[a.id];
      continue;
    }
    if (tried >= MAX_NEW) continue;
    tried++;
    try {
      const res = await fetch(smallPhotoUrl(a.imageUrl!));
      if (!res.ok) continue;
      const img = decode(new Uint8Array(await res.arrayBuffer()), { useTArray: true });
      const c = dominantColor(img.data, img.width, img.height);
      if (c) {
        colors[a.id] = c;
        fresh++;
      }
    } catch {
      // Not a JPEG, or unreachable: this artist keeps the app's colours tonight.
    }
  }

  const out = JSON.stringify({ ...file, colors });
  const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(out));
  if (!built.usedFile || built.problems.length) {
    console.error(`Artist colours skipped: ${built.problems.slice(0, 3).join(' ')}`);
    process.exit(1);
  }
  writeFileSync(OUT, `${out}\n`);
  console.log(`Artist colours: ${Object.keys(colors).length} of ${withPhoto.length} artists with photos (${fresh} new).`);
}

main().catch((e) => {
  console.error(`Artist colours skipped: ${e instanceof Error ? e.message : 'unexpected error'}.`);
  process.exit(1);
});
