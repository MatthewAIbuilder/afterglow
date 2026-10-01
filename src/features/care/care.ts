/**
 * Look after yourself: private notes for a festival night. Timers in your
 * own words, water and food taps, quick check-ins. Plain data, kept only on
 * this phone (state/care.tsx); never uploaded, never in recaps or profiles.
 * The app never names substances and gives no dosing advice. Pure.
 */

export type CareTimer = { id: string; label: string; startedAt: number };
export type Mood = 'good' | 'okay' | 'rough';
export type CareEntry = { kind: 'water' | 'food'; at: number } | { kind: 'checkin'; at: number; mood: Mood };
export type Care = { timers: CareTimer[]; log: CareEntry[]; lock: boolean };

export const EMPTY_CARE: Care = { timers: [], log: [], lock: false };
/** Most timers running at once. */
export const TIMERS_MAX = 6;
/** Longest label, in characters. */
export const LABEL_MAX = 40;
/** How many log entries are kept (oldest go first). */
export const LOG_MAX = 300;
/** Notes older than this are dropped when read back: a night's notes aren't a diary. */
export const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

export const MOOD_LABEL: Record<Mood, string> = { good: 'Good', okay: 'Okay', rough: 'Not great' };

const MIN = 60_000;

export function startTimer(care: Care, label: string, now: number, id = `t${now.toString(36)}`): Care {
  if (care.timers.length >= TIMERS_MAX) return care;
  const clean = label.replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX);
  return { ...care, timers: [...care.timers, { id, label: clean, startedAt: now }] };
}

export const stopTimer = (care: Care, id: string): Care => ({ ...care, timers: care.timers.filter((t) => t.id !== id) });

export function addEntry(care: Care, entry: CareEntry): Care {
  const log = [...care.log, entry].slice(-LOG_MAX);
  return { ...care, log };
}

/** Takes back the newest entry of that kind (an accidental tap). */
export function undoLast(care: Care, kind: CareEntry['kind']): Care {
  const i = care.log.map((e) => e.kind).lastIndexOf(kind);
  return i < 0 ? care : { ...care, log: care.log.filter((_, j) => j !== i) };
}

/** The newest entry of a kind. */
export const lastOf = (care: Care, kind: CareEntry['kind']): CareEntry | undefined => [...care.log].reverse().find((e) => e.kind === kind);

/**
 * When tonight began: noon today, or noon yesterday before noon (festival
 * nights run noon to noon, like set times), in the phone's time.
 */
export function nightStart(now: number): number {
  const d = new Date(now);
  const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
  return now >= noon ? noon : noon - 24 * 60 * MIN;
}

/** How many of a kind since tonight began. */
export const countTonight = (care: Care, kind: CareEntry['kind'], now: number) => care.log.filter((e) => e.kind === kind && e.at >= nightStart(now)).length;

/** "Just now", "12 min", "1 h 5 min", "3 h": for elapsed times, easy to read at a glance. */
export function elapsed(ms: number): string {
  const m = Math.max(0, Math.floor(ms / MIN));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** "Last one 40 min ago", "None yet tonight". */
export function lastLine(care: Care, kind: CareEntry['kind'], now: number): string {
  const last = lastOf(care, kind);
  if (!last || last.at < nightStart(now)) return 'None yet tonight';
  const ago = elapsed(now - last.at);
  return ago === 'Just now' ? 'Just now' : `Last ${ago} ago`;
}

/** Whether the latest check-in tonight was "not great": help comes first then. */
export function needsHelp(care: Care, now: number): boolean {
  const last = lastOf(care, 'checkin');
  return !!last && last.kind === 'checkin' && last.mood === 'rough' && last.at >= nightStart(now);
}

/** The one line on the festival page's card: what's running and when you last drank. */
export function cardLine(care: Care, now: number): string {
  const parts: string[] = [];
  const t = care.timers[0];
  if (t) parts.push(`${t.label || 'Timer'} ${elapsed(now - t.startedAt)}`);
  const water = lastOf(care, 'water');
  if (water && water.at >= nightStart(now)) parts.push(`water ${elapsed(now - water.at)} ago`);
  return parts.length ? parts.join(' · ').replace(/^./, (c) => c.toUpperCase()) : 'Timers, water and check-ins, private to you';
}

/** The region in a locale: "en-US" -> "US", "es_419" -> undefined. */
export const regionOf = (locale: string | undefined): string | undefined => locale?.match(/[-_]([A-Za-z]{2})(?:[-_]|$)/)?.[1]?.toUpperCase();

/** Emergency number for the phone's region: 911 in North America, 999 in the UK, 000 in Australia, 112 elsewhere (works across Europe and on most phones). */
export function emergencyNumber(region: string | undefined): string {
  const r = (region ?? '').toUpperCase();
  if (['US', 'CA', 'MX', 'PR'].includes(r)) return '911';
  if (r === 'GB') return '999';
  if (r === 'AU') return '000';
  if (r === 'NZ') return '111';
  return '112';
}

/** Saved notes read back safely: anything malformed or older than `KEEP_MS` is dropped. */
export function cleanCare(raw: unknown, now: number): Care {
  if (!raw || typeof raw !== 'object') return EMPTY_CARE;
  const o = raw as Record<string, unknown>;
  const fresh = (at: unknown): at is number => typeof at === 'number' && at > now - KEEP_MS && at <= now + MIN;
  const timers = (Array.isArray(o.timers) ? o.timers : [])
    .filter((t): t is CareTimer => !!t && typeof t === 'object' && typeof (t as CareTimer).id === 'string' && typeof (t as CareTimer).label === 'string' && fresh((t as CareTimer).startedAt))
    .slice(0, TIMERS_MAX)
    .map((t) => ({ id: t.id, label: t.label.slice(0, LABEL_MAX), startedAt: t.startedAt }));
  const log = (Array.isArray(o.log) ? o.log : [])
    .filter((e): e is CareEntry => {
      if (!e || typeof e !== 'object' || !fresh((e as CareEntry).at)) return false;
      const k = (e as CareEntry).kind;
      if (k === 'water' || k === 'food') return true;
      return k === 'checkin' && ['good', 'okay', 'rough'].includes((e as { mood?: string }).mood ?? '');
    })
    .sort((a, b) => a.at - b.at)
    .slice(-LOG_MAX);
  return { timers, log, lock: o.lock === true };
}
