/**
 * Nightly EDMTrain import (run by .github/workflows/events.yml):
 *
 *   EDMTRAIN_API_KEY=... npx --yes tsx@4 scripts/import-edmtrain.ts
 *
 * Fetches upcoming festivals from EDMTrain, turns them into a catalogue file
 * with src/data/import/edmtrain.ts (festivals curated in
 * catalogue/afterglow.json always win) and writes public/catalogue.json,
 * which the website serves and the app reads (CATALOG_URL).
 *
 * It never writes a file the app would refuse, and never replaces the
 * current file with an empty one: if EDMTrain can't be reached or its answer
 * doesn't look right, it stops with an error and the old file stays.
 * The key is never printed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_IN } from '../src/data/bundled';
import { parseCatalogFile } from '../src/data/file';
import { edmtrainCatalogue, type EdmtrainEvent, IMPORT_RULES } from '../src/data/import/edmtrain';
import { buildCatalog } from '../src/data/merge';
import { MAX_FILE_CHARS } from '../src/data/remote';

const OUT = resolve(__dirname, '../public/catalogue.json');
const API = 'https://edmtrain.com/api/events';

function fail(message: string): never {
  console.error(`EDMTrain import stopped: ${message} The current catalogue.json was left as it is.`);
  process.exit(1);
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const key = process.env.EDMTRAIN_API_KEY?.trim();
  if (!key) fail('EDMTRAIN_API_KEY is not set.');

  const now = new Date();
  const today = isoDay(now);
  const until = isoDay(new Date(now.getTime() + IMPORT_RULES.maxDaysAhead * 24 * 60 * 60 * 1000));
  const url = `${API}?festivalInd=true&startDate=${today}&endDate=${until}&client=${encodeURIComponent(key)}`;

  let body: unknown;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) fail(`EDMTrain answered ${res.status}.`);
    body = await res.json();
  } catch (e) {
    fail(`couldn't reach EDMTrain (${e instanceof Error ? e.name : 'error'}).`);
  }
  const answer = body as { success?: boolean; data?: unknown; message?: string };
  if (!answer || answer.success === false || !Array.isArray(answer.data)) {
    fail(`EDMTrain's answer wasn't a list of events${answer?.message ? ` (${String(answer.message).slice(0, 200)})` : ''}.`);
  }
  const events = answer.data as EdmtrainEvent[];

  const curated = {
    artists: BUILT_IN.snapshot.artists.map((a) => ({ id: a.id, name: a.name })),
    festivals: BUILT_IN.snapshot.festivals.map((f) => ({
      id: f.id,
      name: f.name,
      location: f.location,
      start: f.startDate,
      end: f.endDate,
      weekends: f.weekends,
    })),
  };

  let maxFestivals: number = IMPORT_RULES.maxFestivals;
  let text = '';
  let result = edmtrainCatalogue(events, curated, today);
  for (;;) {
    text = JSON.stringify(result.file);
    if (text.length <= MAX_FILE_CHARS * 0.9 || maxFestivals <= 10) break;
    maxFestivals = Math.floor(maxFestivals * 0.8);
    result = edmtrainCatalogue(events, curated, today, { ...IMPORT_RULES, maxFestivals });
  }
  const { file, skipped } = result;
  if (!file.festivals.length) fail(`none of EDMTrain's ${events.length} events made a festival.`);
  if (text.length > MAX_FILE_CHARS) fail('the file would be too large for the app.');

  // Exactly what the app will do with it: read it and add it to the built-in data. Clips come
  // later, from the YouTube step (which checks the finished file with clips required).
  const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(text), { needClips: false });
  if (!built.usedFile) fail(`the app would refuse the file: ${built.problems.slice(0, 5).join(' ')}`);
  if (built.problems.length) fail(`the file has problems: ${built.problems.slice(0, 5).join(' ')}`);

  let before = '';
  try {
    before = readFileSync(OUT, 'utf8');
  } catch {}
  if (before.trim() === text) {
    console.log(`No change: ${file.festivals.length} festivals.`);
    return;
  }
  writeFileSync(OUT, `${text}\n`);
  console.log(
    `Wrote ${file.festivals.length} festivals and ${file.artists.length} new artists from ${events.length} EDMTrain events ` +
      `(left out: ${skipped.curated} already curated, ${skipped.small} with under ${IMPORT_RULES.minActs} acts, ${skipped.outOfRange} out of range).`,
  );
}

main().catch((e) => fail(e instanceof Error ? e.message : 'unexpected error.'));
