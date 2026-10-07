/**
 * The same sprout more than once, shown once with how many: on the profile's
 * garden shelf, five identical seedlings become one with "×5". Two count as
 * the same when they look the same (kind as shown, growth, and artist). Pure;
 * keeps the order each look first appears in.
 */
export type Stackable = { id: string; shown: string; stage?: number; artist?: { id: string } };

export function stackSame<T extends Stackable>(list: readonly T[]): { item: T; count: number }[] {
  const out: { item: T; count: number }[] = [];
  const at = new Map<string, number>();
  for (const s of list) {
    const key = `${s.shown}|${s.stage ?? ''}|${s.artist?.id ?? ''}`;
    const i = at.get(key);
    if (i === undefined) {
      at.set(key, out.length);
      out.push({ item: s, count: 1 });
    } else out[i].count++;
  }
  return out;
}
