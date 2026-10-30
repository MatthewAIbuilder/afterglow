/**
 * Your own changes to a festival's plan, per festival. Pure.
 *
 * A planning preference only, like stars: it shapes the plan and the route,
 * never the taste engine.
 * - `out`: acts you took out of your plan here ("Not this one").
 * - `first`: your first choices ("Go with this one"): they win every clash
 *   they're in, even against another star.
 * - `own`: only what you starred; nothing suggested.
 */
export type PlanEdit = { out?: string[]; first?: string[]; own?: true };
export type PlanEdits = Record<string, PlanEdit>;

export type EditsAt = { out: ReadonlySet<string>; first: ReadonlySet<string>; own: boolean };

export const NO_EDITS: EditsAt = { out: new Set(), first: new Set(), own: false };

export function editsAt(all: PlanEdits, festivalId: string): EditsAt {
  const e = all[festivalId];
  if (!e) return NO_EDITS;
  return { out: new Set(e.out ?? []), first: new Set(e.first ?? []), own: !!e.own };
}

const ids = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const kept = [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200))];
  return kept.length ? kept : undefined;
};

/** Edits read back from storage, whatever shape they're in. */
export function cleanEdits(raw: unknown): PlanEdits {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: PlanEdits = {};
  for (const [f, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const e = v as Record<string, unknown>;
    const edit: PlanEdit = {};
    const o = ids(e.out);
    const first = ids(e.first);
    if (o) edit.out = o;
    if (first) edit.first = first.filter((id) => !o?.includes(id));
    if (!edit.first?.length) delete edit.first;
    if (e.own === true) edit.own = true;
    if (Object.keys(edit).length) out[f] = edit;
  }
  return out;
}

function put(all: PlanEdits, festivalId: string, edit: PlanEdit): PlanEdits {
  const { [festivalId]: _, ...rest } = all;
  const tidy: PlanEdit = {};
  if (edit.out?.length) tidy.out = edit.out;
  if (edit.first?.length) tidy.first = edit.first;
  if (edit.own) tidy.own = true;
  return Object.keys(tidy).length ? { ...rest, [festivalId]: tidy } : rest;
}

/** "Not this one": out of your plan here (and no longer a first choice). */
export function takeOut(all: PlanEdits, festivalId: string, artistId: string): PlanEdits {
  const e = all[festivalId] ?? {};
  return put(all, festivalId, {
    ...e,
    out: [...(e.out ?? []).filter((id) => id !== artistId), artistId],
    first: (e.first ?? []).filter((id) => id !== artistId),
  });
}

/** Back into your plan, as the app would suggest it. */
export function bringBack(all: PlanEdits, festivalId: string, artistId: string): PlanEdits {
  const e = all[festivalId] ?? {};
  return put(all, festivalId, { ...e, out: (e.out ?? []).filter((id) => id !== artistId) });
}

/** Everything you took out here, back in. */
export function bringAllBack(all: PlanEdits, festivalId: string): PlanEdits {
  const e = all[festivalId] ?? {};
  return put(all, festivalId, { ...e, out: [] });
}

/**
 * "Go with this one": your first choice, over the sets it clashes with
 * (`over`), which stop being first choices. Also back in your plan if it was out.
 */
export function goWith(all: PlanEdits, festivalId: string, artistId: string, over: readonly string[] = []): PlanEdits {
  const e = all[festivalId] ?? {};
  const drop = new Set([...over, artistId]);
  return put(all, festivalId, {
    ...e,
    out: (e.out ?? []).filter((id) => id !== artistId),
    first: [...(e.first ?? []).filter((id) => !drop.has(id)), artistId],
  });
}

/** No longer your first choice (it stays starred). */
export function notFirst(all: PlanEdits, festivalId: string, artistId: string): PlanEdits {
  const e = all[festivalId] ?? {};
  return put(all, festivalId, { ...e, first: (e.first ?? []).filter((id) => id !== artistId) });
}

/** "Only mine" on or off. */
export function setOwn(all: PlanEdits, festivalId: string, own: boolean): PlanEdits {
  return put(all, festivalId, { ...(all[festivalId] ?? {}), own: own ? true : undefined });
}
