import { SOUND_TAGS, type Artist, type SoundTag } from '../../data/models';

/**
 * Finding an artist on a lineup by typing part of their name. Pure.
 * Ignores case, accents and punctuation, so "adrian" finds ADRIÁN MILLS,
 * "contra" finds CØNTRA and "kiki" finds KI/KI.
 */

/** Lowercase letters and digits, words separated by single spaces. */
export function normalize(text: string) {
  return text
    .replace(/[Øø]/g, 'o')
    .replace(/&/g, ' and ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Does the name contain what was typed? An empty search matches everyone. */
export function matchesName(name: string, query: string) {
  const q = normalize(query);
  if (!q) return true;
  const n = normalize(name);
  return n.includes(q) || n.replace(/ /g, '').includes(q.replace(/ /g, ''));
}

/** Lineups longer than this get a search field. */
export const SEARCH_FROM = 12;

/** An artist "is" a sound when they carry at least this much of it. */
export const SOUND_MIN = 0.5;

export function carriesSound(artist: Artist, tag: SoundTag) {
  return (artist.sound[tag] ?? 0) >= SOUND_MIN;
}

/**
 * The sounds worth offering as filters on a lineup: ones at least `min`
 * artists carry, in the app's usual sound order, with how many. Artists
 * without sound tags don't count towards any.
 */
export function lineupSounds(artists: Artist[], min = 3): { tag: SoundTag; count: number }[] {
  return SOUND_TAGS.map((tag) => ({ tag, count: artists.filter((a) => carriesSound(a, tag)).length })).filter(
    (s) => s.count >= min,
  );
}

/** Narrow a lineup by name and, when one is picked, by sound. */
export function filterLineup(artists: Artist[], query: string, sound?: SoundTag) {
  return artists.filter((a) => matchesName(a.name, query) && (!sound || carriesSound(a, sound)));
}
