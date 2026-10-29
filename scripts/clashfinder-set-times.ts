/**
 * Nightly set times from Clashfinder (run by .github/workflows/website.yml
 * right after the set times from official pages, before the website is built):
 *
 *   CLASHFINDER_USERNAME=… CLASHFINDER_PRIVATE_KEY=… npx --yes tsx@4 scripts/clashfinder-set-times.ts [published.json] [report.md]
 *
 * For every festival starting within `WINDOW_DAYS` with no set times yet
 * (none entered by hand, none read from its official page tonight), finds its
 * clashfinder, reads it (src/features/admin/clashfinder.ts) and applies the
 * same checks as the official-page reader (`decide`). A clear reading is
 * written into public/catalogue.json as a "lineups" entry (`"source": "page"`,
 * so it only ever adds, and set times entered by hand still win), marked
 * `"from": "clashfinder"`. A night Clashfinder can't be reached keeps last
 * night's (the optional published file).
 *
 * Clashfinder's data is CC BY-NC 3.0. Until Afterglow has their permission
 * (`CLASHFINDER_PUBLISH`), nothing is published: the report only says what
 * would be. Without the two secrets the step does nothing.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_IN } from '../src/data/bundled';
import { parseCatalogFile } from '../src/data/file';
import { type ClashfinderEvent, type ClashfinderSummary, findClashfinder, publicKeyInput, readClashfinder } from '../src/features/admin/clashfinder';
import { decide, lineupToFile } from '../src/features/admin/pageSetTimes';
import { applyPatches, buildCatalog } from '../src/data/merge';
import { MAX_FILE_CHARS } from '../src/data/remote';
import { livePatches } from './livePatches';

/** Publish what's clearly right, or only report it. On once Clashfinder says yes (halvin@clashfinder.com). */
const CLASHFINDER_PUBLISH = false;
/** Festivals starting within this many days are looked up (set times come out about a week before). */
const WINDOW_DAYS = 21;
/** Stays well inside Clashfinder's limit (10 requests in 5 minutes from March 2027). */
const MAX_EVENTS_PER_NIGHT = 8;
const PAUSE_MS = 31_000;
const TIMEOUT_MS = 30_000;
const OUT = resolve(__dirname, '../public/catalogue.json');
const FROM = 'clashfinder';

const username = process.env.CLASHFINDER_USERNAME?.trim() ?? '';
const privateKey = process.env.CLASHFINDER_PRIVATE_KEY?.trim() ?? '';
const auth = () => `authUsername=${encodeURIComponent(username)}&authPublicKey=${createHash('sha256').update(publicKeyInput(username, privateKey)).digest('hex')}`;
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`https://clashfinder.com/data/${path}?${auth()}`, {
    headers: { 'User-Agent': 'AfterglowBot/1.0 (+https://afterglowmusic.app)', Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Clashfinder answered ${res.status}`);
  return (await res.json()) as T;
}

async function main() {
  if (!username || !privateKey) {
    console.log('Clashfinder: no account set (CLASHFINDER_USERNAME, CLASHFINDER_PRIVATE_KEY); skipped.');
    return;
  }
  const text = readFileSync(OUT, 'utf8');
  const file = JSON.parse(text) as Record<string, unknown>;
  const fileLineups = Array.isArray(file.lineups) ? (file.lineups as Record<string, unknown>[]) : [];
  // Festivals as the app will see them tonight (official-page set times included), without last night's Clashfinder ones.
  const { catalog } = applyPatches(buildCatalog(BUILT_IN.snapshot, parseCatalogFile(text)), await livePatches().catch(() => []), parseCatalogFile);

  const lastPath = process.argv[2];
  const reportPath = process.argv[3];
  const last = new Map<string, Record<string, unknown>>();
  if (lastPath && existsSync(lastPath)) {
    try {
      const published = JSON.parse(readFileSync(lastPath, 'utf8')) as { lineups?: Record<string, unknown>[] };
      for (const l of published.lineups ?? []) if (l?.from === FROM && typeof l.festival === 'string') last.set(l.festival, l);
    } catch {
      // No usable published file: nothing to keep.
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const watched = catalog.festivals
    .filter((f) => f.startDate && (f.endDate ?? f.startDate) >= today && f.startDate <= until && !f.sets?.length)
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));

  const kept: Record<string, unknown>[] = [];
  const lines: string[] = [];
  let found = 0;
  let clear = 0;
  let all: Record<string, ClashfinderSummary> | undefined;
  try {
    if (watched.length) all = await getJson<Record<string, ClashfinderSummary>>('events/all.json');
  } catch (e) {
    console.log(`Clashfinder: the list couldn't be read tonight (${e instanceof Error ? e.message : 'error'}); keeping last night's.`);
  }

  let asked = 0;
  for (const f of watched) {
    const before = last.get(f.id);
    const match = all ? findClashfinder(f, all) : undefined;
    if (!all || !match || asked >= MAX_EVENTS_PER_NIGHT) {
      if (before && CLASHFINDER_PUBLISH) kept.push(before);
      continue;
    }
    found++;
    if (asked++) await wait(PAUSE_MS);
    try {
      const data = await getJson<ClashfinderEvent>(`event/${encodeURIComponent(match.name)}.json`);
      const reading = readClashfinder(data, f, catalog.artists);
      if (!reading) continue;
      const decision = decide(reading);
      const url = `https://clashfinder.com/s/${match.name}/`;
      if (decision.publish) {
        clear++;
        if (CLASHFINDER_PUBLISH) kept.push({ ...lineupToFile(reading.lineup), from: FROM });
        lines.push(`- **${f.name}**${CLASHFINDER_PUBLISH ? '' : ' (would publish)'}: ${decision.line} [Clashfinder](${url})`);
      } else {
        if (before && CLASHFINDER_PUBLISH) kept.push(before);
        lines.push(`- **${f.name}** (not clear enough): ${decision.reasons.join(' ')} [Clashfinder](${url})`);
      }
    } catch {
      if (before && CLASHFINDER_PUBLISH) kept.push(before);
    }
  }

  const others = fileLineups.filter((l) => l?.from !== FROM);
  const lineups = [...others, ...kept];
  const out = JSON.stringify(lineups.length ? { ...file, lineups } : (({ lineups: _none, ...rest }) => rest)(file));
  const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(out));
  if (out.length > MAX_FILE_CHARS || built.problems.length) {
    console.error(`Clashfinder set times skipped: ${built.problems.slice(0, 3).join(' ') || 'the file would be too large.'}`);
    process.exit(1);
  }
  writeFileSync(OUT, `${out}\n`);
  if (reportPath && lines.length) {
    const head = CLASHFINDER_PUBLISH
      ? '## Set times from Clashfinder\n\nFrom the fan timetables at clashfinder.com (CC BY-NC 3.0, used with permission). Set times entered by hand always win.\n'
      : '## Set times on Clashfinder (not published)\n\nThese are on clashfinder.com but aren\'t published until Clashfinder gives permission (their data is for non-commercial use). Enter any you need by hand in HQ → Data.\n';
    writeFileSync(reportPath, `${head}\n${lines.join('\n')}\n\n`, { flag: 'a' });
  }
  console.log(
    `Clashfinder: ${watched.length} festivals in the next ${WINDOW_DAYS} days without set times, ${found} on Clashfinder, ${clear} clear${CLASHFINDER_PUBLISH ? `, ${kept.length} published` : ' (publishing is off until Clashfinder says yes)'}.`,
  );
}

main().catch((e) => {
  console.error(`Clashfinder set times skipped: ${e instanceof Error ? e.message : 'unexpected error'}.`);
  process.exit(1);
});
