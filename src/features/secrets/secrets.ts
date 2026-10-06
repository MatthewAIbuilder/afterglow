import { t } from '../../i18n';

/**
 * Secrets: little hidden things to find around the app, each with its own
 * moment (a light show, a rain of hearts, fireworks). Found ones are kept
 * and add to your glow; the rest show only a riddle. Pure.
 */
export type SecretId = 'lightshow' | 'plur' | 'sunrise' | 'ringspin' | 'smallprint' | 'fireworks' | 'edge' | 'bassdrop' | 'nightowl' | 'colours' | 'pinspin';

/** What plays when a secret is found (or found again). */
export type SecretEffect = 'lightshow' | 'hearts' | 'sunrise' | 'fireworks' | 'bassdrop' | 'sparkle';

export type SecretSpec = { id: SecretId; title: string; riddle: string; found: string; effect: SecretEffect };

export const SECRETS: readonly SecretSpec[] = [
  { id: 'lightshow', title: t('Light show'), riddle: t('Discover likes a little movement.'), found: t('Shake your phone on Discover for a light show.'), effect: 'lightshow' },
  { id: 'plur', title: 'PLUR', riddle: t('Four letters every raver knows. Look for them.'), found: t('Search for “plur”: peace, love, unity, respect.'), effect: 'hearts' },
  { id: 'sunrise', title: t('Sunrise crew'), riddle: t('Some things only happen at dawn.'), found: t('Open Afterglow between 5 and 7 in the morning.'), effect: 'sunrise' },
  { id: 'ringspin', title: t('Light inside the light'), riddle: t('Your level wants attention. Lots of it.'), found: t('Tap your glow level seven times.'), effect: 'sparkle' },
  { id: 'smallprint', title: t('Small print'), riddle: t('The small print hides something.'), found: t('Tap the version line in Settings seven times.'), effect: 'fireworks' },
  { id: 'fireworks', title: t('Fireworks'), riddle: t('Festivals don’t mind being refreshed. Again. And again.'), found: t('Pull Festivals to refresh three times in a row.'), effect: 'fireworks' },
  { id: 'edge', title: t('Edge of the map'), riddle: t('Get close enough on the festival map to read the street names.'), found: t('Zoom the festival map down to the streets.'), effect: 'sparkle' },
  { id: 'bassdrop', title: t('Bass drop'), riddle: t('Hold on to My Sound.'), found: t('Press and hold the My Sound title.'), effect: 'bassdrop' },
  { id: 'nightowl', title: t('Night owl'), riddle: t('Still up when everyone else has gone home?'), found: t('Open Afterglow between 2 and 4 in the morning.'), effect: 'sparkle' },
  { id: 'colours', title: t('True colours'), riddle: t('Your friend code has a wardrobe. Try it all on.'), found: t('Try every colour of your friend code in one go.'), effect: 'hearts' },
  { id: 'pinspin', title: t('Pin polish'), riddle: t('A festival pin likes a little attention.'), found: t('Tap a festival pin seven times.'), effect: 'fireworks' },
];

/** Glow for each secret found (counted in your glow level). */
export { SECRET_FIND_GLOW as SECRET_GLOW } from '../quests/daily';

/** Words the search knows that aren't artists or festivals. */
export function searchSecret(query: string): SecretId | undefined {
  const q = query.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (q === 'plur' || q === 'peaceloveunityrespect') return 'plur';
  return undefined;
}

/** Up in time for the sunrise: 5 to 7 in the morning, phone time. */
export const isSunriseHour = (t: number) => {
  const h = new Date(t).getHours();
  return h >= 5 && h < 7;
};

/** Still going after the after-party: 2 to 4 in the morning, phone time. */
export const isNightOwlHour = (t: number) => {
  const h = new Date(t).getHours();
  return h >= 2 && h < 4;
};

/** Every one of `all` has been tried. */
export const triedAll = (tried: ReadonlySet<string>, all: readonly string[]) => all.every((x) => tried.has(x));

/** An accelerometer reading, in g. */
export type Accel = { x: number; y: number; z: number; t: number };

/** A jolt this strong (beyond gravity) counts towards a shake: well past running or dancing. */
export const SHAKE_G = 1.8;
/** This many jolts within `SHAKE_WINDOW_MS` make a shake. */
export const SHAKE_JOLTS = 3;
export const SHAKE_WINDOW_MS = 900;

/**
 * Keeps recent jolts and says when they add up to a shake. Returns the jolts
 * to keep (cleared after a shake, so one shake is one shake).
 */
export function shakeStep(jolts: readonly number[], sample: Accel): { jolts: number[]; shook: boolean } {
  // Beyond gravity: the reading includes 1 g even with the phone still.
  const g = Math.abs(Math.sqrt(sample.x ** 2 + sample.y ** 2 + sample.z ** 2) - 1);
  const recent = jolts.filter((t) => sample.t - t <= SHAKE_WINDOW_MS);
  // A jolt needs a gap from the last, so one long wobble isn't three.
  if (g >= SHAKE_G && (!recent.length || sample.t - recent[recent.length - 1] > 120)) recent.push(sample.t);
  if (recent.length >= SHAKE_JOLTS) return { jolts: [], shook: true };
  return { jolts: recent, shook: false };
}

/** Taps close together: the seventh in a row (each within `gapMs` of the last) is the one. */
export function tapStep(taps: readonly number[], t: number, need = 7, gapMs = 700): { taps: number[]; done: boolean } {
  const kept = taps.length && t - taps[taps.length - 1] > gapMs ? [] : [...taps];
  kept.push(t);
  return kept.length >= need ? { taps: [], done: true } : { taps: kept, done: false };
}

/** Reads the found list back: known ids with when they were found. */
export function cleanFound(raw: unknown): Partial<Record<SecretId, number>> {
  if (!raw || typeof raw !== 'object') return {};
  const ids = new Set<string>(SECRETS.map((s) => s.id));
  const out: Partial<Record<SecretId, number>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (ids.has(k) && typeof v === 'number' && v > 0) out[k as SecretId] = v;
  return out;
}

/** "3 of 8 secrets found". */
export const secretsLine = (found: number) => (found === SECRETS.length ? t('All {total} secrets found', { total: SECRETS.length }) : t('{found} of {total} secrets found', { found, total: SECRETS.length }));
