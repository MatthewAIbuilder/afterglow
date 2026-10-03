/**
 * Accounts saved on this phone for quick switching, pure: who they are (for
 * the list) and how the list changes. No passwords here: those stay in the
 * phone's keychain (`vault.ts`), and only on phones.
 */
export type SavedAccount = { uid: string; email: string; name?: string; handle?: string; avatarUrl?: string; savedAt: string };

/** At most this many accounts are kept. */
export const SAVED_MAX = 5;

/** Adds or refreshes an account (its place in the list kept, details updated). */
export function withAccount(list: readonly SavedAccount[], a: SavedAccount): SavedAccount[] {
  const i = list.findIndex((x) => x.uid === a.uid);
  if (i >= 0) {
    const prev = list[i];
    const next = { ...prev, ...a, savedAt: prev.savedAt };
    if (JSON.stringify(next) === JSON.stringify(prev)) return list as SavedAccount[];
    return list.map((x, k) => (k === i ? next : x));
  }
  return [...list, a].slice(-SAVED_MAX);
}

export const withoutAccount = (list: readonly SavedAccount[], uid: string) => list.filter((x) => x.uid !== uid);

/** The list read back safely: only well-formed accounts, each once, at most `SAVED_MAX`. */
export function cleanSaved(raw: unknown): SavedAccount[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedAccount[] = [];
  const s = (v: unknown, max: number) => (typeof v === 'string' && v && v.length <= max ? v : undefined);
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const uid = s(o.uid, 128);
    const email = s(o.email, 200);
    if (!uid || !email || out.some((x) => x.uid === uid)) continue;
    const name = s(o.name, 60);
    const handle = s(o.handle, 30);
    const avatarUrl = s(o.avatarUrl, 2000);
    out.push({ uid, email, savedAt: s(o.savedAt, 40) ?? new Date(0).toISOString(), ...(name ? { name } : {}), ...(handle ? { handle } : {}), ...(avatarUrl?.startsWith('https://') ? { avatarUrl } : {}) });
  }
  return out.slice(-SAVED_MAX);
}

/** The big line: their name, else @handle, else the email. */
export const accountTitle = (a: SavedAccount) => a.name || (a.handle ? `@${a.handle}` : a.email);
/** The small line: @handle · email, without repeating the title. */
export function accountDetail(a: SavedAccount): string {
  const parts = [a.name && a.handle ? `@${a.handle}` : undefined, a.name || a.handle ? a.email : undefined].filter(Boolean);
  return parts.join(' · ');
}
