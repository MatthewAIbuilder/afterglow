import type { CrewUpdate } from '../social/models';

/**
 * Fit check: a photo of your outfit for each festival day, kept on your
 * phone (`fitChecks.v1`, per account), and sent to your crew as a photo
 * update with the words "Fit check" when you choose. Pure.
 */
export const FIT_NOTE = 'Fit check';
export const FITS_MAX = 120;

export type FitCheck = {
  festivalId: string;
  /** "2026-11-06": the festival day (a photo after midnight counts for the night before). */
  date: string;
  uri: string;
  at: number;
  width?: number;
  height?: number;
  /** It went to your crew. */
  sent?: boolean;
};

/** A photo before this hour belongs to the night before. */
const NIGHT_ENDS_HOUR = 7;

/** The festival day a moment belongs to. */
export function fitDate(ms: number): string {
  const d = new Date(ms);
  if (d.getHours() < NIGHT_ENDS_HOUR) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const fitKey = (f: Pick<FitCheck, 'festivalId' | 'date'>) => `${f.festivalId}:${f.date}`;

/** Fit checks read back from storage, whatever shape they're in, newest first. */
export function cleanFits(raw: unknown): FitCheck[] {
  if (!Array.isArray(raw)) return [];
  const out: FitCheck[] = [];
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const f = v as Record<string, unknown>;
    if (typeof f.festivalId !== 'string' || typeof f.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.date) || typeof f.uri !== 'string' || !f.uri || typeof f.at !== 'number') continue;
    out.push({
      festivalId: f.festivalId,
      date: f.date,
      uri: f.uri,
      at: f.at,
      ...(typeof f.width === 'number' ? { width: f.width } : {}),
      ...(typeof f.height === 'number' ? { height: f.height } : {}),
      ...(f.sent === true ? { sent: true } : {}),
    });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, FITS_MAX);
}

/** One fit per festival day: a new one replaces that day's. */
export function keepFit(fits: readonly FitCheck[], fit: FitCheck): FitCheck[] {
  return [fit, ...fits.filter((f) => fitKey(f) !== fitKey(fit))].slice(0, FITS_MAX);
}

export const removeFit = (fits: readonly FitCheck[], key: string) => fits.filter((f) => fitKey(f) !== key);

/** Crewmates' fit checks for a festival day: their photo updates marked "Fit check", newest per person. */
export function crewFits(updates: readonly CrewUpdate[], festivalId: string, date: string, me: string | undefined): CrewUpdate[] {
  const by = new Map<string, CrewUpdate>();
  for (const u of updates) {
    if (u.kind !== 'photo' || u.note !== FIT_NOTE || u.festivalId !== festivalId || u.uid === me || !u.thumbUrl) continue;
    if (fitDate(Date.parse(u.at)) !== date) continue;
    const was = by.get(u.uid);
    if (!was || Date.parse(u.at) > Date.parse(was.at)) by.set(u.uid, u);
  }
  return [...by.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** Your fits, festival by festival (most recent first), each in day order. */
export function fitsByFestival(fits: readonly FitCheck[]): { festivalId: string; fits: FitCheck[] }[] {
  const by = new Map<string, FitCheck[]>();
  for (const f of fits) by.set(f.festivalId, [...(by.get(f.festivalId) ?? []), f]);
  return [...by.entries()]
    .map(([festivalId, list]) => ({ festivalId, fits: [...list].sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => Math.max(...b.fits.map((f) => f.at)) - Math.max(...a.fits.map((f) => f.at)));
}
