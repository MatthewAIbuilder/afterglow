import { readSetList, withEnds } from './setlist';
import type { Artist, Festival, FestivalLineup, SetTime, Stage } from '../../data/models';
import { fold, slug } from '../../data/import/edmtrain';
import { decodeEntities } from '../../data/import/pageWatch';

/**
 * Set times from a festival's official page, pure (run every night by
 * scripts/set-times.ts; the user chose on 2026-10-06 that they publish by
 * themselves). The page's text is read line by line with the same reader HQ
 * uses for pasted set times, names are matched to artists on Afterglow (no
 * artist is ever invented), and the result is published only when it is
 * clearly right: enough sets, nearly every name known, a good part of the
 * lineup covered, days that fit the festival, stages for the sets. Anything
 * less goes into the heads-up instead, for HQ. Set times entered by hand
 * always win (`applyLineup` in data/catalog.ts).
 */

/** Fewer sets than this are never published by themselves. */
export const MIN_SETS = 8;
/** At least this share of the sets read must be by artists on Afterglow. */
export const MIN_KNOWN_SHARE = 0.6;
/** At least this share of the festival's lineup must have a set. */
export const MIN_COVERAGE = 0.4;
/** At most this share of the sets may have a start with no AM or PM written. */
export const MAX_GUESSED_SHARE = 0.3;
/** At most this share of the sets may have no stage. */
export const MAX_NO_STAGE_SHARE = 0.1;
/** More days than this isn't a festival timetable. */
export const MAX_DAYS = 7;

/**
 * A page's readable text, one line per block: list items, table rows,
 * paragraphs and headings each on their own line, table cells joined with
 * " | " (so "10:00 PM | SUBTRONICS | Bass Tent" reads as one set).
 */
export function pageLines(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/(?:td|th)>/gi, ' | ')
      .replace(/<(?:br|hr)\b[^>]*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article|header|footer|ul|ol|table|dt|dd|blockquote|figcaption|option|label)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .split('\n')
    .map((l) =>
      l
        .replace(/\s+/g, ' ')
        .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
        .trim(),
    )
    .filter(Boolean)
    .join('\n');
}

export type PageSetTimes = {
  /** What would be published. */
  lineup: FestivalLineup;
  /** Sets read from the page. */
  read: number;
  /** Of those, sets by an artist on Afterglow, on a day, kept. */
  kept: number;
  /** Acts with a set who aren't on Afterglow (first appearance order). */
  unknown: string[];
  /** Share of the festival's lineup with a set. */
  coverage: number;
  /** Kept sets whose start had no AM or PM. */
  guessed: number;
  /** Kept sets with no stage. */
  noStage: number;
  /** Sets left out for want of a day. */
  noDay: number;
  /** Days read that aren't the festival's. */
  strangeDays: string[];
  unread: number;
};

/**
 * The set times on a page, matched to the festival. Undefined when the page
 * lists no set times at all.
 */
export function readPageSetTimes(html: string, festival: Festival, artists: readonly Artist[]): PageSetTimes | undefined {
  const text = pageLines(html);
  const read = readSetList(text, { days: festival.days, stages: festival.stages.map((s) => s.name) });
  if (!read.sets.length) return undefined;

  const byName = new Map<string, Artist>();
  for (const a of artists) if (!byName.has(fold(a.name))) byName.set(fold(a.name), a);
  const stages: Stage[] = [...festival.stages];
  const stageId = (name: string): string => {
    const found = stages.find((s) => fold(s.name) === fold(name));
    if (found) return found.id;
    let id = slug(name) || 'stage';
    for (let n = 2; stages.some((s) => s.id === id); n++) id = `${slug(name)}-${n}`;
    stages.push({ id, name });
    return id;
  };
  const onlyDay = festival.days.length === 1 ? festival.days[0] : read.days.length === 1 ? read.days[0] : undefined;
  const onlyStage = festival.stages.length === 1 ? festival.stages[0].name : undefined;

  const sets: SetTime[] = [];
  const unknown: string[] = [];
  let guessed = 0;
  let noStage = 0;
  let noDay = 0;
  for (const s of withEnds(read.sets)) {
    const artist = byName.get(fold(s.name));
    if (!artist) {
      if (!unknown.includes(s.name)) unknown.push(s.name);
      continue;
    }
    const day = s.day ?? onlyDay;
    if (!day) {
      noDay++;
      continue;
    }
    const stage = s.stage ?? onlyStage;
    if (!stage) noStage++;
    if (s.guessed) guessed++;
    const set: SetTime = { artistId: artist.id, day, stageId: stageId(stage ?? 'Main Stage'), start: s.start, end: s.end };
    // The same act twice on a day: the later reading wins (a page corrects itself downwards).
    const i = sets.findIndex((x) => x.artistId === set.artistId && x.day === set.day && x.stageId === set.stageId);
    if (i >= 0) sets[i] = set;
    else sets.push(set);
  }
  const days = [...new Set([...festival.days, ...sets.map((s) => s.day)])];
  const strangeDays = festival.days.length ? read.days.filter((d) => !festival.days.includes(d)) : [];
  const withSet = new Set(sets.map((s) => s.artistId));
  const coverage = festival.lineup.length ? festival.lineup.filter((id) => withSet.has(id)).length / festival.lineup.length : 0;
  const lineup: FestivalLineup = {
    festivalId: festival.id,
    artistIds: [...new Set([...festival.lineup, ...sets.map((s) => s.artistId)])],
    sets,
    days,
    stages: stages.filter((s) => festival.stages.includes(s) || sets.some((x) => x.stageId === s.id)),
    source: 'page',
  };
  return { lineup, read: read.sets.length, kept: sets.length, unknown, coverage, guessed, noStage, noDay, strangeDays, unread: read.unread.length };
}

export type Decision = { publish: true; line: string } | { publish: false; reasons: string[] };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Whether what was read is clearly right, in plain words either way. */
export function decide(r: PageSetTimes): Decision {
  const reasons: string[] = [];
  if (r.kept < MIN_SETS) reasons.push(`Only ${n(r.kept, 'set time', 'set times')} could be read (at least ${MIN_SETS} are needed).`);
  const knownShare = r.read ? (r.read - r.unknown.length) / r.read : 0;
  if (knownShare < MIN_KNOWN_SHARE)
    reasons.push(`${pct(1 - knownShare)} of the acts with set times aren't on Afterglow: ${r.unknown.slice(0, 8).join(', ')}${r.unknown.length > 8 ? ` and ${r.unknown.length - 8} more` : ''}.`);
  if (r.coverage < MIN_COVERAGE) reasons.push(`Only ${pct(r.coverage)} of the lineup has a set time: it may be the wrong page, or only part of the timetable.`);
  if (r.strangeDays.length) reasons.push(`The page names days the festival doesn't have: ${r.strangeDays.join(', ')}.`);
  if ((r.lineup.days?.length ?? 0) > MAX_DAYS) reasons.push(`${(r.lineup.days?.length ?? 0)} days is more than a festival.`);
  if (r.kept && r.guessed / r.kept > MAX_GUESSED_SHARE) reasons.push(`${n(r.guessed, 'time has', 'times have')} no AM or PM.`);
  if (r.kept && r.noStage / r.kept > MAX_NO_STAGE_SHARE) reasons.push(`${n(r.noStage, 'set has', 'sets have')} no stage.`);
  if (r.noDay) reasons.push(`${n(r.noDay, 'set has', 'sets have')} no day.`);
  if (r.unread > r.read) reasons.push(`${n(r.unread, 'line', 'lines')} couldn't be read.`);
  if (reasons.length) return { publish: false, reasons };
  const stages = r.lineup.stages?.length ?? 0;
  return {
    publish: true,
    line: `${n(r.kept, 'set time', 'set times')} over ${n((r.lineup.days?.length ?? 0), 'day', 'days')} and ${n(stages, 'stage', 'stages')}, ${pct(r.coverage)} of the lineup${r.unknown.length ? `; ${n(r.unknown.length, 'act', 'acts')} not on Afterglow left out (${r.unknown.slice(0, 5).join(', ')}${r.unknown.length > 5 ? '…' : ''})` : ''}.`,
  };
}

/** A lineup as the catalogue file writes it (data/file.ts reads it back). */
export function lineupToFile(l: FestivalLineup): Record<string, unknown> {
  return {
    festival: l.festivalId,
    artists: l.artistIds,
    ...(l.sets ? { sets: l.sets.map((s) => ({ artist: s.artistId, day: s.day, stage: s.stageId, start: s.start, end: s.end })) } : {}),
    ...(l.days ? { days: l.days } : {}),
    ...(l.stages ? { stages: l.stages } : {}),
    ...(l.source ? { source: l.source } : {}),
  };
}

export type SetTimesNews = { name: string; url: string; decision: Decision; /** First published tonight, or updated. */ change?: 'new' | 'updated' };

/** The heads-up, as part of the nightly GitHub issue. Nothing for a quiet night. */
export function setTimesReport(news: readonly SetTimesNews[], hqUrl: string): string {
  if (!news.length) return '';
  const published = news.filter((x) => x.decision.publish);
  const held = news.filter((x) => !x.decision.publish);
  const lines: string[] = [];
  if (published.length) {
    lines.push('## Set times published', '', 'Read from the official page and live now. Check them on the festival page; HQ → Data can correct them (what you enter by hand always wins).', '');
    for (const x of published) if (x.decision.publish) lines.push(`- **${x.name}**${x.change === 'updated' ? ' (updated)' : ''}: ${x.decision.line} [Official page](${x.url})`);
    lines.push('');
  }
  if (held.length) {
    lines.push('## Set times found but not published', '', `The page lists set times, but the reading isn't clear enough to go live by itself. Bring them in from [Afterglow HQ](${hqUrl}) → Data (paste them, or read a photo).`, '');
    for (const x of held) {
      if (x.decision.publish) continue;
      lines.push(`### ${x.name}`, `[Official page](${x.url})`, '', ...x.decision.reasons.map((r) => `- ${r}`), '');
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}
