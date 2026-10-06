import type { Artist, Festival, SoundTag, TasteProfile } from '../../data/models';
import { toShares, type SoundShare } from '../taste/lean';
import { t, tn } from '../../i18n';

/**
 * Festivals side by side, from your live taste. Pure.
 *
 * Each festival gets a fit (how well its best acts match you: the average of
 * your top `FIT_TOP` matches there among artists the app knows you for, so a
 * huge lineup doesn't win just by being huge), who you'd love there, its
 * sound, and who you'd love that only plays there. Artists playing more than
 * one of them are listed too.
 */
export const FIT_TOP = 8;
/** Most festivals compared at once (they sit side by side). */
export const COMPARE_MAX = 3;
/** A lead smaller than this (in points of fit) is a close call. */
export const CLOSE_FIT = 5;

export type FestivalFit = {
  festival: Festival;
  /** 0 to 100, or undefined when you have no signal for anyone there. */
  fit?: number;
  /** Artists you'd love there, best match first. */
  loved: Artist[];
  /** The lineup's sound, top three. */
  sounds: SoundShare[];
  /** Artists you'd love who play here and none of the others compared. */
  onlyHere: Artist[];
};

export type Comparison = {
  fits: FestivalFit[];
  /** Artists on two or more of the lineups, the ones you'd love first, then your match. */
  shared: { artist: Artist; festivals: string[] }[];
  /** The best fit, when it leads by at least `CLOSE_FIT` (or at all, with two more favourites); undefined for a close call or no signal. */
  best?: string;
};

type Inputs = {
  artist: (id: string) => Artist | undefined;
  taste: TasteProfile;
  informed: Record<string, boolean>;
  loves: (artistId: string) => boolean;
};

const byMatch = (taste: TasteProfile) => (a: Artist, b: Artist) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0);

function lineupSound(artists: Artist[]): SoundShare[] {
  const weights: Partial<Record<SoundTag, number>> = {};
  for (const a of artists) for (const [tag, v] of Object.entries(a.sound) as [SoundTag, number][]) weights[tag] = (weights[tag] ?? 0) + v;
  return toShares(weights).slice(0, 3);
}

export function compareFestivals(festivals: readonly Festival[], i: Inputs): Comparison {
  const lineups = festivals.map((f) => [...new Set(f.lineup)].map(i.artist).filter((a): a is Artist => !!a));
  const plays = new Map<string, string[]>();
  festivals.forEach((f, k) => lineups[k].forEach((a) => plays.set(a.id, [...(plays.get(a.id) ?? []), f.id])));

  const fits: FestivalFit[] = festivals.map((festival, k) => {
    const artists = lineups[k];
    const known = artists.filter((a) => i.informed[a.id]).sort(byMatch(i.taste));
    const top = known.slice(0, FIT_TOP);
    const fit = top.length ? Math.round((top.reduce((s, a) => s + (i.taste[a.id] ?? 0), 0) / Math.max(top.length, Math.min(FIT_TOP, artists.length))) * 100) : undefined;
    const loved = artists.filter((a) => i.loves(a.id)).sort(byMatch(i.taste));
    return {
      festival,
      fit,
      loved,
      sounds: lineupSound(artists),
      onlyHere: festivals.length > 1 ? loved.filter((a) => plays.get(a.id)!.length === 1) : [],
    };
  });

  const all = new Map<string, Artist>();
  lineups.flat().forEach((a) => all.set(a.id, a));
  const shared = [...plays]
    .filter(([, fs]) => fs.length > 1)
    .map(([id, fs]) => ({ artist: all.get(id)!, festivals: fs }))
    .sort((a, b) => Number(i.loves(b.artist.id)) - Number(i.loves(a.artist.id)) || (i.taste[b.artist.id] ?? 0) - (i.taste[a.artist.id] ?? 0));

  const ranked = fits.filter((f) => f.fit !== undefined).sort((a, b) => b.fit! - a.fit! || b.loved.length - a.loved.length);
  const lead = ranked.length > 1 ? ranked[0].fit! - ranked[1].fit! : 0;
  // A clear lead in fit, or a smaller one with at least two more favourites.
  const moreLoved = ranked.length > 1 ? ranked[0].loved.length - ranked[1].loved.length : 0;
  const best = ranked.length > 1 && (lead >= CLOSE_FIT || (lead > 0 && moreLoved >= 2)) ? ranked[0].festival.id : undefined;
  return { fits, shared, best };
}

/** One line at the top: which fits you, or that it's close. */
export function verdictLine(c: Comparison): string {
  if (c.fits.length < 2) return t('Add a festival to compare.');
  const withFit = c.fits.filter((f) => f.fit !== undefined);
  if (!withFit.length) return t('Rate a few artists and the comparison will show which suits you.');
  const best = c.fits.find((f) => f.festival.id === c.best);
  if (!best) return t('A close call for your sound. Compare who you’d love at each.');
  const n = best.loved.length;
  const only = best.onlyHere.length;
  const festival = best.festival.name;
  if (!n) return t('{festival} fits your sound best.', { festival });
  if (!only) return tn(n, '{festival} fits your sound best: {n} artist you’d love.', '{festival} fits your sound best: {n} artists you’d love.', { festival });
  return tn(n, '{festival} fits your sound best: {n} artist you’d love, {only} only there.', '{festival} fits your sound best: {n} artists you’d love, {only} only there.', { festival, only });
}

/** The ids asked for, known, in order, at most `COMPARE_MAX`. */
export function compareIds(raw: string | undefined, known: (id: string) => boolean): string[] {
  return [...new Set((raw ?? '').split(',').map((s) => s.trim()).filter((id) => id && known(id)))].slice(0, COMPARE_MAX);
}
