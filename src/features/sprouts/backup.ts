/**
 * Your garden's private copy, kept with your account (Firestore
 * `gardenBackups/{uid}`, readable only by you): the sprouts you picked up,
 * the ones you've given, what bloomed into what, wild finds and your first
 * sprout. A new phone, a cleared browser or a reinstall reads it back and
 * merges it in, so nothing in a garden is ever lost to an update. Pure: the
 * shapes are whatever the sprouts store saves, as JSON.
 */

/** The most a copy can be (characters of JSON), well inside a database document. */
export const GARDEN_BACKUP_MAX = 900_000;
/** Given sprouts kept in the copy, newest first. */
export const BACKUP_GIFTS_MAX = 500;
/** Sprouts kept in the copy (a garden is never this big). */
export const BACKUP_GARDEN_MAX = 2000;

type WithId = { id: string };
type WithAt = { at: number };

export type BackupParts<G extends WithId & WithAt, S extends WithId & WithAt> = {
  garden: readonly G[];
  gifts: readonly S[];
  bloomed: Readonly<Record<string, string>>;
  bloomedAt?: Readonly<Record<string, number>>;
  bloomsShown?: readonly string[];
  artistShown?: Readonly<Record<string, number>>;
  starterAt?: number;
  wild?: readonly G[];
  /** Given away and picked up (`account:id`), and your own artist collectibles given away (`account:artistId` → when). */
  gone?: readonly string[];
  artistGone?: Readonly<Record<string, number>>;
};

/** The copy to keep, as text, or undefined when there's nothing worth keeping yet (so an empty phone never writes over a full copy). */
export function backupText<G extends WithId & WithAt, S extends WithId & WithAt>(parts: BackupParts<G, S>): string | undefined {
  const garden = [...parts.garden].sort((a, b) => b.at - a.at).slice(0, BACKUP_GARDEN_MAX);
  const gifts = [...parts.gifts].sort((a, b) => b.at - a.at).slice(0, BACKUP_GIFTS_MAX);
  const wild = [...(parts.wild ?? [])].slice(-500);
  if (!garden.length && !gifts.length && !wild.length && !Object.keys(parts.bloomed).length) return undefined;
  const text = JSON.stringify({
    v: 1,
    garden,
    gifts,
    bloomed: parts.bloomed,
    ...(parts.bloomedAt ? { bloomedAt: parts.bloomedAt } : {}),
    ...(parts.bloomsShown?.length ? { bloomsShown: parts.bloomsShown.slice(-500) } : {}),
    ...(parts.artistShown ? { artistShown: parts.artistShown } : {}),
    ...(parts.starterAt ? { starterAt: parts.starterAt } : {}),
    ...(parts.gone?.length ? { gone: parts.gone.slice(-2000) } : {}),
    ...(parts.artistGone && Object.keys(parts.artistGone).length ? { artistGone: parts.artistGone } : {}),
    wild,
  });
  return text.length <= GARDEN_BACKUP_MAX ? text : undefined;
}

/** A copy read back: the object inside, or undefined when it isn't one. */
export function readBackup(text: string | null | undefined): Record<string, unknown> | undefined {
  if (!text) return undefined;
  try {
    const o = JSON.parse(text) as unknown;
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
