import type { Festival } from '../../data/models';
import { isOver, whenRank } from '../festivals/shelves';
import type { Profile } from '../social/models';
import { months, t, weekdays } from '../../i18n';

/**
 * Where faces sit in the Friends orbit and in a crew's picture. Pure.
 *
 * The Friends tab borrows the profile's sound orbit: you in the middle, your
 * close friends on an inner ring (bigger, named), everyone else you follow
 * on a wider, fainter ring. A crew's picture is the same idea in miniature:
 * its people's faces round a small ring.
 */

/** Close friends on the inner ring, at most. */
export const INNER_MAX = 6;
/** Other friends on the outer ring, at most. */
export const OUTER_MAX = 10;

export type OrbitSplit<T> = { inner: T[]; outer: T[]; more: number };

/**
 * Who goes where: close friends (in the order you starred them) on the inner
 * ring, the rest on the outer one, each ring capped. `more` is how many
 * friends didn't fit.
 */
export function splitOrbit<T extends { uid: string }>(friends: readonly T[], close: readonly string[], innerMax = INNER_MAX, outerMax = OUTER_MAX): OrbitSplit<T> {
  const byId = new Map(friends.map((f) => [f.uid, f]));
  const inner = close.map((id) => byId.get(id)).filter((f): f is T => !!f).slice(0, innerMax);
  const taken = new Set(inner.map((f) => f.uid));
  const rest = friends.filter((f) => !taken.has(f.uid));
  const outer = rest.slice(0, outerMax);
  return { inner, outer, more: rest.length - outer.length };
}

export type RingPlace = { angle: number; size: number };

/**
 * Evenly round a ring, starting at `start` (radians; 0 is three o'clock),
 * every face the same size. Outer rings start half a step round, so faces on
 * the two rings don't line up.
 */
export function ringPlaces(n: number, size: number, start = -Math.PI / 2): RingPlace[] {
  return Array.from({ length: n }, (_, i) => ({ angle: start + (i * 2 * Math.PI) / Math.max(1, n), size }));
}

export type OrbPlace = { x: number; y: number; size: number };

/**
 * A crew's picture: up to four faces in a box `box` wide. One face fills the
 * middle; two sit side by side on a diagonal; three and four sit round a
 * small ring, slightly overlapping, like a little constellation. Positions
 * are each face's top-left corner.
 */
export function crewOrbPlaces(n: number, box: number): OrbPlace[] {
  const count = Math.max(0, Math.min(4, n));
  if (count === 0) return [];
  if (count === 1) {
    const size = Math.round(box * 0.72);
    return [{ x: (box - size) / 2, y: (box - size) / 2, size }];
  }
  const size = Math.round(box * (count === 2 ? 0.5 : count === 3 ? 0.44 : 0.4));
  // Faces sit on a ring inside the picture's edge, just touching, so the ring of light shows between them.
  const r = box * (count === 2 ? 0.24 : 0.28);
  // Two: top-left and bottom-right. Three: a triangle point-up. Four: a diamond turned slightly.
  const start = count === 2 ? (-3 * Math.PI) / 4 : count === 3 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / 12;
  return Array.from({ length: count }, (_, i) => {
    const angle = start + (i * 2 * Math.PI) / count;
    return { x: Math.round(box / 2 + Math.cos(angle) * r - size / 2), y: Math.round(box / 2 + Math.sin(angle) * r - size / 2), size };
  });
}

/** "2m", "3h", "Tue", "12 Oct": how long ago a chat's last message was, as short as a messages list shows it. */
export function chatTime(at: number, now: number): string {
  const m = Math.max(0, Math.floor((now - at) / 60000));
  if (m < 1) return t('now');
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = new Date(at);
  if (h < 24 * 6) return weekdays(true)[d.getDay()];
  return t('{month} {day}', { month: months(true)[d.getMonth()], day: d.getDate() });
}

/** The soonest festival still to come on someone's profile, if they show where they're going. */
export function nextFestivalOf(profile: Pick<Profile, 'festivals'>, festival: (id: string) => Festival | undefined, today: Date): Festival | undefined {
  return profile.festivals
    .map(festival)
    .filter((f): f is Festival => !!f && !isOver(f, today))
    .sort((a, b) => whenRank(a, today) - whenRank(b, today))[0];
}
