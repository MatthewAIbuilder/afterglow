import { WEB_URL } from '../../config/app';
import type { Festival } from '../../data/models';
import { runsOf } from '../festivals/when';
import { questDay } from '../quests/daily';

/**
 * Sprouts: little green collectibles you give people at festivals (a rave
 * tradition). Pure.
 *
 * - Giving: each sprout has its own id, made on the phone, and a link
 *   (`https://afterglowmusic.app/sprout/<id>?…`) shown as a code to scan.
 *   The link carries who it's from and what kind it is, so it reads with no
 *   signal, and a phone's own camera opens it on the website for someone
 *   without the app. A sprout can be picked up once.
 * - Seeds: a few a day (`SEEDS_PER_DAY`), more on a festival day you're at.
 * - Growing: a plain sprout grows with what you do after it reaches you
 *   (festival days, videos you film, sprouts you give, sets you watch). At
 *   full bloom it becomes a kind, decided by what grew it most, and from
 *   then on you can give sprouts of that kind too. Sprouts that arrive as a
 *   kind are already grown.
 */

export type SproutKind = 'seedling' | 'plur' | 'wanderer' | 'bass' | 'melody' | 'groove' | 'spotlight' | 'sunrise';

export type KindSpec = {
  id: SproutKind;
  name: string;
  /** How it grows (or "Every sprout starts here"). */
  how: string;
  /** A short line about it. */
  about: string;
  /** Body tint and the accent on top. */
  body: [string, string];
  accent: string;
};

export const SPROUT_KINDS: readonly KindSpec[] = [
  { id: 'seedling', name: 'Sprout', how: 'Every sprout starts here', about: 'A little green hello. Grow it and it becomes something of its own.', body: ['#8FF0B4', '#2FB36B'], accent: '#6EE7A0' },
  { id: 'plur', name: 'PLUR sprout', how: 'Grows from giving sprouts away', about: 'Peace, love, unity, respect. Grown by passing the love on.', body: ['#9EF2C0', '#2FB36B'], accent: '#FF7EB6' },
  { id: 'wanderer', name: 'Wanderer sprout', how: 'Grows from festival days', about: 'Grown in the field, one festival day at a time.', body: ['#A8F0B0', '#3BAA5C'], accent: '#FFB86B' },
  { id: 'bass', name: 'Bass sprout', how: 'Grows from watching heavy sets', about: 'Grown on dubstep, riddim and trap. Shakes a little.', body: ['#8EE8C8', '#22A07A'], accent: '#5B8CFF' },
  { id: 'melody', name: 'Melody sprout', how: 'Grows from watching melodic sets', about: 'Grown on melodic bass and big feelings.', body: ['#A4EFC0', '#2FB36B'], accent: '#A97CFF' },
  { id: 'groove', name: 'Groove sprout', how: 'Grows from watching house and techno', about: 'Grown on four to the floor. Never stops moving.', body: ['#8DEBD2', '#1F9C86'], accent: '#5BE3B5' },
  { id: 'spotlight', name: 'Spotlight sprout', how: 'Grows from filming your own videos', about: 'Grown by catching the moment.', body: ['#B4F0A8', '#45A84F'], accent: '#FFD58A' },
  { id: 'sunrise', name: 'Sunrise sprout', how: 'Grows from filming at sunrise', about: 'Grown by the ones still dancing when the sun comes up.', body: ['#C2F0A0', '#4DA844'], accent: '#FF9F5A' },
];

export const kindOf = (id: string): KindSpec => SPROUT_KINDS.find((k) => k.id === id) ?? SPROUT_KINDS[0];
export const isKind = (k: unknown): k is SproutKind => typeof k === 'string' && SPROUT_KINDS.some((s) => s.id === k);

/** Seeds to give each day (days turn over at 4 AM, like quests), and on a festival day you're at. */
export const SEEDS_PER_DAY = 5;
export const SEEDS_FESTIVAL_DAY = 10;
/** An unclaimed sprout can be picked up for this long (the rules say the same). */
export const SPROUT_KEEP_DAYS = 30;
/** A note with a sprout, at most this long. */
export const SPROUT_NOTE_MAX = 60;

/** Sprout ids: this many characters from `ID_CHARS`. Long enough that nobody guesses one. */
export const SPROUT_ID_LENGTH = 20;
const ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';
const ID = /^[a-z0-9]{12,40}$/;
const UID = /^[A-Za-z0-9_-]{1,128}$/;
const HANDLE = /^[a-z0-9._]{3,20}$/;
const NAME_MAX = 24;

export function sproutIdFrom(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < SPROUT_ID_LENGTH; i++) out += ID_CHARS[(bytes[i] ?? 0) % ID_CHARS.length];
  return out;
}
export const isSproutId = (id: unknown): id is string => typeof id === 'string' && ID.test(id);

/** An artist's sprout: which artist (their name travels with it, for screens that can't look them up). */
export type SproutArtist = { id: string; name: string };
const ARTIST_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ARTIST_NAME_MAX = 60;
/** An artist from a link or saved data, or undefined if it isn't one. */
export function cleanSproutArtist(raw: unknown): SproutArtist | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !ARTIST_ID.test(o.id)) return undefined;
  const name = typeof o.name === 'string' ? o.name.replace(/\s+/g, ' ').trim().slice(0, ARTIST_NAME_MAX) : '';
  return name ? { id: o.id, name } : undefined;
}

/** What a sprout code says: enough to show it with no signal. */
export type SproutCard = { id: string; kind: SproutKind; from: string; handle: string; name: string; artist?: SproutArtist };

export function sproutLink(card: SproutCard, base = WEB_URL): string {
  const name = card.name.trim().slice(0, NAME_MAX);
  const artist = card.artist ? `&a=${encodeURIComponent(card.artist.id)}&an=${encodeURIComponent(card.artist.name)}` : '';
  const q = `u=${encodeURIComponent(card.from)}&h=${encodeURIComponent(card.handle)}&k=${card.kind}${name ? `&n=${encodeURIComponent(name)}` : ''}${artist}`;
  return `${base.replace(/\/+$/, '')}/sprout/${card.id}?${q}`;
}

/** A card from a link's parts, or the route params of `/sprout/[id]`. */
export function sproutCardFrom(parts: { id?: unknown; u?: unknown; h?: unknown; k?: unknown; n?: unknown; a?: unknown; an?: unknown }): SproutCard | undefined {
  const id = typeof parts.id === 'string' ? parts.id : '';
  const from = typeof parts.u === 'string' ? parts.u : '';
  const handle = typeof parts.h === 'string' ? parts.h.trim().toLowerCase().replace(/^@/, '') : '';
  if (!isSproutId(id) || !UID.test(from) || !HANDLE.test(handle)) return undefined;
  const name = typeof parts.n === 'string' ? parts.n.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '';
  const artist = cleanSproutArtist({ id: parts.a, name: parts.an });
  return { id, from, handle, name: name || handle, kind: isKind(parts.k) ? parts.k : 'seedling', ...(artist ? { artist } : {}) };
}

/** A scanned code, if it's an Afterglow sprout (from any Afterglow address, or `afterglow://sprout/…`). */
export function readSproutLink(text: string): SproutCard | undefined {
  const m = /^(?:https:\/\/(?:www\.)?(?:afterglowmusic\.app|afterglowmusic\.web\.app)|afterglow:\/)\/sprout\/([a-z0-9]+)\?([^#]*)$/i.exec(text.trim());
  if (!m) return undefined;
  const params: Record<string, string> = {};
  for (const pair of m[2].split('&')) {
    const i = pair.indexOf('=');
    if (i <= 0) continue;
    try {
      params[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    } catch {
      return undefined;
    }
  }
  return sproutCardFrom({ id: m[1], u: params.u, h: params.h, k: params.k, n: params.n, a: params.a, an: params.an });
}

/** A sprout's name: "PLUR sprout", or an artist's ("SUBTRONICS sprout"). */
export const sproutName = (s: { kind: SproutKind; artist?: SproutArtist }) => (s.artist ? `${s.artist.name} sprout` : kindOf(s.kind).name);
const an = (name: string) => (/^[AEIOU]/i.test(name) ? 'an' : 'a');
/** "a PLUR sprout", "an ILLENIUM sprout". */
export const aSprout = (s: { kind: SproutKind; artist?: SproutArtist }) => `${an(sproutName(s))} ${sproutName(s)}`;

/** "Maya gave you a PLUR sprout". */
export const giftTitle = (card: Pick<SproutCard, 'name' | 'kind' | 'artist'>) => `${card.name} gave you ${aSprout(card)}`;

/** A sprout cleaned up for its note. */
export const cleanSproutNote = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, SPROUT_NOTE_MAX);

// ---- Seeds ---------------------------------------------------------------

/** Seeds today: `SEEDS_PER_DAY`, or `SEEDS_FESTIVAL_DAY` on a festival day you're at. */
export const seedsToday = (festivalDay: boolean) => (festivalDay ? SEEDS_FESTIVAL_DAY : SEEDS_PER_DAY);

/** Seeds left today, from when you gave (taken-back ones are left out by the caller). */
export function seedsLeft(givenAt: readonly number[], now: number, festivalDay: boolean): number {
  const today = questDay(now);
  return Math.max(0, seedsToday(festivalDay) - givenAt.filter((t) => questDay(t) === today).length);
}

/** "3 of 5 seeds left today" / "No seeds left today. New ones at 4 AM." */
export function seedsLine(left: number, festivalDay: boolean): string {
  const total = seedsToday(festivalDay);
  if (left <= 0) return 'No seeds left today. New ones at 4 AM.';
  return `${left} of ${total} seeds left today${festivalDay ? ' · festival day, double seeds' : ''}`;
}

// ---- Growing -------------------------------------------------------------

export type Stage = 0 | 1 | 2 | 3;
/** Growth needed for each stage: seed, sprout, leafy, in bloom. */
export const GROW_AT = [0, 6, 18, 36] as const;
export const STAGE_NAMES = ['Seed', 'Sprout', 'Leafy', 'In bloom'] as const;
/** Growth for each thing you do. */
export const GROWTH = { watch: 1, film: 3, give: 4, festivalDay: 8 } as const;

/** Everything that grows sprouts, with when it happened. */
export type Journey = {
  /** Sets on screen: when, and the set's sound. */
  watched: readonly { at: number; sound?: string }[];
  /** Your videos: when they were filmed (ms). */
  filmed: readonly number[];
  /** Sprouts you gave. */
  gave: readonly number[];
  /** Festival days you were at: the middle of each day (ms). */
  festivalDays: readonly number[];
};

const HEAVY = new Set(['dubstep', 'riddim', 'trap', 'hip-hop']);
const GROOVE = new Set(['house', 'techno']);

/**
 * Mid-day of each festival day you're going to, up to now. With `goingSince`, a day counts only when
 * you'd marked the festival going before it (ticking "I'm going" on the day itself doesn't count).
 */
export function festivalDaysOf(festivals: readonly Festival[], going: readonly string[], now: number, goingSince?: (festivalId: string) => number): number[] {
  const out: number[] = [];
  for (const f of festivals) {
    if (!going.includes(f.id)) continue;
    for (const r of runsOf(f)) {
      const [y, m, d] = r.start.split('-').map(Number);
      const [ey, em, ed] = r.end.split('-').map(Number);
      const end = new Date(ey, em - 1, ed, 12).getTime();
      const since = goingSince?.(f.id) ?? 0;
      for (let t = new Date(y, m - 1, d, 12); t.getTime() <= end && t.getTime() <= now; t.setDate(t.getDate() + 1)) if (since < t.getTime()) out.push(t.getTime());
    }
  }
  return out;
}

export type Growth = { points: number; stage: Stage; /** Share of the way to the next stage (1 at bloom). */ toNext: number; /** The kind it's growing towards. */ leaning: SproutKind };

/** How far a plain sprout has grown since it reached you (`since`), up to `now`. */
export function growthOf(journey: Journey, since: number, now: number): Growth {
  const inWindow = (t: number) => t >= since && t <= now;
  const watched = journey.watched.filter((w) => inWindow(w.at));
  const filmed = journey.filmed.filter(inWindow);
  const tracks = {
    festivalDay: journey.festivalDays.filter(inWindow).length * GROWTH.festivalDay,
    give: journey.gave.filter(inWindow).length * GROWTH.give,
    film: filmed.length * GROWTH.film,
    watch: watched.length * GROWTH.watch,
  };
  const points = tracks.festivalDay + tracks.give + tracks.film + tracks.watch;
  const stage = (GROW_AT.filter((g) => points >= g).length - 1) as Stage;
  const toNext = stage === 3 ? 1 : (points - GROW_AT[stage]) / (GROW_AT[stage + 1] - GROW_AT[stage]);
  // Ties go in this order: festival days, giving, filming, watching.
  const top = (['festivalDay', 'give', 'film', 'watch'] as const).reduce((a, b) => (tracks[b] > tracks[a] ? b : a));
  let leaning: SproutKind = 'seedling';
  if (points > 0) {
    if (top === 'festivalDay') leaning = 'wanderer';
    else if (top === 'give') leaning = 'plur';
    else if (top === 'film') leaning = filmed.some((t) => { const h = new Date(t).getHours(); return h >= 5 && h < 8; }) ? 'sunrise' : 'spotlight';
    else {
      const counts: Record<string, number> = {};
      for (const w of watched) if (w.sound) counts[w.sound] = (counts[w.sound] ?? 0) + 1;
      const heavy = Object.entries(counts).filter(([s]) => HEAVY.has(s)).reduce((n, [, c]) => n + c, 0);
      const groove = Object.entries(counts).filter(([s]) => GROOVE.has(s)).reduce((n, [, c]) => n + c, 0);
      const melodic = Object.values(counts).reduce((n, c) => n + c, 0) - heavy - groove;
      leaning = heavy >= groove && heavy >= melodic && heavy > 0 ? 'bass' : groove > melodic ? 'groove' : 'melody';
    }
  }
  return { points, stage, toNext: Math.max(0, Math.min(1, toNext)), leaning };
}

/** "Grows from festival days · 12 more to bloom" / "In bloom". */
export function growthLine(g: Growth): string {
  if (g.stage === 3) return 'In bloom';
  const left = GROW_AT[g.stage + 1] - g.points;
  return `${STAGE_NAMES[g.stage]} · ${left} more growth to ${g.stage === 2 ? 'bloom' : STAGE_NAMES[g.stage + 1].toLowerCase()}`;
}

/** What grows it, said simply. */
export const GROW_TIPS = [
  'Festival days grow sprouts fastest.',
  'Every sprout you give helps your others grow.',
  'Filming your own videos grows them too.',
  'Watching sets helps a little at a time.',
] as const;

// ---- Your garden ---------------------------------------------------------

/** A sprout in your garden. */
export type GardenSprout = {
  id: string;
  kind: SproutKind;
  /** Who gave it ('' for your first sprout, from Afterglow). */
  from: string;
  handle?: string;
  name?: string;
  note?: string;
  /** When it reached you (ms). */
  at: number;
  /** Picked up in the background (after signing in, or once there was signal): the bell says so. */
  late?: boolean;
  /** When you scanned it, when that was before it reached you (side quests go by this). */
  scannedAt?: number;
  /** A wild sprout: found at this festival (its name). */
  foundAt?: string;
  /** An artist's sprout someone gave you. */
  artist?: SproutArtist;
};

/**
 * Wild sprouts: one appears in your garden on each night of a festival
 * you're at (`wild:<festival>:<night>`), already grown, its kind picked for
 * that festival and night (the same for everyone there that night).
 */
export const WILD_PREFIX = 'wild:';
export function wildKind(nightId: string): SproutKind {
  const kinds = SPROUT_KINDS.filter((k) => k.id !== 'seedling');
  let h = 2166136261;
  for (let i = 0; i < nightId.length; i++) {
    h ^= nightId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return kinds[(h >>> 0) % kinds.length].id;
}

/** The sprout everyone starts with. */
export const STARTER_ID = 'starter';

export type GardenView = GardenSprout & { growth?: Growth; /** The kind it is now (a plain sprout that bloomed shows its kind). */ shown: SproutKind; stage: Stage };

/**
 * Your garden as it is now: each sprout's stage and kind. A plain sprout
 * that reached bloom takes the kind remembered in `bloomed` (or what it's
 * leaning towards, the first time). Newest first.
 */
export function garden(sprouts: readonly GardenSprout[], journey: Journey, bloomed: Readonly<Record<string, SproutKind>>, now: number): GardenView[] {
  return [...sprouts]
    .sort((a, b) => b.at - a.at)
    .map((s) => {
      // Given sprouts arrive grown, an artist's included.
      if (s.kind !== 'seedling' || s.artist) return { ...s, shown: s.kind, stage: 3 as Stage };
      const growth = growthOf(journey, s.at, now);
      const shown = bloomed[s.id] ?? (growth.stage === 3 ? growth.leaning : 'seedling');
      return { ...s, growth, shown, stage: bloomed[s.id] ? 3 : growth.stage };
    });
}

/** Sprouts that just reached bloom and need their kind remembered. */
export function newlyBloomed(view: readonly GardenView[], bloomed: Readonly<Record<string, SproutKind>>): Record<string, SproutKind> {
  const out: Record<string, SproutKind> = {};
  for (const s of view) if (s.kind === 'seedling' && s.stage === 3 && !bloomed[s.id] && s.shown !== 'seedling') out[s.id] = s.shown;
  return out;
}

/** Kinds you can give: plain sprouts always, plus every kind you've grown. */
export function givableKinds(view: readonly GardenView[], bloomed: Readonly<Record<string, SproutKind>>): SproutKind[] {
  const grown = new Set(Object.values(bloomed));
  for (const s of view) if (s.kind === 'seedling' && s.stage === 3 && s.shown !== 'seedling') grown.add(s.shown);
  return SPROUT_KINDS.map((k) => k.id).filter((k) => k === 'seedling' || grown.has(k));
}

/** Kinds you've collected (received or grown), for the collection row. */
export const collectedKinds = (view: readonly GardenView[]) => new Set(view.filter((s) => s.stage === 3 || s.kind !== 'seedling').map((s) => s.shown));

/** "4 sprouts · 2 kinds". */
export function gardenLine(view: readonly GardenView[]): string {
  const kinds = new Set(view.map((s) => s.shown)).size;
  return `${view.length === 1 ? '1 sprout' : `${view.length} sprouts`}${kinds > 1 ? ` · ${kinds} kinds` : ''}`;
}

/** Reads the remembered blooms back. */
export function cleanBloomed(raw: unknown): Record<string, SproutKind> {
  const out: Record<string, SproutKind> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof k === 'string' && k.length <= 64 && isKind(v) && v !== 'seedling') out[k] = v;
  return out;
}
