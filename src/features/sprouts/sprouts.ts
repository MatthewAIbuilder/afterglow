import type { ThemeId } from '../../theme/palettes';
import { WEB_URL } from '../../config/app';
import type { Festival } from '../../data/models';
import { runsOf } from '../festivals/when';
import { t, tn } from '../../i18n';
import { questDay } from '../quests/daily';
import { GNOME_FRIENDS } from '../profile/backdrops';

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
 * - Hats (the gnome, the caterpillar, the raccoon): a kind that arrives as a seed (`seed`)
 *   and grows into itself, with its own stage names. Its keepers (`keepers`) give as many
 *   as they like, with no seeds, and grow one of their own. Anyone else can
 *   pass theirs on only once it's fully grown: it leaves their garden and
 *   arrives in the next one as a new hat. Nobody sees the kind until they
 *   have one.
 */

export type SproutKind = 'seedling' | 'plur' | 'wanderer' | 'bass' | 'melody' | 'groove' | 'spotlight' | 'sunrise' | 'moonlight' | 'seeker' | 'gnome' | 'caterpillar' | 'raccoon';

export type KindSpec = {
  id: SproutKind;
  name: string;
  /** Its name without "sprout" ("PLUR"), for small labels. */
  short: string;
  /** How it grows (or "Every sprout starts here"). */
  how: string;
  /** What grows it, without "Grows from" ("giving sprouts away"). */
  grows: string;
  /** A short line about it. */
  about: string;
  /** Body tint and the accent on top. */
  body: [string, string];
  accent: string;
  /** It arrives as a seed and grows into this kind (a hat that becomes a gnome); passed on, never given from nothing, except by its keepers. */
  seed?: true;
  /** Its own names for each stage, seed to grown. */
  stages?: readonly [string, string, string, string];
  /** What to say once it's fully grown (in place of "You can give them now"). */
  grown?: string;
  /** What the give screen says about passing a grown one on, and when it isn't grown yet. */
  passOn?: string;
  notGrown?: string;
  /** These accounts give as many as they like (the database checks the same) and grow one of their own. */
  keepers?: readonly string[];
  /** Keepers named by @handle instead (the database looks the handle up the same way). */
  keeperHandles?: readonly string[];
  /** When a keeper's own one was planted (ms): it grows from then. */
  plantedAt?: number;
};

/** Jannik: keeps the caterpillars (firestore.rules checks the same uid). */
export const CATERPILLAR_FRIENDS: readonly string[] = ['xKdfDSjxYLSuIl37UpXGMFYGpWU2'];
/** Yulian (@nyxara): keeps the raccoons. By handle: firestore.rules looks up `handles/nyxara` the same way. */
export const RACCOON_FRIENDS: readonly string[] = ['nyxara'];
/** Accounts that keep every kept kind: give as many as they like and grow one of each (firestore.rules checks the same uids). */
export const KEEPS_EVERY_KIND: readonly string[] = ['aC7a313susZsMUGWAM7GmRDyuRS2'];

export const SPROUT_KINDS: readonly KindSpec[] = [
  { id: 'seedling', name: t('Sprout'), short: t('Sprout'), how: t('Every sprout starts here'), grows: t('Every sprout starts here'), about: t('A little green hello. Grow it and it becomes something of its own.'), body: ['#8FF0B4', '#2FB36B'], accent: '#6EE7A0' },
  { id: 'plur', name: t('PLUR sprout'), short: t('PLUR'), how: t('Grows from giving sprouts away'), grows: t('giving sprouts away'), about: t('Peace, love, unity, respect. Grown by passing the love on.'), body: ['#9EF2C0', '#2FB36B'], accent: '#FF7EB6' },
  { id: 'wanderer', name: t('Wanderer sprout'), short: t('Wanderer'), how: t('Grows from festival days'), grows: t('festival days'), about: t('Grown in the field, one festival day at a time.'), body: ['#A8F0B0', '#3BAA5C'], accent: '#FFB86B' },
  { id: 'bass', name: t('Bass sprout'), short: t('Bass'), how: t('Grows from watching heavy sets'), grows: t('watching heavy sets'), about: t('Grown on dubstep, riddim and trap. Shakes a little.'), body: ['#8EE8C8', '#22A07A'], accent: '#5B8CFF' },
  { id: 'melody', name: t('Melody sprout'), short: t('Melody'), how: t('Grows from watching melodic sets'), grows: t('watching melodic sets'), about: t('Grown on melodic bass and big feelings.'), body: ['#A4EFC0', '#2FB36B'], accent: '#A97CFF' },
  { id: 'groove', name: t('Groove sprout'), short: t('Groove'), how: t('Grows from watching house and techno'), grows: t('watching house and techno'), about: t('Grown on four to the floor. Never stops moving.'), body: ['#8DEBD2', '#1F9C86'], accent: '#5BE3B5' },
  { id: 'spotlight', name: t('Spotlight sprout'), short: t('Spotlight'), how: t('Grows from filming your own videos'), grows: t('filming your own videos'), about: t('Grown by catching the moment.'), body: ['#B4F0A8', '#45A84F'], accent: '#FFD58A' },
  { id: 'sunrise', name: t('Sunrise sprout'), short: t('Sunrise'), how: t('Grows from filming at sunrise'), grows: t('filming at sunrise'), about: t('Grown by the ones still dancing when the sun comes up.'), body: ['#C2F0A0', '#4DA844'], accent: '#FF9F5A' },
  { id: 'moonlight', name: t('Moonlight sprout'), short: t('Moonlight'), how: t('Grows from watching sets after midnight'), grows: t('watching sets after midnight'), about: t('Grown in the small hours, glowing softly by moonlight.'), body: ['#C8D8FF', '#5A7AD8'], accent: '#B8C8FF' },
  { id: 'seeker', name: t('Seeker sprout'), short: t('Seeker'), how: t('Grows from finding stickers'), grows: t('finding stickers'), about: t('Grown by the ones who look behind every tent for one more sticker.'), body: ['#E2F2A8', '#8FB43C'], accent: '#FFC94A' },
  {
    id: 'gnome',
    name: t('Gnome hat'),
    short: t('Gnome'),
    how: t('Be given a gnome hat and grow it'),
    grows: t('being given a gnome hat'),
    about: t('A little red hat that grows into a gnome who hops around your garden. Once it’s fully grown you can pass it on: it leaves your garden and starts again as a hat in theirs.'),
    body: ['#D8F2B8', '#3F7F2C'],
    accent: '#E8463A',
    seed: true,
    stages: [t('Gnome hat'), t('Peeking out'), t('Little gnome'), t('Gnome')],
    grown: t('Your gnome is fully grown and hopping around your garden. You can pass it on now: it leaves your garden and starts again as a hat in theirs.'),
    passOn: t('Your grown gnome leaves your garden, and they get a new hat to grow.'),
    notGrown: t('Grow your gnome all the way first, then you can pass it on.'),
    keepers: [...GNOME_FRIENDS, ...KEEPS_EVERY_KIND],
    plantedAt: Date.UTC(2026, 9, 8, 12),
  },
  {
    id: 'caterpillar',
    name: t('Caterpillar'),
    short: t('Butterfly'),
    how: t('Be given a caterpillar and grow it'),
    grows: t('being given a caterpillar'),
    about: t('A little caterpillar that munches, sleeps in its cocoon and turns into a butterfly who flutters around your garden. Once it’s a butterfly you can pass it on: it leaves your garden and starts again as a caterpillar in theirs.'),
    body: ['#D8F2B8', '#3F7F2C'],
    accent: '#B48CFF',
    seed: true,
    stages: [t('Caterpillar'), t('Munching'), t('Cocoon'), t('Butterfly')],
    grown: t('Your caterpillar turned into a butterfly and is fluttering around your garden. You can pass it on now: it leaves your garden and starts again as a caterpillar in theirs.'),
    passOn: t('Your butterfly leaves your garden, and they get a new caterpillar to grow.'),
    notGrown: t('Wait until your caterpillar is a butterfly, then you can pass it on.'),
    keepers: [...CATERPILLAR_FRIENDS, ...KEEPS_EVERY_KIND],
    plantedAt: Date.UTC(2026, 9, 10, 12),
  },
  {
    id: 'raccoon',
    name: t('Trash can'),
    short: t('Raccoon'),
    how: t('Be given a trash can and wait'),
    grows: t('being given a trash can'),
    about: t('A little trash can with something inside. First two tiny paws grip the rim, then a masked face peeks out, then the whole raccoon climbs out and wanders your garden. Once it’s out you can pass it on: it leaves your garden and starts again as a trash can in theirs.'),
    body: ['#C9D6E4', '#6E8299'],
    accent: '#B48CFF',
    seed: true,
    stages: [t('Trash can'), t('Little paws'), t('Peeking out'), t('Raccoon')],
    grown: t('Your raccoon climbed all the way out and is wandering your garden. You can pass it on now: it leaves your garden and starts again as a trash can in theirs.'),
    passOn: t('Your raccoon leaves your garden, and they get a new trash can.'),
    notGrown: t('Wait until your raccoon is all the way out, then you can pass it on.'),
    keepers: [...KEEPS_EVERY_KIND],
    keeperHandles: RACCOON_FRIENDS,
    plantedAt: Date.UTC(2026, 9, 13, 12),
  },
];

/** Whether this account keeps a kind: by its uid, or by its @handle. */
const keeps = (k: KindSpec, uid: string | undefined, handle?: string) => (!!uid && !!k.keepers?.includes(uid)) || (!!uid && !!handle && !!k.keeperHandles?.includes(handle.toLowerCase()));

export const kindOf = (id: string): KindSpec => SPROUT_KINDS.find((k) => k.id === id) ?? SPROUT_KINDS[0];
export const isKind = (k: unknown): k is SproutKind => typeof k === 'string' && SPROUT_KINDS.some((s) => s.id === k);

/** The kinds this account gives as many of as it likes (and grows one of its own). */
export const keptKinds = (uid: string | undefined, handle?: string): SproutKind[] => SPROUT_KINDS.filter((k) => keeps(k, uid, handle)).map((k) => k.id);
/** A keeper's own one, in their garden. */
export const keptSproutId = (kind: SproutKind) => `kept-${kind}`;
/** Every keeper's own sprout id (kept with the garden like the first sprout). */
export const KEPT_SPROUT_IDS: readonly string[] = SPROUT_KINDS.filter((k) => k.keepers || k.keeperHandles).map((k) => keptSproutId(k.id));
/**
 * A keeper's own: one of each kind they keep, growing from when it was
 * planted (or from when they started, if that was later).
 */
export function keptSprouts(uid: string | undefined, starterAt: number, handle?: string): GardenSprout[] {
  return keptKinds(uid, handle).map((kind) => ({ id: keptSproutId(kind), kind, from: '', name: 'Afterglow', at: Math.max(starterAt, kindOf(kind).plantedAt ?? 0) }));
}
/** A stage's name: the kind's own (a gnome's "Gnome hat"), or the usual ones. */
export const stageName = (kind: SproutKind, stage: Stage) => kindOf(kind).stages?.[stage] ?? STAGE_NAMES[stage];
/** What it's called fully grown ("Gnome", "PLUR sprout"). */
export const grownName = (kind: SproutKind) => kindOf(kind).stages?.[3] ?? kindOf(kind).name;
/** How a given one looks as it arrives: a plain sprout a little grown, a hat as a hat, any other kind grown. */
export const giftStage = (kind: SproutKind): Stage => (kind === 'seedling' ? 2 : kindOf(kind).seed ? 0 : 3);
/** Whether a kind shows in lists of kinds to collect: every kind, but a kept one only once you have it or keep it. */
export const kindListed = (k: KindSpec, have: ReadonlySet<SproutKind>, uid?: string, handle?: string) => !(k.keepers || k.keeperHandles) || have.has(k.id) || keeps(k, uid, handle);

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
/** The ids catalogue files allow (letters, digits, - _ .), as the database rules check them. */
const ARTIST_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/;
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

/** The route params of `/sprout/[id]` for a sprout (all but its id), as its link carries them. */
export function sproutLinkParams(s: { from: string; handle?: string; kind: SproutKind; name?: string; artist?: SproutArtist }): Record<string, string> {
  return {
    u: s.from,
    h: s.handle ?? '',
    k: s.kind,
    ...(s.name ? { n: s.name.trim().slice(0, NAME_MAX) } : {}),
    ...(s.artist ? { a: s.artist.id, an: s.artist.name } : {}),
  };
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

/** A sprout's name: "PLUR sprout", or an artist's collectible ("SUBTRONICS collectible"). */
export const sproutName = (s: { kind: SproutKind; artist?: SproutArtist }) => (s.artist ? t('{artist} collectible', { artist: s.artist.name }) : kindOf(s.kind).name);
const an = (name: string) => (/^[AEIOU]/i.test(name) ? 'an' : 'a');
/** "a PLUR sprout", "an ILLENIUM sprout". */
export const aSprout = (s: { kind: SproutKind; artist?: SproutArtist }) => {
  const vowel = an(sproutName(s)) === 'an';
  if (s.artist) return vowel ? t('an {artist} collectible', { artist: s.artist.name }) : t('a {artist} collectible', { artist: s.artist.name });
  return vowel ? t('an {sprout}', { sprout: kindOf(s.kind).name }) : t('a {sprout}', { sprout: kindOf(s.kind).name });
};

/** "Maya gave you a PLUR sprout". */
export const giftTitle = (card: Pick<SproutCard, 'name' | 'kind' | 'artist'>) => t('{name} gave you {sprout}', { name: card.name, sprout: aSprout(card) });

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
  if (left <= 0) return t('No seeds left today. New ones at 4 AM.');
  return festivalDay ? t('{left} of {total} seeds left today · festival day, double seeds', { left, total }) : t('{left} of {total} seeds left today', { left, total });
}

// ---- Growing -------------------------------------------------------------

export type Stage = 0 | 1 | 2 | 3;
/** Growth needed for each stage: seed, sprout, leafy, in bloom. */
export const GROW_AT = [0, 6, 18, 36] as const;
export const STAGE_NAMES = [t('Seed'), t('Sprout'), t('Leafy'), t('In bloom')] as const;
/** Growth for each thing you do. */
export const GROWTH = { watch: 1, film: 3, find: 3, give: 4, festivalDay: 8 } as const;

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
  /** Stickers you found: when you scanned each (ms). */
  found?: readonly number[];
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
    find: (journey.found ?? []).filter(inWindow).length * GROWTH.find,
    watch: watched.length * GROWTH.watch,
  };
  const points = tracks.festivalDay + tracks.give + tracks.film + tracks.find + tracks.watch;
  const stage = (GROW_AT.filter((g) => points >= g).length - 1) as Stage;
  const toNext = stage === 3 ? 1 : (points - GROW_AT[stage]) / (GROW_AT[stage + 1] - GROW_AT[stage]);
  // Ties go in this order: festival days, giving, filming, finding stickers, watching.
  const top = (['festivalDay', 'give', 'film', 'find', 'watch'] as const).reduce((a, b) => (tracks[b] > tracks[a] ? b : a));
  let leaning: SproutKind = 'seedling';
  if (points > 0) {
    if (top === 'festivalDay') leaning = 'wanderer';
    else if (top === 'give') leaning = 'plur';
    else if (top === 'find') leaning = 'seeker';
    else if (top === 'film') leaning = filmed.some((t) => { const h = new Date(t).getHours(); return h >= 5 && h < 8; }) ? 'sunrise' : 'spotlight';
    else if (watched.filter((w) => new Date(w.at).getHours() < 5).length * 2 >= watched.length) leaning = 'moonlight';
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

/** "Grows from festival days · 12 more to bloom" / "In bloom"; a hat's in its own words ("Hat · 6 more growth to peeking out"). */
export function growthLine(g: Growth, kind?: SproutKind): string {
  const own = kind ? kindOf(kind).stages : undefined;
  if (own) return g.stage === 3 ? own[3] : t('{stage} · {n} more growth to {next}', { stage: own[g.stage], n: GROW_AT[g.stage + 1] - g.points, next: own[g.stage + 1].toLowerCase() });
  if (g.stage === 3) return t('In bloom');
  const n = GROW_AT[g.stage + 1] - g.points;
  if (g.stage === 0) return t('Seed · {n} more growth to sprout', { n });
  if (g.stage === 1) return t('Sprout · {n} more growth to leafy', { n });
  return t('Leafy · {n} more growth to bloom', { n });
}

/** What grows it, said simply. */
export const GROW_TIPS = [
  t('Festival days grow sprouts fastest.'),
  t('Every sprout you give helps your others grow.'),
  t('Filming your own videos grows them too.'),
  t('Watching sets helps a little at a time.'),
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
  /** A gift theme that came with it (features/themes/gifts.ts). */
  theme?: ThemeId;
  /** The theme's grant is saved on Afterglow (so your profile can show its background). */
  themeGranted?: true;
  /** It reached an account with no profile yet: the theme goes on once the profile is made. */
  wearOnArrival?: true;
  /** The theme page has shown this gift. */
  themeShown?: true;
  /** Its page (with the offer to follow whoever gave it) has been shown since it arrived. */
  followAsked?: true;
  /** Afterglow says it was passed on (a hat): it's no longer in this garden. */
  passed?: true;
};

/**
 * Wild sprouts: one appears in your garden on each night of a festival
 * you're at (`wild:<festival>:<night>`), already grown, its kind picked for
 * that festival and night (the same for everyone there that night).
 */
export const WILD_PREFIX = 'wild:';
/** The kinds wild sprouts come in, kept as they were so a night's kind never changes when a new kind is added. */
const WILD_KINDS: readonly SproutKind[] = ['plur', 'wanderer', 'bass', 'melody', 'groove', 'spotlight', 'sunrise', 'moonlight'];
export function wildKind(nightId: string): SproutKind {
  const kinds = WILD_KINDS;
  let h = 2166136261;
  for (let i = 0; i < nightId.length; i++) {
    h ^= nightId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return kinds[(h >>> 0) % kinds.length];
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
      // A hat grows into its own kind from when it arrived.
      if (kindOf(s.kind).seed && !s.artist) {
        const growth = { ...growthOf(journey, s.at, now), leaning: s.kind };
        return { ...s, growth, shown: s.kind, stage: bloomed[s.id] ? 3 : growth.stage };
      }
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
  for (const s of view) if ((s.kind === 'seedling' || (kindOf(s.kind).seed && !s.artist)) && s.stage === 3 && !bloomed[s.id] && s.shown !== 'seedling') out[s.id] = s.shown;
  return out;
}

/**
 * What in your garden you can give away (giving moves it: it leaves your
 * garden): every grown sprout of a kind (one you grew, one you were given, a
 * wild one) and every fully grown hat; artist collectibles you were given too.
 * Not a plain sprout still growing, and not a keeper's own hat. Ones you were
 * given first (Afterglow can check those), newest first.
 */
export const passable = (view: readonly GardenView[]) =>
  view.filter((s) => s.stage === 3 && (s.artist || s.shown !== 'seedling') && !KEPT_SPROUT_IDS.includes(s.id)).sort((a, b) => Number(isReceived(b)) - Number(isReceived(a)));
/** It came from someone, through Afterglow (not your first sprout, a keeper's own or a wild one). */
export const isReceived = (s: GardenSprout) => !!s.from && s.id !== STARTER_ID && !KEPT_SPROUT_IDS.includes(s.id) && !s.id.startsWith(WILD_PREFIX);
/** The one to give when you give a kind (or an artist you were given): the first `passable` of it. */
export const toPass = (view: readonly GardenView[], kind: SproutKind, artistId?: string) => passable(view).find((s) => (artistId ? s.artist?.id === artistId : !s.artist && s.shown === kind));

/** Kinds you can give: a new plain sprout (from your seeds) always, the kinds a keeper keeps, and every kind you have one of to give away. */
export function givableKinds(view: readonly GardenView[], uid?: string, handle?: string): SproutKind[] {
  const kept = keptKinds(uid, handle);
  const have = new Set(passable(view).flatMap((s) => (s.artist ? [] : [s.shown])));
  return SPROUT_KINDS.map((k) => k.id).filter((k) => k === 'seedling' || kept.includes(k) || have.has(k));
}

/** Kinds you've collected (received or grown), for the collection row. */
export const collectedKinds = (view: readonly GardenView[]) => new Set(view.filter((s) => !s.artist && (s.stage === 3 || s.kind !== 'seedling')).map((s) => s.shown));

/** "4 sprouts · 2 kinds". */
export function gardenLine(view: readonly GardenView[]): string {
  const kinds = new Set(view.map((s) => s.shown)).size;
  const count = tn(view.length, '{n} sprout', '{n} sprouts');
  return kinds > 1 ? t('{sprouts} · {kinds} kinds', { sprouts: count, kinds }) : count;
}

/** Reads the remembered blooms back. */
export function cleanBloomed(raw: unknown): Record<string, SproutKind> {
  const out: Record<string, SproutKind> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof k === 'string' && k.length <= 64 && isKind(v) && v !== 'seedling') out[k] = v;
  return out;
}
