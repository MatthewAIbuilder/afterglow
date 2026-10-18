import type { Artist, Festival, SetTime, TasteProfile } from '../../data/models';
import { stageName } from '../../data/festival';
import { playsOn } from '../festivals/days';
import { formatTime } from '../festivals/format';
import { dayWord, t } from '../../i18n';
import { normalize } from '../festivals/search';
import { runsOf } from '../festivals/when';
import { festivalNight } from '../plan/live';
import { DAY_BREAK, toMinutes } from '../plan/plan';
import type { DayRoute, RouteStop } from '../plan/route';

/**
 * Who was playing in this video? A best guess from what the phone knows, so
 * tagging is usually one tap. Pure: everything comes in as arguments.
 *
 * Festival: the day it was filmed (a night runs noon to noon, like set times)
 * against each festival's dates, the city it was filmed in against the
 * festival's place, and whether you're going.
 *
 * Artist, at that festival and night:
 * - once set times are out: the sets on at that minute (a few minutes either
 *   side count less), your full-day plan for that minute first, then your
 *   stars and your match;
 * - before: everyone playing that night (or the whole lineup), stars first,
 *   then your match.
 *
 * The phone's clock is taken as the festival's clock, which holds when you
 * tag soon after filming. It can't hear the music (that needs a sound
 * recogniser, a later step).
 */

export type Moment = {
  /** When it was filmed. */
  when?: Date;
  /** Where, as a place name. */
  place?: { city?: string; region?: string };
};

export type FestivalReason = 'date' | 'city' | 'region' | 'going';

export type FestivalGuess = {
  festival: Festival;
  /** The festival day, when the date says which. */
  night?: string;
  /** Minutes into that night on the set-time clock (after midnight runs past 24:00). */
  minute?: number;
  score: number;
  reasons: FestivalReason[];
};

const SCORE: Record<FestivalReason, number> = { date: 4, city: 2, region: 1, going: 1 };

const pad = (n: number) => String(n).padStart(2, '0');
/** The calendar date a festival night belongs to: before 7 AM counts as the night before. */
function nightDate(when: Date): string {
  const d = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  if (when.getHours() * 60 + when.getMinutes() < DAY_BREAK) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Minutes into the night on the set-time clock. */
function nightMinute(when: Date): number {
  const m = when.getHours() * 60 + when.getMinutes();
  return m < DAY_BREAK ? m + 24 * 60 : m;
}

/**
 * Which night of this festival a moment falls on: by the festival's own day
 * list when it has one per date, otherwise by weekday name ("Friday") for
 * festivals whose days are named that way (two-weekend ones included).
 */
export function nightOf(festival: Festival, when: Date): { night: string; minute: number } | undefined {
  const exact = festivalNight(festival, when);
  if (exact) return { night: exact.day, minute: exact.minute };
  const date = nightDate(when);
  if (!runsOf(festival).some((r) => r.start <= date && date <= r.end)) return undefined;
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const night = festival.days.find((day) => normalize(day) === weekday);
  return night ? { night, minute: nightMinute(when) } : undefined;
}

const words = (text: string) => normalize(text).split(' ').filter(Boolean);
/** "Orlando" in "Orlando, Florida": every word of the place name appears, in order, in the festival's location. */
function placeIn(place: string | undefined, location: string): boolean {
  const p = words(place ?? '');
  if (!p.length || p.join('').length < 3) return false;
  const l = words(location);
  return l.some((_, i) => p.every((w, j) => l[i + j] === w));
}

/** Festivals this moment could be from, best first. Only festivals with at least one reason. */
export function guessFestivals(festivals: Festival[], moment: Moment, going: readonly string[] = []): FestivalGuess[] {
  const out: FestivalGuess[] = [];
  for (const festival of festivals) {
    const reasons: FestivalReason[] = [];
    let night: ReturnType<typeof nightOf>;
    if (moment.when) {
      const date = nightDate(moment.when);
      if (runsOf(festival).some((r) => r.start <= date && date <= r.end)) {
        reasons.push('date');
        night = nightOf(festival, moment.when);
      }
    }
    if (placeIn(moment.place?.city, festival.location)) reasons.push('city');
    else if (placeIn(moment.place?.region, festival.location)) reasons.push('region');
    if (going.includes(festival.id)) reasons.push('going');
    if (!reasons.length) continue;
    // A place or your plans alone, months from the festival's dates, isn't this festival.
    if (!reasons.includes('date') && moment.when && runsOf(festival).length && !reasons.includes('going')) continue;
    out.push({ festival, night: night?.night, minute: night?.minute, score: reasons.reduce((s, r) => s + SCORE[r], 0), reasons });
  }
  const start = (f: Festival) => f.startDate ?? '9999';
  return out.sort((a, b) => b.score - a.score || start(a.festival).localeCompare(start(b.festival)));
}

/** How sure a festival guess is: sure (the date and the place or your plans agree), likely (one of them), or a maybe. */
export function festivalConfidence(g: FestivalGuess | undefined): 'sure' | 'likely' | 'maybe' {
  if (!g) return 'maybe';
  const date = g.reasons.includes('date');
  if (date && (g.reasons.includes('city') || g.reasons.includes('going'))) return 'sure';
  return date || g.reasons.includes('city') ? 'likely' : 'maybe';
}

/**
 * The one festival to suggest for a new video (the user, 2026-10-18: "there
 * should only be one festival suggestion… it should know which festival
 * you're attending that day"): the one you're going to that's on that night;
 * otherwise the only one whose date and place both agree (with no place on
 * the video, the only festival on that night). Anything less sure suggests
 * nothing, and the sheet offers a search with that night's events.
 */
export function suggestFestival(guesses: readonly FestivalGuess[], placeKnown = true): FestivalGuess | undefined {
  const on = guesses.filter((g) => g.reasons.includes('date'));
  const mine = on.find((g) => g.reasons.includes('going'));
  if (mine) return mine;
  const here = on.filter((g) => g.reasons.includes('city') || g.reasons.includes('region'));
  if (here.length === 1) return here[0];
  // No place to go on (no location on the video): the only festival on that night, if there's just one.
  return !placeKnown && on.length === 1 ? on[0] : undefined;
}

/** Festivals on that night, nearest first (the place agreeing, then the rest), for the list under the search. */
export function sameNight(guesses: readonly FestivalGuess[]): FestivalGuess[] {
  return guesses.filter((g) => g.reasons.includes('date'));
}

/**
 * One-night shows that night in the town it was filmed in (by the place name;
 * nothing without one, as shows are everywhere every night), at most `max`. Pure.
 */
export function showsThatNight<S extends { date: string; location: string }>(shows: readonly S[], moment: Moment, max = 3): S[] {
  if (!moment.when) return [];
  const date = nightDate(moment.when);
  const city = moment.place?.city;
  const region = moment.place?.region;
  if (!city && !region) return [];
  return shows.filter((s) => s.date === date && (placeIn(city, s.location) || (!city && placeIn(region, s.location)))).slice(0, max);
}

/** How many artists the sheet offers at once: everyone on at that minute, up to this many. */
export const ON_NOW_SHOWN = 12;

/**
 * The artists the sheet offers before any search: once set times are out,
 * everyone on (or just starting or finishing) at that minute, your plan
 * first; before set times, your likeliest few. Pure.
 */
export function offeredArtists(guesses: readonly ArtistGuess[], few = 3): ArtistGuess[] {
  const now = guesses.filter((g) => g.reason === 'plan' || g.reason === 'on-now' || g.reason === 'close');
  return now.length ? now.slice(0, ON_NOW_SHOWN) : guesses.slice(0, few);
}

export type ArtistReason =
  /** Your full-day plan had you there at that minute. */
  | 'plan'
  /** Playing at that minute. */
  | 'on-now'
  /** Starting or finishing within a few minutes of it. */
  | 'close'
  /** Playing that night. */
  | 'tonight'
  /** On the lineup (no night known). */
  | 'lineup';

export type ArtistGuess = { artist: Artist; reason: ArtistReason; set?: SetTime; stage?: string; score: number };

/** A set a few minutes before its start or after its end still counts, less. */
export const GRACE_MINUTES = 10;

export type ArtistGuessInput = {
  festival: Festival;
  night?: string;
  minute?: number;
  artists: Artist[];
  taste: TasteProfile;
  /** Your must-sees at this festival. */
  pinned?: ReadonlySet<string>;
  /** Your full-day route, once set times are out. */
  route?: DayRoute[];
};

/** Everyone who could be in the video, most likely first. */
export function guessArtists(input: ArtistGuessInput): ArtistGuess[] {
  const { festival, night, minute, artists, taste, pinned } = input;
  const byId = new Map(artists.map((a) => [a.id, a]));
  const lineup = festival.lineup.map((id) => byId.get(id)).filter((a): a is Artist => !!a);
  const liking = (a: Artist) => (pinned?.has(a.id) ? 1 : 0) + (taste[a.id] ?? 0);
  const out = new Map<string, ArtistGuess>();
  const put = (g: ArtistGuess) => {
    const had = out.get(g.artist.id);
    if (!had || g.score > had.score) out.set(g.artist.id, g);
  };

  if (festival.sets?.length && night && minute !== undefined) {
    const planned = plannedAt(input.route, night, minute);
    for (const set of festival.sets) {
      if (set.day !== night) continue;
      const artist = byId.get(set.artistId);
      if (!artist) continue;
      const start = toMinutes(set.start);
      let end = toMinutes(set.end);
      if (end <= start) end += 24 * 60;
      const stage = stageName(festival, set.stageId);
      if (start <= minute && minute < end) {
        const onPlan = planned?.artist.id === artist.id;
        put({ artist, set, stage, reason: onPlan ? 'plan' : 'on-now', score: (onPlan ? 10 : 6) + liking(artist) });
      } else if (start - GRACE_MINUTES <= minute && minute < end + GRACE_MINUTES) {
        put({ artist, set, stage, reason: 'close', score: 3 + liking(artist) });
      } else {
        put({ artist, set, stage, reason: 'tonight', score: liking(artist) * 0.5 });
      }
    }
  } else if (night) {
    for (const artist of lineup) if (playsOn(festival, artist.id, night)) put({ artist, reason: 'tonight', score: 2 + liking(artist) });
  }
  // Everyone else on the lineup, so the full list is always there to search.
  for (const artist of lineup) if (!out.has(artist.id)) put({ artist, reason: 'lineup', score: liking(artist) * 0.25 });
  const billing = new Map(festival.lineup.map((id, i) => [id, i]));
  return [...out.values()].sort((a, b) => b.score - a.score || (billing.get(a.artist.id) ?? 0) - (billing.get(b.artist.id) ?? 0));
}

/** The stop your route had you at, at that minute of that night. */
function plannedAt(route: DayRoute[] | undefined, night: string, minute: number): RouteStop | undefined {
  const day = route?.find((d) => d.day === night);
  return day?.stops.find((s): s is RouteStop => s.kind === 'set' && s.from <= minute && minute < s.to);
}

/**
 * How sure the top artist guess is: sure when your plan or a single set at
 * that minute points to them, likely when a few sets were on, otherwise a
 * guess from the lineup.
 */
export function artistConfidence(guesses: ArtistGuess[]): 'sure' | 'likely' | 'maybe' {
  const top = guesses[0];
  if (!top) return 'maybe';
  if (top.reason === 'plan') return 'sure';
  const onNow = guesses.filter((g) => g.reason === 'on-now').length;
  if (top.reason === 'on-now') return onNow === 1 ? 'sure' : 'likely';
  return top.reason === 'close' ? 'likely' : 'maybe';
}

/** A short reason under a guess: "On your plan · Bass Tent", "Bass Tent until 12:30 AM", "Playing Saturday". */
export function reasonLine(g: ArtistGuess, night?: string): string | undefined {
  switch (g.reason) {
    case 'plan':
      return g.stage ? t('On your plan · {stage}', { stage: g.stage }) : t('On your plan');
    case 'on-now':
      return g.stage && g.set ? t('{stage} until {time}', { stage: g.stage, time: formatTime(g.set.end) }) : g.stage;
    case 'close':
      return g.stage && g.set ? t('{stage} · {start} to {end}', { stage: g.stage, start: formatTime(g.set.start), end: formatTime(g.set.end) }) : g.stage;
    case 'tonight':
      return night ? t('Playing {night}', { night: dayWord(night) }) : undefined;
    default:
      return undefined;
  }
}
