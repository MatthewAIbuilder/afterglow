import type { Festival, SetTime } from '../../data/models';
import { toMinutes } from '../plan/plan';
import { t } from '../../i18n';

/**
 * Voting on the lineup with your crew. Pure.
 *
 * Two rounds:
 * - the lineup: everyone answers Must see / Maybe / Skip for each act, and
 *   the crew's ranking is the total (Must see 2, Maybe 1, Skip 0);
 * - the clashes (once set times are out): wherever acts the crew wants
 *   overlap, everyone picks a side.
 * What the crew decides feeds "Our route" (a winning act counts as a star
 * from everyone); your own plan only changes when you say so.
 */
export type Vote = 0 | 1 | 2;
export const MUST: Vote = 2;
export const MAYBE: Vote = 1;
export const SKIP: Vote = 0;
export const VOTES: readonly Vote[] = [MUST, MAYBE, SKIP];

export const VOTE_LABEL: Record<Vote, string> = { 2: t('Must see'), 1: t('Maybe'), 0: t('Skip') };

/** One member's votes in a crew. */
export type CrewVotes = { uid: string; lineup: Record<string, Vote>; clashes: Record<string, string>; at: string };

/** At most this many acts and clashes in one member's votes. */
export const VOTES_LINEUP_MAX = 400;
export const VOTES_CLASHES_MAX = 120;

const isVote = (v: unknown): v is Vote => v === 0 || v === 1 || v === 2;
const okKey = (k: string) => k.length > 0 && k.length <= 200;

/** One member's votes, read back (from the server or the phone) whatever their shape. */
export function cleanVotes(uid: string, raw: unknown, at = ''): CrewVotes | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const lineup: Record<string, Vote> = {};
  const clashes: Record<string, string> = {};
  if (o.lineup && typeof o.lineup === 'object')
    for (const [k, v] of Object.entries(o.lineup as Record<string, unknown>).slice(0, VOTES_LINEUP_MAX)) if (okKey(k) && isVote(v)) lineup[k] = v;
  if (o.clashes && typeof o.clashes === 'object')
    for (const [k, v] of Object.entries(o.clashes as Record<string, unknown>).slice(0, VOTES_CLASHES_MAX)) if (okKey(k) && typeof v === 'string' && okKey(v)) clashes[k] = v;
  return { uid, lineup, clashes, at: typeof o.at === 'string' ? o.at : at };
}

export type LineupRow = {
  artistId: string;
  score: number;
  must: string[];
  maybe: string[];
  skip: string[];
  /** Everyone in the crew said Must see. */
  everyone: boolean;
};

/** The crew's ranking of the lineup: highest total first, then billing. Acts nobody voted on are left out. */
export function tallyLineup(votes: readonly CrewVotes[], members: readonly string[], lineup: readonly string[]): LineupRow[] {
  const inCrew = votes.filter((v) => members.includes(v.uid));
  const rows: LineupRow[] = [];
  lineup.forEach((artistId) => {
    const must = inCrew.filter((v) => v.lineup[artistId] === MUST).map((v) => v.uid);
    const maybe = inCrew.filter((v) => v.lineup[artistId] === MAYBE).map((v) => v.uid);
    const skip = inCrew.filter((v) => v.lineup[artistId] === SKIP).map((v) => v.uid);
    if (!must.length && !maybe.length && !skip.length) return;
    rows.push({ artistId, score: must.length * 2 + maybe.length, must, maybe, skip, everyone: members.length > 1 && must.length === members.length });
  });
  const billing = new Map(lineup.map((id, i) => [id, i]));
  return rows.sort((a, b) => b.score - a.score || b.must.length - a.must.length || (billing.get(a.artistId) ?? 0) - (billing.get(b.artistId) ?? 0));
}

/** How far through the lineup each member is (acts answered). */
export const votedCount = (v: CrewVotes | undefined, lineup: readonly string[]) => (v ? lineup.filter((id) => id in v.lineup).length : 0);

/** The next act for you to answer, in billing order (undefined when you've answered them all). */
export function nextToVote(mine: CrewVotes | undefined, lineup: readonly string[], skipped: ReadonlySet<string> = new Set()): string | undefined {
  return lineup.find((id) => !(mine && id in mine.lineup) && !skipped.has(id));
}

// ---------------------------------------------------------------------------
// The clash round

export type ClashSlot = { key: string; day: string; start: number; end: number; sets: { artistId: string; set: SetTime }[] };

/** Acts the crew wants enough to settle a clash over: anyone's Must see, or a total of 2 or more. */
export const wanted = (rows: readonly LineupRow[]) => new Set(rows.filter((r) => r.must.length || r.score >= 2).map((r) => r.artistId));

/**
 * Wherever the acts the crew wants overlap, day by day, in time order. The
 * key names the day and the acts, so it stays the same however the times
 * are written.
 */
export function clashSlots(festival: Festival, want: ReadonlySet<string>): ClashSlot[] {
  const timed = (festival.sets ?? [])
    .filter((s) => want.has(s.artistId))
    .map((set) => {
      const start = toMinutes(set.start);
      let end = toMinutes(set.end);
      if (end <= start) end += 24 * 60;
      return { set, start, end };
    });
  const out: ClashSlot[] = [];
  for (const day of festival.days) {
    const today = timed.filter((x) => x.set.day === day).sort((a, b) => a.start - b.start);
    let group: typeof today = [];
    let reach = -Infinity;
    const close = () => {
      if (group.length > 1) {
        const ids = [...new Set(group.map((g) => g.set.artistId))].sort();
        if (ids.length > 1) out.push({ key: `${day}|${ids.join('+')}`, day, start: group[0].start, end: Math.max(...group.map((g) => g.end)), sets: group.map((g) => ({ artistId: g.set.artistId, set: g.set })) });
      }
    };
    for (const x of today) {
      if (x.start < reach) group.push(x);
      else {
        close();
        group = [x];
      }
      reach = Math.max(reach, x.end);
    }
    close();
  }
  return out;
}

export type ClashResult = { counts: Record<string, string[]>; winner?: string; tie: boolean; voted: number };

/** Who picked which side of a clash, and the winner (a tie when the top two are level). */
export function tallyClash(slot: ClashSlot, votes: readonly CrewVotes[], members: readonly string[]): ClashResult {
  const counts: Record<string, string[]> = {};
  for (const s of slot.sets) counts[s.artistId] = [];
  let voted = 0;
  for (const v of votes) {
    if (!members.includes(v.uid)) continue;
    const pick = v.clashes[slot.key];
    if (pick && pick in counts) {
      counts[pick].push(v.uid);
      voted += 1;
    }
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1].length - a[1].length);
  const top = ranked[0];
  const tie = !!top && ranked.length > 1 && ranked[1][1].length === top[1].length;
  return { counts, ...(top && top[1].length && !tie ? { winner: top[0] } : {}), tie: !!top && top[1].length > 0 && tie, voted };
}

/**
 * What the crew decided, as stars for "Our route": each member's Must sees
 * count as their stars, and a clash's winner counts as a star from everyone
 * (so the route goes there together).
 */
export function starsFromVotes(votes: readonly CrewVotes[], members: readonly string[], slots: readonly ClashSlot[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const v of votes) if (members.includes(v.uid)) out[v.uid] = Object.entries(v.lineup).filter(([, x]) => x === MUST).map(([id]) => id);
  for (const slot of slots) {
    const { winner } = tallyClash(slot, votes, members);
    if (winner) for (const m of members) out[m] = [...new Set([...(out[m] ?? []), winner])];
  }
  return out;
}

/** Everyone's stars and votes together: what "Our route" plans from. */
export function mergeStars(stars: Record<string, readonly string[]>, fromVotes: Record<string, readonly string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const uid of new Set([...Object.keys(stars), ...Object.keys(fromVotes)])) out[uid] = [...new Set([...(stars[uid] ?? []), ...(fromVotes[uid] ?? [])])];
  return out;
}

/** "3 of 4: John Summit over Odd Mob", "A split: 2 and 2". */
export function clashLine(slot: ClashSlot, result: ClashResult, nameOf: (artistId: string) => string, members: number): string {
  if (!result.voted) return t('Nobody’s picked yet');
  if (result.tie) return t('A split: {counts}', { counts: Object.values(result.counts).map((w) => w.length).join(t(' and ')) });
  const winner = result.winner!;
  const others = slot.sets.map((s) => s.artistId).filter((id, i, all) => id !== winner && all.indexOf(id) === i);
  return t('{n} of {m}: {winner} over {others}', { n: result.counts[winner].length, m: members, winner: nameOf(winner), others: others.map(nameOf).join(t(' and ')) });
}

/** For screen readers and the results list: who said what about an act. */
export function rowLine(row: LineupRow, nameOf: (uid: string) => string): string {
  const parts = [];
  if (row.must.length) parts.push(t('Must see: {names}', { names: row.must.map(nameOf).join(', ') }));
  if (row.maybe.length) parts.push(t('Maybe: {names}', { names: row.maybe.map(nameOf).join(', ') }));
  if (row.skip.length) parts.push(t('Skip: {names}', { names: row.skip.map(nameOf).join(', ') }));
  return parts.join('. ');
}

