import type { Festival } from '../../data/models';
import { bearing, compassWord, WALK_M_PER_MIN } from '../care/spots';
import { metersBetween, trailUntil } from '../care/trail';
import type { CrewLive } from '../social/models';

/**
 * Crew on the map, pure: when sharing stops by itself, when a new position
 * is worth sending, and how far and which way each crewmate is.
 */

/** A crewmate's spot older than this is shown as "a while ago". */
export const LIVE_FRESH_MS = 20 * 60_000;
/** Sends at most this often, and only after moving this far (or after the longer wait, so the crew sees you're still there). */
export const SEND_EVERY_MS = 60_000;
export const SEND_MOVED_M = 20;
export const SEND_ANYWAY_MS = 5 * 60_000;

/** Sharing for this festival stops by itself at 7 AM the morning after its last day; undefined when it isn't on. */
export const shareUntil = (festival: Festival, now: Date) => trailUntil(festival, now);

export type Sent = { at: number; lat: number; lon: number };

/** Whether a new position is worth sending now. */
export function worthSending(last: Sent | undefined, here: { lat: number; lon: number }, now: number): boolean {
  if (!last) return true;
  const since = now - last.at;
  if (since >= SEND_ANYWAY_MS) return true;
  return since >= SEND_EVERY_MS && metersBetween(last, here) >= SEND_MOVED_M;
}

export type Crewmate = { uid: string; meters?: number; minutes?: number; direction?: string; agoMin: number; stale: boolean; lat: number; lon: number };

/** Each crewmate sharing (never you), nearest first, with how long ago their phone said where they were. */
export function crewmatesNear(list: readonly CrewLive[], me: string | undefined, here: { lat: number; lon: number } | undefined, now: number): Crewmate[] {
  return list
    .filter((l) => l.uid !== me && l.until > now)
    .map((l) => {
      const at = Date.parse(l.at);
      const ago = Number.isFinite(at) ? Math.max(0, Math.round((now - at) / 60_000)) : 0;
      const meters = here ? metersBetween(here, l) : undefined;
      return {
        uid: l.uid,
        lat: l.lat,
        lon: l.lon,
        agoMin: ago,
        stale: Number.isFinite(at) && now - at > LIVE_FRESH_MS,
        ...(meters !== undefined && here ? { meters, minutes: Math.max(1, Math.round(meters / WALK_M_PER_MIN)), direction: compassWord(bearing(here, l)) } : {}),
      };
    })
    .sort((a, b) => Number(a.stale) - Number(b.stale) || (a.meters ?? Infinity) - (b.meters ?? Infinity));
}

/** A dot on the crew map. */
export type MapPerson = { uid: string; initials: string; lat: number; lon: number; stale: boolean; me?: boolean };
