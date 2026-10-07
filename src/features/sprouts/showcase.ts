/**
 * Your showcase, pure: up to three artist collectibles you pin to your
 * profile, in the order you pinned them. Published with your garden (each
 * pinned one marked `pin: 1..3`), so visitors see them first.
 */
export const SHOWCASE_MAX = 3;

const ID = /^[a-z0-9-]{1,80}$/;

/** A saved showcase read back: known-looking ids, once each, at most three. */
export const cleanShowcase = (raw: unknown): string[] => (Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string' && ID.test(x)))].slice(0, SHOWCASE_MAX) : []);

/** Pin or unpin one. Pinning a fourth does nothing (`full`): unpin one first. */
export function toggleShowcase(list: readonly string[], id: string): { list: string[]; full?: true } {
  if (list.includes(id)) return { list: list.filter((x) => x !== id) };
  if (list.length >= SHOWCASE_MAX) return { list: [...list], full: true };
  return { list: [...list, id] };
}

/** The showcase as it stands: only collectibles you still have, in pinned order. */
export const liveShowcase = (list: readonly string[], owned: ReadonlySet<string>) => list.filter((id) => owned.has(id));
