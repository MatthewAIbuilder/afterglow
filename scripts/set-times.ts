/**
 * Nightly set times from festivals' official pages (run by
 * .github/workflows/website.yml after the site pictures, before the
 * website is built):
 *
 *   npx --yes tsx@4 scripts/set-times.ts [published.json] [report.md]
 *
 * For every upcoming festival with an official `website` link and no set
 * times entered by hand, reads the page, reads the set times on it with the
 * same reader HQ uses, and when the reading is clearly right
 * (src/features/admin/pageSetTimes.ts) writes them into public/catalogue.json as a
 * "lineups" entry, so they go live with tonight's deploy. Anything less
 * clear, and anything newly published, goes into the report, which the
 * workflow puts in the nightly heads-up issue. A page that can't be read
 * tonight keeps the set times published last time (the optional argument).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_IN } from '../src/data/bundled';
import { parseCatalogFile } from '../src/data/file';
import { decide, lineupToFile, readPageSetTimes, type SetTimesNews, setTimesReport } from '../src/features/admin/pageSetTimes';
import { PAGE_MAX_CHARS } from '../src/data/import/sitePicture';
import { applyPatches, buildCatalog } from '../src/data/merge';
import type { FestivalLineup } from '../src/data/models';
import { MAX_FILE_CHARS } from '../src/data/remote';
import { livePatches } from './livePatches';

const OUT = resolve(__dirname, '../public/catalogue.json');
const HQ = 'https://afterglowmusic.app/admin';
const TIMEOUT_MS = 15_000;
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; AfterglowBot/1.0; +https://afterglowmusic.app)', Accept: 'text/html' };

async function readPage(url: string): Promise<string | undefined> {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok || !/html/i.test(res.headers.get('content-type') ?? 'text/html')) return undefined;
  return (await res.text()).slice(0, PAGE_MAX_CHARS);
}

async function main() {
  const text = readFileSync(OUT, 'utf8');
  const file = JSON.parse(text) as Record<string, unknown>;
  const parsed = parseCatalogFile(text);
  // The festivals as they are without any page-read set times, so ones entered by hand (the catalogue, HQ) are seen as such.
  const bare = parsed.snapshot ? { ...parsed, snapshot: { ...parsed.snapshot, lineups: parsed.snapshot.lineups?.filter((l) => l.source !== 'page') } } : parsed;
  const { catalog } = applyPatches(buildCatalog(BUILT_IN.snapshot, bare), await livePatches().catch(() => []), parseCatalogFile);
  const lastPath = process.argv[2];
  const reportPath = process.argv[3];
  const last = new Map<string, FestivalLineup>();
  if (lastPath && existsSync(lastPath)) for (const l of parseCatalogFile(readFileSync(lastPath, 'utf8')).snapshot?.lineups ?? []) if (l.source === 'page') last.set(l.festivalId, l);

  const today = new Date().toISOString().slice(0, 10);
  const watched = catalog.festivals.filter((f) => f.links?.website && (f.endDate ?? f.startDate ?? today) >= today && !f.sets?.length);
  const lineups: FestivalLineup[] = [];
  const news: SetTimesNews[] = [];
  let read = 0;
  let kept = 0;
  for (const f of watched) {
    const url = f.links!.website!;
    const before = last.get(f.id);
    try {
      const html = await readPage(url);
      if (!html) throw new Error('not a page');
      read++;
      const found = readPageSetTimes(html, f, catalog.artists);
      const decision = found ? decide(found) : undefined;
      if (found && decision?.publish) {
        lineups.push(found.lineup);
        const was = before?.sets?.length ?? 0;
        if (!before) news.push({ name: f.name, url, decision, change: 'new' });
        else if (was !== found.lineup.sets!.length) news.push({ name: f.name, url, decision, change: 'updated' });
        continue;
      }
      if (found && decision && !before) news.push({ name: f.name, url, decision });
    } catch {
      // Unreachable tonight: last time's set times below.
    }
    if (before) {
      lineups.push(before);
      kept++;
    }
  }

  const others = Array.isArray(file.lineups) ? (file.lineups as Record<string, unknown>[]).filter((l) => l.source !== 'page') : [];
  const all = [...others, ...lineups.map(lineupToFile)];
  const out = JSON.stringify(all.length ? { ...file, lineups: all } : (({ lineups: _none, ...rest }) => rest)(file));
  // Exactly what the app will do with it.
  const built = buildCatalog(BUILT_IN.snapshot, parseCatalogFile(out));
  if (out.length > MAX_FILE_CHARS || built.problems.length) {
    console.error(`Set times skipped: ${built.problems.slice(0, 3).join(' ') || 'the file would be too large.'}`);
    process.exit(1);
  }
  writeFileSync(OUT, `${out}\n`);
  if (reportPath && news.length) writeFileSync(reportPath, setTimesReport(news, HQ));
  console.log(
    `Set times: ${read} of ${watched.length} official pages read, ${lineups.length - kept} published from tonight's reading, ${kept} kept from last time, ${news.filter((x) => !x.decision.publish).length} found but not clear enough.`,
  );
}

main().catch((e) => {
  console.error(`Set times skipped: ${e instanceof Error ? e.message : 'unexpected error'}.`);
  process.exit(1);
});
