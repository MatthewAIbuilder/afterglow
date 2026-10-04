import { dayHeading, readTimes, STAGE_WORDS } from './setlist';

/**
 * Turning what text recognition read off a timetable photo into text the
 * set-list reader understands, pure. Recognition reads straight across, so a
 * grid (one column per stage) comes out jumbled: `inColumns` puts each column
 * back together, top to bottom, under the headings that span the page (a day,
 * say). `tidyPhotoText` mends the usual misreads in times ("1O:3O") and joins
 * an act and its time when the picture put them on separate lines.
 */

/** One line of text as recognition found it, with its box in pixels. */
export type PhotoLine = { text: string; x0: number; x1: number; y0: number; y1: number };

/** A gap between words wider than this many line heights splits a line in two (two columns side by side). */
const COLUMN_GAP = 2.5;

/**
 * Recognition's lines, from their words: a line that runs across two or more
 * columns ("ILLENIUM   LEVITY   EXCISION") is split where the words are far
 * apart, so each column keeps its own lines.
 */
export function linesFromWords(lines: readonly (readonly PhotoLine[])[]): PhotoLine[] {
  const out: PhotoLine[] = [];
  for (const words of lines) {
    const ws = words.filter((w) => w.text.trim()).sort((a, b) => a.x0 - b.x0);
    if (!ws.length) continue;
    const height = Math.max(...ws.map((w) => w.y1 - w.y0));
    let seg: PhotoLine[] = [];
    const push = () => {
      if (!seg.length) return;
      out.push({ text: seg.map((w) => w.text.trim()).join(' '), x0: seg[0].x0, x1: Math.max(...seg.map((w) => w.x1)), y0: Math.min(...seg.map((w) => w.y0)), y1: Math.max(...seg.map((w) => w.y1)) });
      seg = [];
    };
    for (const w of ws) {
      const last = seg[seg.length - 1];
      if (last && w.x0 - last.x1 > height * COLUMN_GAP) push();
      seg.push(w);
    }
    push();
  }
  return out;
}

/** A line wider than this share of the page is a heading across every column (a day, a title). */
const BANNER = 0.5;

const overlaps = (a: { x0: number; x1: number }, b: { x0: number; x1: number }) => a.x0 <= b.x1 && a.x1 >= b.x0;

/** The lines in reading order: headings across the page, then each column top to bottom, band by band. */
export function inColumns(lines: readonly PhotoLine[], width: number): string[] {
  const kept = lines.filter((l) => l.text.trim());
  if (!kept.length || width <= 0) return [];
  // Columns from the narrowest lines up: a line that reaches across two columns is a heading, not a bridge between them.
  const cols: { x0: number; x1: number }[] = [];
  const banner = new Set<PhotoLine>();
  for (const l of [...kept].sort((a, b) => a.x1 - a.x0 - (b.x1 - b.x0))) {
    const hit = cols.filter((c) => overlaps(c, l));
    if (l.x1 - l.x0 > width * BANNER || hit.length > 1) banner.add(l);
    else if (hit.length === 1) {
      hit[0].x0 = Math.min(hit[0].x0, l.x0);
      hit[0].x1 = Math.max(hit[0].x1, l.x1);
    } else cols.push({ x0: l.x0, x1: l.x1 });
  }
  cols.sort((a, b) => a.x0 - b.x0);
  const out: string[] = [];
  let band: PhotoLine[] = [];
  const flush = () => {
    for (const c of cols) for (const l of band.filter((x) => overlaps(c, x)).sort((a, b) => a.y0 - b.y0)) out.push(l.text.trim());
    band = [];
  };
  for (const l of [...kept].sort((a, b) => a.y0 - b.y0)) {
    if (banner.has(l)) {
      flush();
      out.push(l.text.trim());
    } else band.push(l);
  }
  flush();
  return out;
}

/** "1O:3O", "l1:00", "10.30PM" → "10:30", "11:00", "10:30PM". */
const fixTimes = (line: string) =>
  line.replace(/(?<![A-Za-z])([0-9OoIl]{1,2})\s?[:.]\s?([0-9OoIl]{2})(?![A-Za-z0-9])/g, (_m, h: string, m: string) => {
    const digits = (s: string) => s.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
    return `${digits(h)}:${digits(m)}`;
  });

const onlyTime = (line: string) => {
  const t = readTimes(line);
  return !!t && !t.rest.replace(/[\s\-–—|:,.@]+/g, '');
};
const isHeading = (line: string, stages: readonly string[]) =>
  !!dayHeading(line) || STAGE_WORDS.test(line) || stages.some((s) => s.toLowerCase() === line.toLowerCase());
const plainName = (line: string, stages: readonly string[]) => !!line && !readTimes(line) && !isHeading(line, stages);

/**
 * Mend what recognition read: drop stray marks, fix times, and put a time
 * that stands on its own line together with its act (the line above it, or
 * else the line below).
 */
export function tidyPhotoText(lines: readonly string[], stages: readonly string[] = []): string {
  const clean = lines
    .map((l) => fixTimes(l.replace(/[|_~`'"“”‘’]+/g, ' ').replace(/\s+/g, ' ').trim()))
    // "FRIDAY SET TIMES" is the day Friday.
    .map((l) => l.replace(/\s+(?:set\s*times|timetable|schedule|line-?up)$/i, ''))
    .filter((l) => l && /[A-Za-z0-9]/.test(l));
  const out: string[] = [];
  const used = new Set<number>();
  clean.forEach((line, i) => {
    if (used.has(i)) return;
    if (onlyTime(line)) {
      const prev = out.length ? out[out.length - 1] : undefined;
      if (prev !== undefined && plainName(prev, stages) && !used.has(i - 1) && clean[i - 1] === prev) {
        out[out.length - 1] = `${line} ${prev}`;
        used.add(i - 1);
        return;
      }
      const next = clean[i + 1];
      if (next !== undefined && plainName(next, stages)) {
        out.push(`${line} ${next}`);
        used.add(i + 1);
        return;
      }
    }
    out.push(line);
  });
  return out.join('\n');
}
