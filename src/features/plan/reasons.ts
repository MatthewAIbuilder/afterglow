import { type Artist, SOUND_LABEL, type SoundTag } from '../../data/models';
import { isWarm, type Rating } from '../taste/ratings';
import type { ArtistSignals } from '../taste/why';
import { TIER_AT } from './plan';

/** A pick before set times, or a stop on your route. */
export type PickLike = { artist: Artist; match: number; pinned: boolean; known: boolean };

/**
 * Why a pick is on your list, in a few plain words, so a must-see never feels
 * arbitrary. Pure. Your own signals come first (a star, a rating, likes and
 * saves, your music library), then a favourite they sound like, then your
 * sound; without any of those it's a first guess.
 */
export type PickWhy =
  | { kind: 'starred' }
  | { kind: 'rated'; rating: 'love' | 'like' }
  | { kind: 'reacted'; likes: number; saves: number; watched: number }
  | { kind: 'library'; from: string[] }
  | { kind: 'near'; to: Artist }
  | { kind: 'sound'; sound?: SoundTag }
  | { kind: 'guess' };

/** How alike two artists must sound to call one "like" the other. */
export const LIKE_FAVOURITE = 0.45;

export function pickWhy(pick: PickLike, signals: ArtistSignals, favourites: readonly Artist[], similarity: (a: Artist, b: Artist) => number): PickWhy {
  if (pick.pinned && pick.match < TIER_AT.mustSee) return { kind: 'starred' };
  if (signals.rating && isWarm(signals.rating)) return { kind: 'rated', rating: signals.rating as 'love' | 'like' };
  if (signals.likes || signals.saves || signals.watched) return { kind: 'reacted', likes: signals.likes, saves: signals.saves, watched: signals.watched };
  if (signals.library?.length) return { kind: 'library', from: signals.library };
  let best: { to: Artist; s: number } | undefined;
  for (const f of favourites) {
    if (f.id === pick.artist.id) continue;
    const s = similarity(pick.artist, f);
    if (s >= LIKE_FAVOURITE && (!best || s > best.s)) best = { to: f, s };
  }
  if (best) return { kind: 'near', to: best.to };
  if (!pick.known) return { kind: 'guess' };
  const lead = (Object.entries(pick.artist.sound ?? {}) as [SoundTag, number][]).sort((a, b) => b[1] - a[1])[0];
  return { kind: 'sound', sound: lead?.[0] };
}

const sets = (n: number) => (n === 1 ? 'one of their sets' : `${n} of their sets`);

/** "You love them.", "You liked 2 of their sets.", "Sounds like Illenium, one of your favourites." */
export function whyText(why: PickWhy): string {
  switch (why.kind) {
    case 'starred':
      return 'You starred this one.';
    case 'rated':
      return why.rating === 'love' ? 'You love them.' : 'You like them.';
    case 'reacted':
      if (why.likes && why.saves) return 'You liked and saved their sets.';
      if (why.likes) return `You liked ${sets(why.likes)}.`;
      if (why.saves) return `You saved ${sets(why.saves)}.`;
      return `You watched ${sets(why.watched)} all the way through.`;
    case 'library':
      return `In your ${why.from.join(' and ')} ${why.from.length === 1 ? 'library' : 'libraries'}.`;
    case 'near':
      return `Sounds like ${why.to.name}, one of your favourites.`;
    case 'sound':
      return why.sound ? `Right in your sound: ${SOUND_LABEL[why.sound].toLowerCase()}.` : 'Right in your sound.';
    case 'guess':
      return 'A first guess. Rate them to sharpen it.';
  }
}

/**
 * Your favourites, to say who a pick sounds like: artists you love or like,
 * or whose sets you liked or saved, best match first.
 */
export function favouritesOf(
  artists: readonly Artist[],
  ratings: Record<string, Rating | undefined>,
  reacted: ReadonlySet<string>,
  taste: Record<string, number>,
  max = 12,
): Artist[] {
  return artists
    .filter((a) => (isWarm(ratings[a.id]) || reacted.has(a.id)) && ratings[a.id] !== 'meh' && ratings[a.id] !== 'pass')
    .sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0))
    .slice(0, max);
}
