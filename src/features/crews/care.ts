import type { Crew, CrewCare, CrewUpdate } from '../social/models';
import { byHappened, clock } from './updates';

/**
 * "I'm OK" and "come find me", pure: a check-in about how you are, sent to
 * your crew only when you tap it (how you feel on Look after yourself stays
 * on your phone otherwise). A call for help stays up for the crew until you
 * say you're OK or `CARE_WINDOW_MS` passes, and each crewmate's phone nudges
 * them once per call.
 */

/** A call for help stays up this long unless they say they're OK first. */
export const CARE_WINDOW_MS = 3 * 3600 * 1000;
/** At most this many calls are remembered as already nudged. */
export const NOTIFIED_MAX = 100;

/** The words a care check-in carries, so it reads right anywhere a check-in shows. */
export const CARE_NOTE: Record<CrewCare, string> = {
  ok: 'I’m OK',
  help: 'Not feeling great. Can someone come find me?',
};

/** Which to offer after a check-in on Look after yourself: feeling okay or better says you're OK; worse asks for a hand. */
export const careFor = (level: number): CrewCare => (level >= 3 ? 'ok' : 'help');

/** Each person's latest care check-in in the window, newest first (the same update in two crews once). */
function latestCare(updates: readonly CrewUpdate[], now: number): Map<string, CrewUpdate> {
  const latest = new Map<string, CrewUpdate>();
  for (const u of [...updates].sort(byHappened)) {
    if (u.kind !== 'checkin' || !u.care || now - Date.parse(u.at) > CARE_WINDOW_MS || latest.has(u.uid)) continue;
    latest.set(u.uid, u);
  }
  return latest;
}

/**
 * Crewmates asking for help right now: their latest care check-in in the
 * window says help (a later "I'm OK" clears it). Never you, anyone blocked,
 * or anyone no longer in the crew it was posted to. Newest first.
 */
export function careAlerts(
  updates: readonly CrewUpdate[],
  crews: readonly Crew[],
  { me, blocked = [], now }: { me?: string; blocked?: readonly string[]; now: number },
): CrewUpdate[] {
  const inCrew = new Map(crews.map((c) => [c.id, new Set(c.members)]));
  const theirs = updates.filter((u) => u.uid !== me && !blocked.includes(u.uid) && inCrew.get(u.crewId)?.has(u.uid));
  return [...latestCare(theirs, now).values()].filter((u) => u.care === 'help').sort(byHappened);
}

/** Your own latest care check-in in the window (sent or waiting), so the page can offer "I'm OK now" after asking for help. */
export function myCare(updates: readonly CrewUpdate[], me: string | undefined, now: number): CrewUpdate | undefined {
  return me ? latestCare(updates.filter((u) => u.uid === me), now).get(me) : undefined;
}

/** "Maya isn't feeling great": the nudge's title. */
export const helpTitle = (name: string) => `${name} isn’t feeling great`;

/** "Sent 5:30 PM. Tap to see where they last were.": the nudge's body. */
export const helpBody = (u: Pick<CrewUpdate, 'at'>) => `Sent ${clock(u.at)}. Tap to see their update and let them know you’re coming.`;

/** Calls for help not nudged yet on this phone. */
export const toNotify = (alerts: readonly CrewUpdate[], notified: readonly string[]) => alerts.filter((u) => !notified.includes(u.id));

/** Remember these as nudged (newest last, bounded). */
export const withNotified = (notified: readonly string[], ids: readonly string[]): string[] => [...notified.filter((id) => !ids.includes(id)), ...ids].slice(-NOTIFIED_MAX);

export function cleanNotified(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(-NOTIFIED_MAX) : [];
}

/**
 * Where to send a care check-in: tonight's festival when you have a crew
 * there, else the only festival you have a live crew at. Undefined when it's
 * unclear or there's no crew.
 */
export function careFestival(tonight: string | undefined, crewFestivals: readonly string[]): string | undefined {
  if (tonight && crewFestivals.includes(tonight)) return tonight;
  return crewFestivals.length === 1 ? crewFestivals[0] : undefined;
}
