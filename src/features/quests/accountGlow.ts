import { LEVEL_STEP_AFTER, LEVELS } from './daily';

/**
 * Whose glow is whose. Quests, side quests, badges and secrets are counted
 * on this phone, whoever is signed in, so the phone's glow alone would hand
 * one account's level to the next account signed in here. The ledger gives
 * each account the glow earned while it was the one signed in:
 *
 * - `phone` is the most glow this phone has ever given out. Only glow above
 *   it is new: it goes to the account signed in at the time (glow earned
 *   while signed out goes to the next account that signs in).
 * - A drop on the phone (a throwback removed, something still loading) is
 *   never taken from anyone, and earning the same glow back isn't counted
 *   twice.
 * - The level the account already shows on its profile (sent from another
 *   phone or the website) is a floor: the account starts from there.
 */
export type GlowLedger = { phone: number; accounts: Readonly<Record<string, number>> };

export const EMPTY_LEDGER: GlowLedger = { phone: 0, accounts: {} };

/** No more than this many accounts are kept (the ones with the most glow stay). */
export const LEDGER_ACCOUNTS_MAX = 20;

/** The glow a level starts at (level 1 is 0). */
export function glowAtLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  if (n <= LEVELS.length) return LEVELS[n - 1].from;
  return LEVELS[LEVELS.length - 1].from + (n - LEVELS.length) * LEVEL_STEP_AFTER;
}

const glowNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** A saved ledger, cleaned (anything odd is dropped). */
export function cleanLedger(raw: unknown): GlowLedger {
  if (!raw || typeof raw !== 'object') return EMPTY_LEDGER;
  const r = raw as { phone?: unknown; accounts?: unknown };
  const accounts: Record<string, number> = {};
  if (r.accounts && typeof r.accounts === 'object') {
    for (const [uid, g] of Object.entries(r.accounts as Record<string, unknown>)) {
      if (uid && uid.length <= 128) accounts[uid] = glowNumber(g);
    }
  }
  return { phone: glowNumber(r.phone), accounts };
}

/**
 * The ledger after the phone counts `phoneGlow` with `uid` signed in (or
 * nobody), that account showing `publishedLevel` on its profile. The same
 * object when nothing changed.
 */
export function creditGlow(ledger: GlowLedger, uid: string | undefined, phoneGlow: number, publishedLevel?: number): GlowLedger {
  if (!uid) return ledger;
  const glow = glowNumber(phoneGlow);
  const had = ledger.accounts[uid];
  const floor = publishedLevel ? glowAtLevel(publishedLevel) : 0;
  const gained = Math.max(0, glow - ledger.phone);
  // The floor is a level the account reached somewhere (often this very phone), so it's never added to.
  const next = Math.max((had ?? 0) + gained, floor);
  const phone = Math.max(ledger.phone, glow);
  if (next === had && phone === ledger.phone) return ledger;
  let accounts: Record<string, number> = { ...ledger.accounts, [uid]: next };
  const ids = Object.keys(accounts);
  if (ids.length > LEDGER_ACCOUNTS_MAX) {
    const keep = new Set(
      ids
        .filter((id) => id !== uid)
        .sort((a, b) => accounts[b] - accounts[a])
        .slice(0, LEDGER_ACCOUNTS_MAX - 1),
    );
    keep.add(uid);
    accounts = Object.fromEntries(Object.entries(accounts).filter(([id]) => keep.has(id)));
  }
  return { phone, accounts };
}
