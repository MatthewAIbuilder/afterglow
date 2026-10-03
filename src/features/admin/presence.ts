import { ACTIVE_DAYS_KEPT, type AdminPresence } from '../social/models';

/**
 * Your own last-active record, pure: which calendar day it is on the phone,
 * how a new visit merges with what's saved, and when it's worth writing
 * again. Only when you opened the app is kept, never what you did.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-03" in the phone's own time. */
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** At most this often within a day the record is written again (for "active in the last hour"). */
export const PING_EVERY_MS = 15 * 60_000;

/** The saved record after opening the app at `now`: the first visit kept, today added once, newest days last, bounded. */
export function nextPresence(
  prev: Omit<AdminPresence, 'uid'> | null | undefined,
  input: { platform: string; version: string; hasProfile: boolean; now: Date },
): Omit<AdminPresence, 'uid'> {
  const at = input.now.toISOString();
  const today = localDay(input.now);
  const days = [...new Set([...(prev?.days ?? []).filter((d) => DAY_RE.test(d)), today])].sort().slice(-ACTIVE_DAYS_KEPT);
  return {
    firstSeenAt: prev?.firstSeenAt && prev.firstSeenAt <= at ? prev.firstSeenAt : at,
    lastSeenAt: at,
    days,
    platform: input.platform.slice(0, 20),
    version: input.version.slice(0, 80),
    hasProfile: input.hasProfile,
  };
}

/** Whether to write again: a new day, a profile made, or `PING_EVERY_MS` since the last write this session. */
export function shouldPing(last: { day: string; at: number; hasProfile: boolean } | undefined, now: Date, hasProfile: boolean): boolean {
  if (!last) return true;
  if (last.day !== localDay(now) || last.hasProfile !== hasProfile) return true;
  return now.getTime() - last.at >= PING_EVERY_MS;
}

/** A saved record read back safely (anything malformed is dropped). */
export function presenceFromDoc(uid: string, d: unknown): AdminPresence | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const first = typeof o.firstSeenAt === 'string' && Number.isFinite(Date.parse(o.firstSeenAt)) ? o.firstSeenAt : undefined;
  const last = typeof o.lastSeenAt === 'string' && Number.isFinite(Date.parse(o.lastSeenAt)) ? o.lastSeenAt : undefined;
  if (!first || !last) return null;
  const days = Array.isArray(o.days) ? o.days.filter((x): x is string => typeof x === 'string' && DAY_RE.test(x)).slice(-ACTIVE_DAYS_KEPT) : [];
  return {
    uid,
    firstSeenAt: first,
    lastSeenAt: last,
    days,
    ...(typeof o.platform === 'string' && o.platform ? { platform: o.platform } : {}),
    ...(typeof o.version === 'string' && o.version ? { version: o.version } : {}),
    hasProfile: o.hasProfile === true,
  };
}
