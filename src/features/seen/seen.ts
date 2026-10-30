import type { Rating } from '../taste/ratings';
import { RATINGS } from '../taste/ratings';
import { t } from '../../i18n';

/**
 * Sets you've seen: every set you were at, festival by festival, and how it
 * was. Kept on the phone (`setsSeen.v1`, per account). Pure.
 *
 * A set counts as seen when you rate it ("How was it?" when it ends), say you
 * were there, or filmed it (a memory tagged with the festival and artist).
 * Rating a set is an explicit signal: it fills in the artist's rating when
 * you hadn't given one, or warms it up, and never cools it (one off night
 * doesn't make an artist "not for you").
 */
export type SetVerdict = 'unreal' | 'great' | 'good' | 'meh';
export const VERDICTS: readonly SetVerdict[] = ['unreal', 'great', 'good', 'meh'];

export const VERDICT_LABEL: Record<SetVerdict, string> = {
  unreal: t('Unreal'),
  great: t('Great'),
  good: t('Good'),
  meh: t('Not for me'),
};

/** What a verdict says about the artist, on the five-step scale. */
export const VERDICT_RATING: Record<SetVerdict, Rating> = { unreal: 'love', great: 'like', good: 'ok', meh: 'meh' };

export type SeenSet = {
  festivalId: string;
  artistId: string;
  /** The festival day ("Friday"), when known. */
  day?: string;
  /** When you saw it (ms): the set's end, or when you said so. */
  at: number;
  verdict?: SetVerdict;
};
export type SetsSeen = Record<string, SeenSet>;

export const seenKey = (festivalId: string, artistId: string, day?: string) => `${festivalId}:${artistId}:${day ?? ''}`;

const isVerdict = (v: unknown): v is SetVerdict => typeof v === 'string' && (VERDICTS as readonly string[]).includes(v);
const okId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;

/** Sets seen read back from storage, whatever shape they're in. */
export function cleanSeen(raw: unknown): SetsSeen {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SetsSeen = {};
  for (const v of Object.values(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const s = v as Record<string, unknown>;
    if (!okId(s.festivalId) || !okId(s.artistId) || typeof s.at !== 'number' || !Number.isFinite(s.at)) continue;
    const day = okId(s.day) ? s.day : undefined;
    const set: SeenSet = { festivalId: s.festivalId, artistId: s.artistId, ...(day ? { day } : {}), at: s.at, ...(isVerdict(s.verdict) ? { verdict: s.verdict } : {}) };
    out[seenKey(set.festivalId, set.artistId, set.day)] = set;
  }
  return out;
}

/** You were there (with how it was, when you said). A later verdict replaces an earlier one. */
export function markSeen(all: SetsSeen, set: SeenSet): SetsSeen {
  const key = seenKey(set.festivalId, set.artistId, set.day);
  const before = all[key];
  const verdict = set.verdict ?? before?.verdict;
  return { ...all, [key]: { ...before, ...set, ...(verdict ? { verdict } : {}) } };
}

/** You weren't there after all. */
export function unmarkSeen(all: SetsSeen, festivalId: string, artistId: string, day?: string): SetsSeen {
  const { [seenKey(festivalId, artistId, day)]: _, ...rest } = all;
  return rest;
}

/**
 * The artist rating a verdict leads to: the verdict's when you hadn't rated
 * them, or when it's warmer than yours; otherwise yours stays.
 */
export function ratingAfter(current: Rating | undefined, verdict: SetVerdict): Rating | undefined {
  const next = VERDICT_RATING[verdict];
  if (!current) return next;
  return RATINGS.indexOf(next) < RATINGS.indexOf(current) ? next : undefined;
}

/** Memories you filmed at a festival of an artist, as sets seen (no verdict). */
export function seenFromMemories(memories: readonly { capturedAt: string; festivalId?: string; artistId?: string }[]): SeenSet[] {
  const out = new Map<string, SeenSet>();
  for (const m of memories) {
    if (!m.festivalId || !m.artistId) continue;
    const at = Date.parse(m.capturedAt);
    if (!Number.isFinite(at)) continue;
    const key = `${m.festivalId}:${m.artistId}`;
    const was = out.get(key);
    if (!was || at < was.at) out.set(key, { festivalId: m.festivalId, artistId: m.artistId, at });
  }
  return [...out.values()];
}

export type SeenFestival = { festivalId: string; sets: (SeenSet & { filmed: boolean })[]; last: number };

/**
 * Everything you've seen, by festival (most recent first), each festival's
 * sets in the order you saw them. A set you rated and filmed shows once.
 */
export function seenByFestival(saved: SetsSeen, filmed: readonly SeenSet[]): SeenFestival[] {
  const sets = new Map<string, SeenSet & { filmed: boolean }>();
  for (const s of Object.values(saved)) sets.set(`${s.festivalId}:${s.artistId}`, { ...s, filmed: false });
  for (const f of filmed) {
    const key = `${f.festivalId}:${f.artistId}`;
    const was = sets.get(key);
    sets.set(key, was ? { ...was, filmed: true } : { ...f, filmed: true });
  }
  const by = new Map<string, SeenFestival>();
  for (const s of sets.values()) {
    const g = by.get(s.festivalId) ?? { festivalId: s.festivalId, sets: [], last: 0 };
    g.sets.push(s);
    g.last = Math.max(g.last, s.at);
    by.set(s.festivalId, g);
  }
  for (const g of by.values()) g.sets.sort((a, b) => a.at - b.at);
  return [...by.values()].sort((a, b) => b.last - a.last);
}

/** How many times you've seen each artist live, most first (ties by most recent). */
export function timesSeen(groups: readonly SeenFestival[]): { artistId: string; times: number; last: number }[] {
  const by = new Map<string, { artistId: string; times: number; last: number }>();
  for (const g of groups)
    for (const s of g.sets) {
      const was = by.get(s.artistId) ?? { artistId: s.artistId, times: 0, last: 0 };
      by.set(s.artistId, { artistId: s.artistId, times: was.times + 1, last: Math.max(was.last, s.at) });
    }
  return [...by.values()].sort((a, b) => b.times - a.times || b.last - a.last);
}

// ---------------------------------------------------------------------------
// "How was it?"

/** Ask about a set only if you'd have been there a good while. */
export const ASK_MIN_STINT = 20;
/** The question comes this long after you leave the set. */
export const ASK_AFTER_MIN = 5;
/** In the app, a set stays askable for this long after it ends. */
export const ASK_FOR_MS = 3 * 3600_000;

export type Askable = { festivalId: string; artistId: string; day: string; endsAt: number };

/** Sets on your route that ended within `ASK_FOR_MS` and that you haven't answered (or waved off), newest first. */
export function setsToAsk(ended: readonly Askable[], saved: SetsSeen, waved: ReadonlySet<string>, now: number): Askable[] {
  return ended
    .filter((s) => s.endsAt <= now && now - s.endsAt <= ASK_FOR_MS)
    .filter((s) => !saved[seenKey(s.festivalId, s.artistId, s.day)]?.verdict && !waved.has(seenKey(s.festivalId, s.artistId, s.day)))
    .sort((a, b) => b.endsAt - a.endsAt);
}
