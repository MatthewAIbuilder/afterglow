import type { Festival } from '../../data/models';
import { distanceKm, type Point, type Units } from './near';

/**
 * How far the festival calendar looks: within a distance of you, one US state,
 * or everywhere. Pure: where you are and where each festival is come in.
 */
export type Reach = { kind: 'near'; km: number } | { kind: 'state'; code: string } | { kind: 'all' };

const KM_PER_MI = 1.609344;

/** The distances on offer, in each unit (stored in km). */
export const RADII: Record<Units, number[]> = {
  mi: [50, 100, 250, 500].map((n) => n * KM_PER_MI),
  km: [75, 150, 400, 800],
};
/** What the calendar opens on: about 100 miles. */
export const DEFAULT_KM = 100 * KM_PER_MI;

/** "50 mi", "150 km". */
export const radiusLabel = (km: number, units: Units) => `${Math.round(units === 'mi' ? km / KM_PER_MI : km)} ${units}`;

export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'Washington, DC', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico',
};
const BY_NAME = new Map(Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]));

/** The state a location names at its end: "Arcosanti, Mayer, AZ" -> "AZ", "Austin, Texas" -> "TX". */
export function stateFromText(location: string): string | undefined {
  const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
  for (const part of parts.slice(-2).reverse()) {
    const bare = part.replace(/\s+\d{5}(-\d{4})?$/, '').replace(/\.$/, '');
    const code = bare.toUpperCase();
    if (/^[A-Z]{2}$/i.test(bare) && US_STATES[code]) return code;
    const named = BY_NAME.get(bare.toLowerCase());
    if (named) return named;
  }
  return undefined;
}

/** Festivals whose location doesn't name a state borrow one from a festival this close that does. */
const BORROW_KM = 60;

/** Each festival's state, from its location, else from the nearest festival that names one. */
export function festivalStates(festivals: readonly Festival[], placeOf: (f: Festival) => Point | undefined): Map<string, string> {
  const out = new Map<string, string>();
  const known: { p: Point; code: string }[] = [];
  for (const f of festivals) {
    const code = stateFromText(f.location);
    if (!code) continue;
    out.set(f.id, code);
    const p = placeOf(f);
    if (p) known.push({ p, code });
  }
  for (const f of festivals) {
    if (out.has(f.id)) continue;
    const p = placeOf(f);
    if (!p) continue;
    let best: { km: number; code: string } | undefined;
    for (const k of known) {
      const km = distanceKm(p, k.p);
      if (km <= BORROW_KM && (!best || km < best.km)) best = { km, code: k.code };
    }
    if (best) out.set(f.id, best.code);
  }
  return out;
}

/** The states with festivals, most festivals first (then by name). */
export function statesWithFestivals(states: Map<string, string>): { code: string; name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const code of states.values()) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts]
    .map(([code, count]) => ({ code, name: US_STATES[code], count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Your state is guessed from a festival no further than this. */
const NEAR_STATE_KM = 150;

/** Your state, roughly: that of the nearest festival with one, if it's close. */
export function stateNear(here: Point | undefined, festivals: readonly Festival[], states: Map<string, string>, placeOf: (f: Festival) => Point | undefined): string | undefined {
  if (!here) return undefined;
  let best: { km: number; code: string } | undefined;
  for (const f of festivals) {
    const code = states.get(f.id);
    const p = placeOf(f);
    if (!code || !p) continue;
    const km = distanceKm(here, p);
    if (km <= NEAR_STATE_KM && (!best || km < best.km)) best = { km, code };
  }
  return best?.code;
}

/**
 * The festivals inside a reach. Ones you're going to always stay. Within a distance needs where you
 * are; without it (location off) nothing is left out.
 */
export function withinReach(
  festivals: readonly Festival[],
  reach: Reach,
  ctx: { here?: Point; placeOf: (f: Festival) => Point | undefined; states: Map<string, string>; going: readonly string[] },
): Festival[] {
  if (reach.kind === 'all') return [...festivals];
  if (reach.kind === 'near' && !ctx.here) return [...festivals];
  return festivals.filter((f) => {
    if (ctx.going.includes(f.id)) return true;
    if (reach.kind === 'state') return ctx.states.get(f.id) === reach.code;
    const p = ctx.placeOf(f);
    return !!p && distanceKm(ctx.here!, p) <= reach.km;
  });
}

/** "within 100 mi" / "in Florida" / "" (everywhere), for the month line. */
export function reachWords(reach: Reach, units: Units, located: boolean): string {
  if (reach.kind === 'state') return `in ${US_STATES[reach.code] ?? reach.code}`;
  if (reach.kind === 'near' && located) return `within ${radiusLabel(reach.km, units)}`;
  return '';
}

/** A saved reach, checked. */
export function parseReach(raw: unknown): Reach | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Reach;
  if (r.kind === 'all') return { kind: 'all' };
  if (r.kind === 'near' && typeof r.km === 'number' && r.km > 0 && r.km < 5000) return { kind: 'near', km: r.km };
  if (r.kind === 'state' && typeof r.code === 'string' && US_STATES[r.code]) return { kind: 'state', code: r.code };
  return undefined;
}
