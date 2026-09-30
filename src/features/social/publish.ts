import type { Profile } from './models';

/**
 * What your profile publishes follows your plans: when "Show festivals I'm
 * going to" or "Show my sound" is on and the list changes, the profile is
 * updated. Pure: says whether anything would change (order doesn't count).
 */
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

export function publishedChanged(profile: Profile, festivals: readonly string[], sounds: readonly string[]): boolean {
  return (profile.showFestivals && !same(profile.festivals, festivals)) || (profile.showSound && !same(profile.sounds, sounds));
}
