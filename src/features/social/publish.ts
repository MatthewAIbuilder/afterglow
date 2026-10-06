import type { Profile } from './models';

/**
 * What your profile publishes follows your plans: when "Show festivals I'm
 * going to", "Show my sound" or "Show my favourite artists" is on and the list changes, the profile is
 * updated. Pure: says whether anything would change (order doesn't count).
 */
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

export function publishedChanged(profile: Profile, festivals: readonly string[], sounds: readonly string[], artists?: readonly string[], shows?: readonly string[]): boolean {
  return (
    (profile.showFestivals && !same(profile.festivals, festivals)) ||
    (shows !== undefined && profile.showFestivals && !same(profile.shows ?? [], shows)) ||
    (profile.showSound && !same(profile.sounds, sounds)) ||
    (artists !== undefined && profile.showArtists && !same(profile.artists, artists))
  );
}
