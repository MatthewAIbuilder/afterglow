import type { Festival } from '../../data/types';
import { SOUND_LABEL, type SoundTag } from '../../data/models';
import { bySoonest, isOver } from '../festivals/shelves';
import { t, tn } from '../../i18n';

/** The scope picker's value for "the whole map" (any other value is a festival id). */
export const EVERYONE = 'everyone';

/** How many of your festivals get their own chip above the map. */
export const LENS_FESTIVALS = 3;

export type Lens = { id: string | undefined; label: string };

/**
 * The choices above the map, in plain words: all artists, then the festivals
 * you're going to (soonest first, not over, up to LENS_FESTIVALS), plus the
 * festival being shown when it isn't one of those. Anything else is one tap
 * away through "More festivals".
 */
export function mapLenses(festivals: readonly Festival[], going: readonly string[], current: string | undefined, today: Date): Lens[] {
  const yours = bySoonest(
    festivals.filter((f) => going.includes(f.id) && !isOver(f, today)),
    today,
  ).slice(0, LENS_FESTIVALS);
  const shown = current && !yours.some((f) => f.id === current) ? festivals.find((f) => f.id === current) : undefined;
  return [{ id: undefined, label: t('All artists') }, ...yours.map((f) => ({ id: f.id, label: f.name })), ...(shown ? [{ id: shown.id, label: shown.name }] : [])];
}

export type SignalCounts = { likes: number; saves: number; skips: number; watched: number; rated: number; libraries: string[] };

/** What your map rests on, as one short line: "From 4 rated artists and 2 likes". Undefined with nothing yet. */
export function basisLine({ likes, saves, skips, watched, rated, libraries }: SignalCounts): string | undefined {
  const parts = [
    libraries.length > 0 && tn(libraries.length, 'your {names} library', 'your {names} libraries', { names: andList(libraries) }),
    rated > 0 && tn(rated, '{n} rated artist', '{n} rated artists'),
    likes > 0 && tn(likes, '{n} like', '{n} likes'),
    saves > 0 && tn(saves, '{n} save', '{n} saves'),
    watched > 0 && tn(watched, '{n} watched clip', '{n} watched clips'),
    skips > 0 && tn(skips, '{n} skip', '{n} skips'),
  ].filter(Boolean) as string[];
  if (!parts.length) return undefined;
  return t('From {list}', { list: andList(parts) });
}

/** The headline over your sound: "Leaning dubstep and melodic bass", or a first guess before you've shaped it. */
export function leanLine(lean: readonly SoundTag[], shaped: boolean): string {
  if (!shaped || !lean.length) return t('A first guess at your sound');
  return t('Leaning {sounds}', { sounds: andList(lean.map((tag) => SOUND_LABEL[tag].toLowerCase())) });
}

/** "a, b and c", in the app's language. */
const andList = (xs: readonly string[]) => (xs.length > 1 ? t('{list} and {last}', { list: xs.slice(0, -1).join(', '), last: xs[xs.length - 1] }) : (xs[0] ?? ''));
