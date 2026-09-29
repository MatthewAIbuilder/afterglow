import { SOUND_LABEL, SOUND_TAGS, type Artist, type SoundTag } from '../../data/models';
import { carriesSound, matchesName, normalize } from '../festivals/search';

/**
 * Searching My Sound: what you type can be an artist or a sound. Pure.
 * "dub" finds the dubstep artists, "melodic" melodic bass, "wool" WOOLI,
 * "indie" the indie acts. Every artist matching by name or by sound lights up.
 */

export type MapSearch = {
  /** Sounds the search names (a word of the sound starts with it): "dub" -> dubstep. */
  sounds: SoundTag[];
  /** Everyone who matches, by name or by carrying one of those sounds. */
  ids: Set<string>;
};

/** Sound names start with what was typed ("hip" -> Hip-hop, "bass" -> Melodic bass). */
export function soundsMatching(query: string): SoundTag[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  return SOUND_TAGS.filter((t) => {
    const label = normalize(SOUND_LABEL[t]);
    return label.startsWith(q) || label.split(' ').some((w) => w.startsWith(q)) || label.replace(/ /g, '').startsWith(q.replace(/ /g, ''));
  });
}

export function mapSearch(artists: Artist[], query: string): MapSearch | undefined {
  if (!normalize(query)) return undefined;
  const sounds = soundsMatching(query);
  const ids = new Set(
    artists.filter((a) => matchesName(a.name, query) || sounds.some((t) => carriesSound(a, t))).map((a) => a.id),
  );
  return { sounds, ids };
}

/**
 * Matches not on the map yet, to bring onto it so they can pop up: best
 * matches first, at most `max`.
 */
export function extraMatches(candidates: Artist[], onMap: Artist[], search: MapSearch, taste: Record<string, number>, max = 15): Artist[] {
  const shown = new Set(onMap.map((a) => a.id));
  return candidates
    .filter((a) => search.ids.has(a.id) && !shown.has(a.id))
    .sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0))
    .slice(0, max);
}
